import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Top-level dynamic import — vitest freshly loads each test file
const { logHookError, getHookErrors } = (await import(
  path.resolve(".claude/hooks/scripts/hook-logger.js")
)) as {
  logHookError: (
    hookName: string,
    error: unknown,
    context?: Record<string, unknown>,
    logDir?: string,
  ) => void;
  getHookErrors: (
    logDir?: string,
    limit?: number,
  ) => Array<Record<string, unknown>>;
};

const TEMP_DIR = path.join(
  os.tmpdir(),
  `kadmon-hook-logger-test-${Date.now()}`,
);

afterEach(() => {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});

function setup(): void {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

describe("logHookError", () => {
  it("creates hook-errors.log and writes a valid JSON line", () => {
    setup();
    logHookError(
      "session-start",
      new Error("import failed"),
      undefined,
      TEMP_DIR,
    );
    const logPath = path.join(TEMP_DIR, "hook-errors.log");
    expect(fs.existsSync(logPath)).toBe(true);

    const content = fs.readFileSync(logPath, "utf8").trim();
    const entry = JSON.parse(content);
    expect(entry.hook).toBe("session-start");
    expect(entry.error).toBe("import failed");
    expect(entry.timestamp).toBeDefined();
  });

  it("appends multiple entries to the same file", () => {
    setup();
    logHookError("hook-a", new Error("err1"), undefined, TEMP_DIR);
    logHookError("hook-b", new Error("err2"), undefined, TEMP_DIR);

    const logPath = path.join(TEMP_DIR, "hook-errors.log");
    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).hook).toBe("hook-a");
    expect(JSON.parse(lines[1]).hook).toBe("hook-b");
  });

  it("includes timestamp, hook name, error, and optional context", () => {
    setup();
    logHookError(
      "pre-compact",
      new Error("db locked"),
      { phase: "persist" },
      TEMP_DIR,
    );

    const logPath = path.join(TEMP_DIR, "hook-errors.log");
    const entry = JSON.parse(fs.readFileSync(logPath, "utf8").trim());
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(entry.hook).toBe("pre-compact");
    expect(entry.error).toBe("db locked");
    expect(entry.context).toEqual({ phase: "persist" });
  });

  it("handles non-Error objects gracefully", () => {
    setup();
    logHookError("test-hook", "string error", undefined, TEMP_DIR);
    logHookError("test-hook", null, undefined, TEMP_DIR);
    logHookError("test-hook", { code: 42 }, undefined, TEMP_DIR);

    const logPath = path.join(TEMP_DIR, "hook-errors.log");
    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    expect(lines.length).toBe(3);
    expect(JSON.parse(lines[0]).error).toBe("string error");
    expect(JSON.parse(lines[1]).error).toBe("null");
    expect(JSON.parse(lines[2]).error).toBe("[object Object]");
  });

  it("includes stack trace truncated to 3 lines for Error objects", () => {
    setup();
    logHookError("test-hook", new Error("with stack"), undefined, TEMP_DIR);

    const logPath = path.join(TEMP_DIR, "hook-errors.log");
    const entry = JSON.parse(fs.readFileSync(logPath, "utf8").trim());
    expect(entry.stack).toBeDefined();
    const stackLines = entry.stack.split("\n");
    expect(stackLines.length).toBeLessThanOrEqual(3);
  });

  it("truncates log file when it exceeds MAX_LOG_SIZE (100KB)", () => {
    setup();
    const logPath = path.join(TEMP_DIR, "hook-errors.log");

    // Write 200 lines, each ~600 bytes — total ~120KB > 100KB limit
    const paddedEntry = JSON.stringify({
      hook: "pre-fill",
      error: "x".repeat(560),
      timestamp: new Date().toISOString(),
    });
    const prefill =
      Array.from({ length: 200 }, () => paddedEntry).join("\n") + "\n";
    fs.writeFileSync(logPath, prefill);

    // Verify pre-condition: file exceeds 100KB
    expect(fs.statSync(logPath).size).toBeGreaterThan(100_000);

    // Calling logHookError triggers truncation before appending
    logHookError(
      "trigger-truncation",
      new Error("after truncate"),
      undefined,
      TEMP_DIR,
    );

    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    // 50 kept from original + 1 newly appended = 51
    expect(lines.length).toBe(51);
  });

  it("preserves most recent entries during truncation", () => {
    setup();
    const logPath = path.join(TEMP_DIR, "hook-errors.log");

    // Write 200 numbered entries, each ~600 bytes → ~120KB > 100KB
    const pad = "x".repeat(530);
    const prefillLines = Array.from({ length: 200 }, (_, i) =>
      JSON.stringify({
        hook: `hook-${i}`,
        error: "e",
        pad,
        timestamp: new Date().toISOString(),
      }),
    );
    fs.writeFileSync(logPath, prefillLines.join("\n") + "\n");

    expect(fs.statSync(logPath).size).toBeGreaterThan(100_000);

    logHookError(
      "trigger-truncation",
      new Error("new entry"),
      undefined,
      TEMP_DIR,
    );

    const entries = getHookErrors(TEMP_DIR);
    // Last 50 of original (hook-150 to hook-199) + the new trigger entry = 51
    expect(entries.length).toBe(51);
    expect(entries[0].hook).toBe("hook-150");
    expect(entries[50].hook).toBe("trigger-truncation");
  });
});

