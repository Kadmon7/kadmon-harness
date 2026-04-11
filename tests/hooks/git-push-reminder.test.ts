import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/git-push-reminder.js");
const SESSION_ID = `test-push-${Date.now()}`;
const OBS_DIR = path.join(os.tmpdir(), "kadmon", SESSION_ID);
const OBS_FILE = path.join(OBS_DIR, "observations.jsonl");

function runHook(input: object): {
  code: number;
  stdout: string;
  stderr: string;
} {
  try {
    const stdout = execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
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

  it("warns when git push and no verify/review in observations", () => {
    writeObservations([
      { eventType: "tool_pre", toolName: "Read", metadata: { command: null } },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { command: "git push origin main" },
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("typecheck/tests not run");
    expect(r.stderr).toContain("kody not invoked");
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

  it("warns when only verify found but no review", () => {
    writeObservations([
      {
        eventType: "tool_pre",
        toolName: "Bash",
        metadata: { command: "npx vitest run" },
      },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { command: "git push origin main" },
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("kody not invoked");
    expect(r.stderr).not.toContain("typecheck/tests not run");
  });

  it("warns when only review found but no verify", () => {
    writeObservations([
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
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("typecheck/tests not run");
    expect(r.stderr).not.toContain("kody not invoked");
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
