import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/observe-post.js");
const SESSION_ID = `test-obs-post-${Date.now()}`;
const OBS_DIR = path.join(os.tmpdir(), "kadmon", SESSION_ID);
const OBS_FILE = path.join(OBS_DIR, "observations.jsonl");
const COUNT_FILE = path.join(OBS_DIR, "tool_count.txt");

function runHook(input: object): number {
  try {
    execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
    });
    return 0;
  } catch (err: unknown) {
    return (err as { status: number }).status ?? 1;
  }
}

describe("observe-post", () => {
  afterEach(() => {
    fs.rmSync(OBS_DIR, { recursive: true, force: true });
  });

  it("creates observations JSONL with tool_post event", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Read",
      tool_input: { file_path: "src/index.ts" },
    });
    expect(fs.existsSync(OBS_FILE)).toBe(true);
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    const event = JSON.parse(lines[0]);
    expect(event.eventType).toBe("tool_post");
    expect(event.toolName).toBe("Read");
    expect(event.success).toBe(true);
  });

  it("records success=false and error when tool_error is present", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Bash",
      tool_input: { command: "false" },
      tool_error: "Command failed with exit code 1",
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.success).toBe(false);
    expect(event.error).toBe("Command failed with exit code 1");
  });

  it("truncates error message to 200 chars", () => {
    const longError = "x".repeat(300);
    runHook({
      session_id: SESSION_ID,
      tool_name: "Bash",
      tool_error: longError,
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.error.length).toBe(200);
  });

  it("increments tool_count.txt on each invocation", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Read",
      tool_input: { file_path: "a.ts" },
    });
    expect(fs.readFileSync(COUNT_FILE, "utf8")).toBe("1");

    runHook({
      session_id: SESSION_ID,
      tool_name: "Edit",
      tool_input: { file_path: "b.ts" },
    });
    expect(fs.readFileSync(COUNT_FILE, "utf8")).toBe("2");
  });

  it("appends multiple observations", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Read",
      tool_input: { file_path: "a.ts" },
    });
    runHook({
      session_id: SESSION_ID,
      tool_name: "Write",
      tool_input: { file_path: "b.ts" },
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
  });

  it("records filePath from tool_input", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Edit",
      tool_input: { file_path: "src/lib/store.ts" },
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.filePath).toBe("src/lib/store.ts");
  });

  it("exits 0 with no session_id", () => {
    expect(runHook({ tool_name: "Read" })).toBe(0);
  });

  it("exits 0 on empty input", () => {
    expect(runHook({})).toBe(0);
  });
});
