import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/no-context-guard.js");
const SESSION_ID = `test-ncg-${Date.now()}`;
const OBS_DIR = path.join(os.tmpdir(), "kadmon", SESSION_ID);
const OBS_FILE = path.join(OBS_DIR, "observations.jsonl");

function runHook(
  input: object,
  env?: Record<string, string>,
): { exitCode: number; stderr: string } {
  try {
    execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    return { exitCode: 0, stderr: "" };
  } catch (err: unknown) {
    const e = err as { stderr: string; status: number };
    return { exitCode: e.status ?? 1, stderr: e.stderr ?? "" };
  }
}

function addObservation(toolName: string, filePath: string): void {
  fs.mkdirSync(OBS_DIR, { recursive: true });
  fs.appendFileSync(
    OBS_FILE,
    JSON.stringify({ toolName, filePath, eventType: "tool_pre" }) + "\n",
  );
}

describe("no-context-guard", () => {
  beforeEach(() => {
    fs.mkdirSync(OBS_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(OBS_DIR, { recursive: true, force: true });
  });

  it("blocks Write when no Read was performed", () => {
    fs.writeFileSync(OBS_FILE, "");
    const r = runHook({
      session_id: SESSION_ID,
      tool_name: "Write",
      tool_input: { file_path: "src/foo.ts" },
    });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toContain("no_context");
  });

  it("allows Write when file was previously Read", () => {
    addObservation("Read", "src/foo.ts");
    const r = runHook({
      session_id: SESSION_ID,
      tool_name: "Write",
      tool_input: { file_path: "src/foo.ts" },
    });
    expect(r.exitCode).toBe(0);
  });

  it("allows Write for test files", () => {
    fs.writeFileSync(OBS_FILE, "");
    const r = runHook({
      session_id: SESSION_ID,
      tool_name: "Write",
      tool_input: { file_path: "src/foo.test.ts" },
    });
    expect(r.exitCode).toBe(0);
  });

  it("allows Write for markdown files", () => {
    fs.writeFileSync(OBS_FILE, "");
    const r = runHook({
      session_id: SESSION_ID,
      tool_name: "Write",
      tool_input: { file_path: "docs/README.md" },
    });
    expect(r.exitCode).toBe(0);
  });

  it("allows Write when KADMON_NO_CONTEXT_GUARD=off", () => {
    fs.writeFileSync(OBS_FILE, "");
    const r = runHook(
      {
        session_id: SESSION_ID,
        tool_name: "Write",
        tool_input: { file_path: "src/foo.ts" },
      },
      { KADMON_NO_CONTEXT_GUARD: "off" },
    );
    expect(r.exitCode).toBe(0);
  });

  it("allows Write when another file in same directory was Read", () => {
    addObservation("Read", "src/bar.ts");
    const r = runHook({
      session_id: SESSION_ID,
      tool_name: "Write",
      tool_input: { file_path: "src/foo.ts" },
    });
    expect(r.exitCode).toBe(0);
  });

  it("blocks when stdin is truncated (overflow attack vector)", () => {
    fs.writeFileSync(OBS_FILE, "");
    const r = runHook({
      _truncated: true,
      session_id: SESSION_ID,
      tool_name: "Write",
      tool_input: { file_path: "src/main.ts" },
    });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toContain("truncated");
  });
});