describe("logHookError — test-env guard", () => {
  it("suppresses writes to the production log when VITEST is set and no logDir override", () => {
    const realHome = os.homedir();
    const prodLogPath = path.join(realHome, ".kadmon", "hook-errors.log");
    const sizeBefore = fs.existsSync(prodLogPath)
      ? fs.statSync(prodLogPath).size
      : 0;

    const originalKadmonTestDb = process.env.KADMON_TEST_DB;
    const originalVitest = process.env.VITEST;
    delete process.env.KADMON_TEST_DB;
    process.env.VITEST = "true";
    try {
      logHookError("guard-check", new Error("should not reach prod log"));
    } finally {
      if (originalKadmonTestDb === undefined) {
        delete process.env.KADMON_TEST_DB;
      } else {
        process.env.KADMON_TEST_DB = originalKadmonTestDb;
      }
      if (originalVitest === undefined) {
        delete process.env.VITEST;
      } else {
        process.env.VITEST = originalVitest;
      }
    }

    const sizeAfter = fs.existsSync(prodLogPath)
      ? fs.statSync(prodLogPath).size
      : 0;
    expect(sizeAfter).toBe(sizeBefore);
  });
});

describe("getHookErrors", () => {
  it("reads entries and returns them parsed", () => {
    setup();
    logHookError("hook-a", new Error("err1"), undefined, TEMP_DIR);
    logHookError("hook-b", new Error("err2"), undefined, TEMP_DIR);

    const entries = getHookErrors(TEMP_DIR);
    expect(entries.length).toBe(2);
    expect(entries[0].hook).toBe("hook-a");
    expect(entries[1].hook).toBe("hook-b");
  });

  it("returns empty array when log file does not exist", () => {
    const entries = getHookErrors(path.join(TEMP_DIR, "nonexistent"));
    expect(entries).toEqual([]);
  });

  it("respects limit parameter", () => {
    setup();
    logHookError("a", new Error("1"), undefined, TEMP_DIR);
    logHookError("b", new Error("2"), undefined, TEMP_DIR);
    logHookError("c", new Error("3"), undefined, TEMP_DIR);

    const entries = getHookErrors(TEMP_DIR, 2);
    expect(entries.length).toBe(2);
    expect(entries[0].hook).toBe("b");
    expect(entries[1].hook).toBe("c");
  });

  it("skips corrupted lines and returns valid entries", () => {
    setup();
    const logPath = path.join(TEMP_DIR, "hook-errors.log");

    const mixedContent =
      [
        JSON.stringify({
          hook: "valid-1",
          error: "ok",
          timestamp: "2026-01-01T00:00:00Z",
        }),
        "this is not json",
        JSON.stringify({
          hook: "valid-2",
          error: "also ok",
          timestamp: "2026-01-01T00:01:00Z",
        }),
        "{broken json",
        JSON.stringify({
          hook: "valid-3",
          error: "still ok",
          timestamp: "2026-01-01T00:02:00Z",
        }),
      ].join("\n") + "\n";
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    fs.writeFileSync(logPath, mixedContent);

    const entries = getHookErrors(TEMP_DIR);
    expect(entries.length).toBe(3);
    expect(entries[0].hook).toBe("valid-1");
    expect(entries[1].hook).toBe("valid-2");
    expect(entries[2].hook).toBe("valid-3");
  });
});
