import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/ts-review-reminder.js");
const SESSION_ID = `test-tsr-${Date.now()}`;
const OBS_DIR = path.join(os.tmpdir(), "kadmon", SESSION_ID);
const OBS_FILE = path.join(OBS_DIR, "observations.jsonl");

function writeObs(events: object[]): void {
  fs.mkdirSync(OBS_DIR, { recursive: true });
  fs.writeFileSync(
    OBS_FILE,
    events.map((e) => JSON.stringify(e)).join("\n") + "\n",
  );
}

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

describe("ts-review-reminder", () => {
  afterEach(() => {
    fs.rmSync(OBS_DIR, { recursive: true, force: true });
  });

  it("exits 0 for non-ts files", () => {
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { file_path: "README.md" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 for .ts file with fewer than 5 edits", () => {
    writeObs([
      { toolName: "Edit", filePath: "a.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "b.ts", eventType: "tool_pre" },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { file_path: "c.ts" },
    });
    expect(r.code).toBe(0);
  });

  it("warns after 5+ .ts edits without review", () => {
    writeObs([
      { toolName: "Edit", filePath: "a.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "b.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "c.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "d.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "e.ts", eventType: "tool_pre" },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { file_path: "f.ts" },
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("review");
  });

  it("exits 0 after 5+ edits if kody was invoked", () => {
    writeObs([
      { toolName: "Edit", filePath: "a.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "b.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "c.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "d.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "e.ts", eventType: "tool_pre" },
      {
        toolName: "Agent",
        eventType: "tool_pre",
        metadata: { agentType: "kody" },
      },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { file_path: "f.ts" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 after 5+ edits if typescript-reviewer was invoked", () => {
    writeObs([
      { toolName: "Edit", filePath: "a.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "b.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "c.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "d.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "e.ts", eventType: "tool_pre" },
      {
        toolName: "Agent",
        eventType: "tool_pre",
        metadata: { agentType: "typescript-reviewer" },
      },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { file_path: "f.ts" },
    });
    expect(r.code).toBe(0);
  });
});
