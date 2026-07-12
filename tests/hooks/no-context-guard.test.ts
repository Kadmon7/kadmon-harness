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

  it("allows Write for Python test files (test_*.py)", () => {
    fs.writeFileSync(OBS_FILE, "");
    const r = runHook({
      session_id: SESSION_ID,
      tool_name: "Write",
      tool_input: { file_path: "test_foo.py" },
    });
    expect(r.exitCode).toBe(0);
  });

  it("allows Write for Python test files (*_test.py)", () => {
    fs.writeFileSync(OBS_FILE, "");
    const r = runHook({
      session_id: SESSION_ID,
      tool_name: "Write",
      tool_input: { file_path: "foo_test.py" },
    });
    expect(r.exitCode).toBe(0);
  });

  it("allows Write for files under a tests/ directory", () => {
    fs.writeFileSync(OBS_FILE, "");
    const r = runHook({
      session_id: SESSION_ID,
      tool_name: "Write",
      tool_input: { file_path: "tests/helper.py" },
    });
    expect(r.exitCode).toBe(0);
  });

  it("allows Write for pyproject.toml", () => {
    fs.writeFileSync(OBS_FILE, "");
    const r = runHook({
      session_id: SESSION_ID,
      tool_name: "Write",
      tool_input: { file_path: "pyproject.toml" },
    });
    expect(r.exitCode).toBe(0);
  });

  // ts-reviewer WARN (chekpoint Wave 2) — PY_TEST_RE only recognized forward
  // slashes, but tool_input.file_path on win32 is a raw Windows absolute path
  // with BACKSLASHES (this hook reads it straight from stdin, not from
  // git-diff output which git normalizes). Pre-fix, these three cases fell
  // through to the "not exempt" branch and were incorrectly BLOCKED.
  it("allows Write for a Windows absolute test_*.py path with backslashes", () => {
    fs.writeFileSync(OBS_FILE, "");
    const r = runHook({
      session_id: SESSION_ID,
      tool_name: "Write",
      tool_input: { file_path: "C:\\project\\tests\\test_foo.py" },
    });
    expect(r.exitCode).toBe(0);
  });

  it("allows Write for a Windows absolute *_test.py path with backslashes", () => {
    fs.writeFileSync(OBS_FILE, "");
    const r = runHook({
      session_id: SESSION_ID,
      tool_name: "Write",
      tool_input: { file_path: "C:\\project\\some_module\\test_bar.py" },
    });
    expect(r.exitCode).toBe(0);
  });

  it("allows Write for a Windows absolute path under a tests\\ directory with backslashes", () => {
    fs.writeFileSync(OBS_FILE, "");
    const r = runHook({
      session_id: SESSION_ID,
      tool_name: "Write",
      tool_input: { file_path: "C:\\project\\tests\\helper.py" },
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

  it("fails closed (exit 2) when stdin is malformed JSON", () => {
    let threw = false;
    try {
      execFileSync("node", [HOOK], {
        encoding: "utf8",
        input: "{not valid json!!",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      threw = true;
      const e = err as { stderr: string; status: number };
      expect(e.status).toBe(2);
      expect(e.stderr).toContain("error");
    }
    expect(threw).toBe(true);
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

  // AUD-15 (2026-07-12 audit) — session_id from stdin must be validated
  // against /^[a-zA-Z0-9_-]+$/ before being used to build a filesystem path.
  // Regression test: plant a decoy observations.jsonl OUTSIDE the kadmon
  // sandbox at the location a "../" session_id resolves to, containing a Read
  // event for an UNRELATED file/directory. Pre-fix, this hook did
  // `path.join(os.tmpdir(), "kadmon", sid, "observations.jsonl")` with no
  // validation, so it would read the decoy, find no matching Read for the
  // target file, and BLOCK (exit 2). Post-fix, the malformed session_id is
  // rejected by safeSessionDir() before any escaped path is touched, and the
  // hook fails open (exit 0) — the same contract as a missing session_id.
  it("does not read observations from a path outside the kadmon sandbox for a traversal session_id", () => {
    const escapedName = `evil-ncg-${Date.now()}`;
    const escapedDir = path.join(os.tmpdir(), escapedName);
    fs.mkdirSync(escapedDir, { recursive: true });
    fs.writeFileSync(
      path.join(escapedDir, "observations.jsonl"),
      JSON.stringify({
        toolName: "Read",
        filePath: "unrelated/dir/other.ts",
        eventType: "tool_pre",
      }) + "\n",
    );
    try {
      const r = runHook({
        session_id: `../${escapedName}`,
        tool_name: "Write",
        tool_input: { file_path: "top-level-target.ts" },
      });
      // Fails open — same contract as a missing session_id — instead of
      // reading the decoy and blocking on a non-match.
      expect(r.exitCode).toBe(0);
    } finally {
      fs.rmSync(escapedDir, { recursive: true, force: true });
    }
  });
});
