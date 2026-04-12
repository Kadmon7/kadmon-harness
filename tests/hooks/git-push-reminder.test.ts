import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/git-push-reminder.js");
const SESSION_ID = `test-push-${Date.now()}`;
const OBS_DIR = path.join(os.tmpdir(), "kadmon", SESSION_ID);
const OBS_FILE = path.join(OBS_DIR, "observations.jsonl");

function runHook(
  input: object,
  env: Record<string, string> = {},
): {
  code: number;
  stdout: string;
  stderr: string;
} {
  try {
    const stdout = execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string; stderr: string };
    return {
      code: e.status ?? 1,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
    };
  }
}

function writeObservations(entries: object[]): void {
  fs.mkdirSync(OBS_DIR, { recursive: true });
  const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  fs.writeFileSync(OBS_FILE, content);
}

describe("git-push-reminder", () => {
  beforeEach(() => {
    fs.mkdirSync(OBS_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(OBS_DIR, { recursive: true, force: true });
  });

  it("exits 0 when command is not git push", () => {
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { command: "npm test" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 when command is git push but no session_id", () => {
    const r = runHook({
      tool_input: { command: "git push origin main" },
    });
    expect(r.code).toBe(0);
  });

  it("warns when git push and no verify/review in observations (production code)", () => {
    writeObservations([
      { eventType: "tool_pre", toolName: "Read", metadata: { command: null } },
    ]);
    const r = runHook(
      {
        session_id: SESSION_ID,
        tool_input: { command: "git push origin main" },
      },
      { KADMON_TEST_PUSH_FILES: "scripts/lib/state-store.ts" },
    );
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("typecheck/tests not run");
    expect(r.stderr).toContain("production code unreviewed");
  });

  it("exits 0 when observations contain verify and review entries", () => {
    writeObservations([
      {
        eventType: "tool_pre",
        toolName: "Bash",
        metadata: { command: "npx tsc --noEmit" },
      },
      {
        eventType: "tool_pre",
        toolName: "Agent",
        metadata: { agentType: "kody", command: null },
      },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { command: "git push origin main" },
    });
    expect(r.code).toBe(0);
  });

  it("warns when only verify found but no review (production code)", () => {
    writeObservations([
      {
        eventType: "tool_pre",
        toolName: "Bash",
        metadata: { command: "npx vitest run" },
      },
    ]);
    const r = runHook(
      {
        session_id: SESSION_ID,
        tool_input: { command: "git push origin main" },
      },
      { KADMON_TEST_PUSH_FILES: ".claude/hooks/scripts/quality-gate.js" },
    );
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("production code unreviewed");
    expect(r.stderr).not.toContain("typecheck/tests not run");
  });

  it("does NOT warn about review for docs-only commits (skip tier)", () => {
    writeObservations([
      {
        eventType: "tool_pre",
        toolName: "Bash",
        metadata: { command: "npx vitest run" },
      },
    ]);
    const r = runHook(
      {
        session_id: SESSION_ID,
        tool_input: { command: "git push origin main" },
      },
      { KADMON_TEST_PUSH_FILES: "README.md:docs/roadmap/v1.1-learning-system.md" },
    );
    // No production code, verify present, review absent — skip tier is legitimate
    expect(r.code).toBe(0);
    expect(r.stderr).not.toContain("production code unreviewed");
    expect(r.stderr).not.toContain("kody not invoked");
  });

  it("warns when 10+ files unreviewed even without production code (refactor catch)", () => {
    writeObservations([
      {
        eventType: "tool_pre",
        toolName: "Bash",
        metadata: { command: "npx vitest run" },
      },
    ]);
    const tenFiles = Array.from({ length: 10 }, (_, i) => `docs/file-${i}.md`).join(":");
    const r = runHook(
      {
        session_id: SESSION_ID,
        tool_input: { command: "git push origin main" },
      },
      { KADMON_TEST_PUSH_FILES: tenFiles },
    );
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("10 files unreviewed");
  });

  it("warns when only review found but no verify (skip tier files)", () => {
    writeObservations([
      {
        eventType: "tool_pre",
        toolName: "Agent",
        metadata: { agentType: "kody", command: null },
      },
    ]);
    // Empty file list simulates a skip-tier commit (no production code, no
    // large refactor). Only the verify warning should fire.
    const r = runHook(
      {
        session_id: SESSION_ID,
        tool_input: { command: "git push origin main" },
      },
      { KADMON_TEST_PUSH_FILES: "" },
    );
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("typecheck/tests not run");
    expect(r.stderr).not.toContain("production code unreviewed");
  });

  it("exits 0 when observations file does not exist", () => {
    // Remove the observations file (dir exists but no file)
    try {
      fs.unlinkSync(OBS_FILE);
    } catch {
      /* may not exist */
    }
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { command: "git push origin main" },
    });
    // No observations file means warnings array stays empty (no push into it)
    expect(r.code).toBe(0);
  });
});
