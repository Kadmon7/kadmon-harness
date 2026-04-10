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

  it("records durationMs when last_pre_ts.txt exists", () => {
    fs.mkdirSync(OBS_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(OBS_DIR, "last_pre_ts.txt"),
      String(Date.now() - 150),
    );
    runHook({
      session_id: SESSION_ID,
      tool_name: "Read",
      tool_input: { file_path: "src/index.ts" },
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.durationMs).toBeGreaterThanOrEqual(100);
    expect(event.durationMs).toBeLessThan(5000);
  });

  it("works gracefully without last_pre_ts.txt", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Read",
      tool_input: { file_path: "src/index.ts" },
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.durationMs).toBeUndefined();
  });

  it("captures metadata.command for Bash tools", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Bash",
      tool_input: { command: "npm run build" },
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.metadata.command).toBe("npm run build");
  });

  it("captures metadata.resultSnippet for Bash tools", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Bash",
      tool_input: { command: "echo hello" },
      tool_result: "hello\nworld\n",
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.metadata.resultSnippet).toBe("hello\nworld\n");
  });

  it("does not capture metadata for non-Bash tools", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Read",
      tool_input: { file_path: "a.ts" },
      tool_result: "file content here",
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.metadata).toBeUndefined();
  });

  it("scrubs GitHub PAT from Bash resultSnippet", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Bash",
      tool_input: { command: "some command" },
      tool_result: "token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij",
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.metadata.resultSnippet).toContain("[REDACTED]");
    expect(event.metadata.resultSnippet).not.toContain("ghp_");
  });

  it("scrubs Stripe key from Bash resultSnippet", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Bash",
      tool_input: { command: "some command" },
      tool_result: "key: sk-live-ABCDEFGHIJKLMNOPQRST1234",
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.metadata.resultSnippet).toContain("[REDACTED]");
    expect(event.metadata.resultSnippet).not.toContain("sk-live");
  });

  it("scrubs Slack token from Bash resultSnippet", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Bash",
      tool_input: { command: "some command" },
      tool_result: "auth: xoxb-123456789-abcdefghij",
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.metadata.resultSnippet).toContain("[REDACTED]");
    expect(event.metadata.resultSnippet).not.toContain("xoxb-");
  });

  it("scrubs generic API key from Bash resultSnippet", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Bash",
      tool_input: { command: "some command" },
      tool_result: 'api_key = "SuperSecretKeyValue123"',
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.metadata.resultSnippet).toContain("[REDACTED]");
    expect(event.metadata.resultSnippet).not.toContain(
      "SuperSecretKeyValue123",
    );
  });

  it("exits 0 and creates no file when session_id contains path traversal chars", () => {
    // Arrange + Act: traversal with ../
    const exitCode1 = runHook({
      session_id: "../../../etc",
      tool_name: "Read",
    });
    expect(exitCode1).toBe(0);
    // The hook must NOT create a file at the traversal path
    const traversalFile = path.join(
      os.tmpdir(),
      "kadmon",
      "../../../etc",
      "observations.jsonl",
    );
    expect(fs.existsSync(traversalFile)).toBe(false);

    // Arrange + Act: traversal with embedded slash
    const exitCode2 = runHook({ session_id: "foo/bar", tool_name: "Read" });
    expect(exitCode2).toBe(0);
    // The hook must NOT create a file at the slash path
    const slashFile = path.join(
      os.tmpdir(),
      "kadmon",
      "foo/bar",
      "observations.jsonl",
    );
    expect(fs.existsSync(slashFile)).toBe(false);
  });

  it("scrubs secrets from tool_error field", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Bash",
      tool_error: "Failed: token=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij",
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.error).toContain("[REDACTED]");
    expect(event.error).not.toContain("ghp_");
  });

  it("scrubs secrets from metadata.command field", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Bash",
      tool_input: {
        command:
          'curl -H "Authorization: Bearer sk-live-ABCDEFGHIJKLMNOPQRST1234"',
      },
      tool_result: "ok",
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.metadata.command).toContain("[REDACTED]");
    expect(event.metadata.command).not.toContain("sk-live");
  });
});
