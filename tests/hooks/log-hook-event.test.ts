import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Direct ESM import — no child process needed for this pure file I/O module
const { logHookEvent } = (await import(
  path.resolve(".claude/hooks/scripts/log-hook-event.js")
)) as {
  logHookEvent: (sessionId: string, event: Record<string, unknown>) => void;
};

const KADMON_TMP = path.join(os.tmpdir(), "kadmon");

function sessionDir(sessionId: string): string {
  return path.join(KADMON_TMP, sessionId);
}

function jsonlPath(sessionId: string): string {
  return path.join(sessionDir(sessionId), "hook-events.jsonl");
}

// Use a unique prefix per test run to avoid cross-test pollution
const RUN_ID = `test-lhe-${Date.now()}`;

afterEach(() => {
  // Clean up all session dirs created by this test run
  const entries = fs
    .readdirSync(KADMON_TMP)
    .filter((d) => d.startsWith("test-lhe-"));
  for (const entry of entries) {
    fs.rmSync(path.join(KADMON_TMP, entry), { recursive: true, force: true });
  }
});

describe("logHookEvent", () => {
  it("appends hook event to JSONL file", () => {
    const sessionId = `${RUN_ID}-single`;
    const event = {
      hookName: "no-context-guard",
      eventType: "pre_tool",
      toolName: "Edit",
      exitCode: 2,
      blocked: true,
      durationMs: 12,
    };

    logHookEvent(sessionId, event);

    const filePath = jsonlPath(sessionId);
    expect(fs.existsSync(filePath)).toBe(true);

    const raw = fs.readFileSync(filePath, "utf8").trim();
    const entry = JSON.parse(raw) as Record<string, unknown>;

    expect(entry.hookName).toBe("no-context-guard");
    expect(entry.eventType).toBe("pre_tool");
    expect(entry.toolName).toBe("Edit");
    expect(entry.exitCode).toBe(2);
    expect(entry.blocked).toBe(true);
    expect(entry.durationMs).toBe(12);
    expect(typeof entry.timestamp).toBe("string");
    expect(entry.timestamp as string).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("appends multiple events to same file", () => {
    const sessionId = `${RUN_ID}-multi`;
    const eventA = {
      hookName: "hook-a",
      eventType: "pre_tool",
      exitCode: 0,
      blocked: false,
    };
    const eventB = {
      hookName: "hook-b",
      eventType: "post_tool",
      exitCode: 1,
      blocked: false,
    };

    logHookEvent(sessionId, eventA);
    logHookEvent(sessionId, eventB);

    const filePath = jsonlPath(sessionId);
    const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");

    expect(lines).toHaveLength(2);
    expect((JSON.parse(lines[0]) as Record<string, unknown>).hookName).toBe(
      "hook-a",
    );
    expect((JSON.parse(lines[1]) as Record<string, unknown>).hookName).toBe(
      "hook-b",
    );
  });

  it("silently skips and creates no file when sessionId is empty string", () => {
    logHookEvent("", {
      hookName: "test",
      eventType: "pre_tool",
      exitCode: 0,
      blocked: false,
    });

    // The empty string is rejected by the regex guard — no file should be created in KADMON_TMP
    expect(fs.existsSync(path.join(KADMON_TMP, "hook-events.jsonl"))).toBe(
      false,
    );
  });

  it("silently skips when sessionId contains path traversal or illegal characters", () => {
    // Traversal id resolving to a guaranteed-WRITABLE location outside the
    // kadmon sandbox (os.tmpdir() itself) — a broken guard would create it
    // regardless of uid/platform, so its absence is a real regression signal.
    const escapedName = `lhe-escape-${Date.now()}`;
    const illegalIds = [
      `../${escapedName}`,
      "../../../etc",
      "foo/bar",
      "sid with spaces",
      "sid\x00null",
    ];

    for (const illegalId of illegalIds) {
      logHookEvent(illegalId, {
        hookName: "test",
        eventType: "pre_tool",
        exitCode: 0,
        blocked: false,
      });
    }

    try {
      // The writable-escape dir must not have been created in os.tmpdir()
      expect(fs.existsSync(path.join(os.tmpdir(), escapedName))).toBe(false);

      // "../../../etc" collapses (via path.join) to the SYSTEM /etc dir on
      // POSIX, which exists on any Linux/macOS host no matter what the hook
      // did — the old existsSync(dir) assertion was Windows-only by accident
      // (%TEMP%\..\..\..\etc happens not to exist there). Assert on the FILE
      // the hook would have written instead, which is absent on a healthy
      // system on every platform.
      expect(
        fs.existsSync(path.join(KADMON_TMP, "../../../etc", "hook-events.jsonl")),
      ).toBe(false);

      // None of the remaining ids should have created dirs under KADMON_TMP
      expect(fs.existsSync(path.join(KADMON_TMP, "foo/bar"))).toBe(false);
      expect(fs.existsSync(path.join(KADMON_TMP, "sid with spaces"))).toBe(false);
      expect(fs.existsSync(path.join(KADMON_TMP, "sid\x00null"))).toBe(false);
    } finally {
      fs.rmSync(path.join(os.tmpdir(), escapedName), {
        recursive: true,
        force: true,
      });
    }
  });
});
