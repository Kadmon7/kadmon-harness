/**
 * TDD [feniks] — Phase 1 RED
 * Tests for .claude/hooks/scripts/post-edit-security.js
 * Hook: PostToolUse Edit|Write — runs bandit -ll on .py edits (ADR-027)
 *
 * Pattern mirrors tests/hooks/quality-gate.test.ts and
 * tests/hooks/post-edit-typecheck.test.ts (spawnSync + JSON.stringify input).
 */
import { describe, it, expect, afterEach, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/post-edit-security.js");

// Detect bandit availability at module load time (synchronous, top-level).
// `it.runIf(condition)` evaluates at import time — NEVER put detection in beforeAll.
function banditAvailable(): boolean {
  const probe = process.platform === "win32" ? "where" : "which";
  const r = spawnSync(probe, ["bandit"], { encoding: "utf8" });
  return r.status === 0;
}
const BANDIT_INSTALLED = banditAvailable();

// Fixture paths — copied to tmp to avoid SKIP_PATHS "/tests/" short-circuit in hook.
// The source fixtures live under tests/fixtures/ so bandit can find them during dev,
// but the hook's skip-list treats any path containing "/tests/" as a test file and
// exits 0 before bandit runs. Tests that require bandit to actually execute must
// stage the fixture at a path that clears SKIP_PATHS (kody review 2026-04-24).
const SRC_INSECURE_PY = path.resolve("tests/fixtures/lang-py/insecure.py");
const SRC_CLEAN_PY = path.resolve("tests/fixtures/lang-py/example.py");
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "bandit-sast-"));
const INSECURE_PY = path.join(TMP_DIR, "insecure.py");
const CLEAN_PY = path.join(TMP_DIR, "clean.py");
if (fs.existsSync(SRC_INSECURE_PY)) fs.copyFileSync(SRC_INSECURE_PY, INSECURE_PY);
if (fs.existsSync(SRC_CLEAN_PY)) fs.copyFileSync(SRC_CLEAN_PY, CLEAN_PY);

/**
 * Run the hook via spawnSync. Env can be overridden per test.
 */
function runHook(
  input: object,
  envOverrides: Record<string, string> = {},
): { code: number; stdout: string; stderr: string } {
  const r = spawnSync("node", [HOOK], {
    encoding: "utf8",
    input: JSON.stringify(input),
    env: { ...process.env, ...envOverrides },
  });
  return {
    code: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

// ---------------------------------------------------------------------------
// Step 1.2: shared helper wired, verify structure compiles
// ---------------------------------------------------------------------------

afterAll(() => {
  if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("post-edit-security hook", () => {
  // -------------------------------------------------------------------------
  // Step 1.3: bandit available + finding -> exit 1 + stderr bandit output
  // -------------------------------------------------------------------------
  it.runIf(BANDIT_INSTALLED)(
    "exits 1 and prints bandit findings for an insecure .py file",
    () => {
      const r = runHook({
        tool_input: { file_path: INSECURE_PY },
        session_id: "test-session-1",
        tool_name: "Edit",
      });
      expect(r.code).toBe(1);
      // stderr must contain evidence of bandit running AND a finding marker
      expect(r.stderr).toMatch(/bandit/i);
      expect(r.stderr).toMatch(/Issue:|Severity:|>>/);
    },
  );

  // -------------------------------------------------------------------------
  // Step 1.4: bandit available + clean file -> exit 0
  // -------------------------------------------------------------------------
  it.runIf(BANDIT_INSTALLED)(
    "exits 0 and has no finding markers for a clean .py file",
    () => {
      const r = runHook({
        tool_input: { file_path: CLEAN_PY },
        session_id: "test-session-2",
        tool_name: "Edit",
      });
      expect(r.code).toBe(0);
      // stderr must NOT contain issue/severity markers (trace output allowed)
      expect(r.stderr).not.toMatch(/Issue:|Severity:/);
    },
  );

  // -------------------------------------------------------------------------
  // Step 1.5: bandit NOT installed (forced via env) -> warning + exit 0
  // Use a path that is NOT under /tests/ so SKIP_PATHS doesn't bail early
  // before toolAvailable() is called (CLEAN_PY is under tests/fixtures/ which
  // matches the "/tests/" skip pattern and would cause silent exit 0 instead).
  // -------------------------------------------------------------------------
  it("exits 0 with warning when bandit is not installed (KADMON_SKIP_BANDIT_CHECK)", () => {
    // Use a synthetic .py path that clears all skip filters
    const fakeProdPy = path.resolve("scripts/lib/fake-prod.py");
    const r = runHook(
      {
        tool_input: { file_path: fakeProdPy },
        session_id: "test-session-3",
        tool_name: "Edit",
      },
      { KADMON_SKIP_BANDIT_CHECK: "1", VITEST: "1" },
    );
    expect(r.code).toBe(0);
    expect(r.stderr).toMatch(/bandit not installed|skipping/i);
  });

  // -------------------------------------------------------------------------
  // Step 1.6: non-.py files -> early return, no bandit invocation
  // -------------------------------------------------------------------------
  it.each([
    ["/project/src/index.ts", ".ts"],
    ["/project/src/app.js", ".js"],
    ["/project/README.md", ".md"],
    ["/project/config.json", ".json"],
  ])("exits 0 silently for non-.py file: %s (%s)", (filePath) => {
    const r = runHook({
      tool_input: { file_path: filePath },
      session_id: "test-session-4",
      tool_name: "Edit",
    });
    expect(r.code).toBe(0);
    expect(r.stderr).not.toMatch(/bandit/i);
  });

  // -------------------------------------------------------------------------
  // Step 1.7: Python test files skipped (test_ prefix, _test suffix, /tests/ path)
  // -------------------------------------------------------------------------
  it.each([
    "/project/tests/test_foo.py",
    "/project/src/foo_test.py",
    "/project/tests/unit/bar.py",
    "C:\\project\\tests\\unit\\bar.py",
  ])("exits 0 silently for Python test path: %s", (filePath) => {
    const r = runHook({
      tool_input: { file_path: filePath },
      session_id: "test-session-5",
      tool_name: "Edit",
    });
    expect(r.code).toBe(0);
    expect(r.stderr).not.toMatch(/bandit/i);
  });

  // -------------------------------------------------------------------------
  // Step 1.8: KADMON_DISABLED_HOOKS=post-edit-security -> immediate exit 0
  // -------------------------------------------------------------------------
  it("exits 0 immediately when hook is disabled via KADMON_DISABLED_HOOKS", () => {
    const r = runHook(
      {
        tool_input: { file_path: INSECURE_PY },
        session_id: "test-session-6",
        tool_name: "Edit",
      },
      { KADMON_DISABLED_HOOKS: "post-edit-security" },
    );
    expect(r.code).toBe(0);
    expect(r.stderr).not.toMatch(/bandit|Issue:/i);
  });

  // -------------------------------------------------------------------------
  // Step 1.9: flag-injection safety — path starting with "-" resolved absolute
  // -------------------------------------------------------------------------
  it("resolves flag-like file paths to absolute before passing to bandit", () => {
    // A path like "-c.py" would be parsed as a flag by bandit if not made absolute.
    // The hook should resolve it to an absolute path so bandit treats it as a file.
    // Result may be exit 0 (file not found) or exit 1 (findings) but NEVER the
    // bandit "usage:" help text printed when an unknown flag is passed.
    const r = runHook(
      {
        tool_input: { file_path: "-c.py" },
        session_id: "test-session-7",
        tool_name: "Edit",
      },
    );
    // Any exit code is acceptable; the important thing is bandit didn't parse as flag
    expect(r.stderr).not.toMatch(/usage: bandit/i);
  });

  // -------------------------------------------------------------------------
  // Step 1.10: durationMs logged to hook-events.jsonl on finding path
  // -------------------------------------------------------------------------
  const SESSION_ID_DURATION = `test-duration-${Date.now()}`;

  afterEach(() => {
    // Clean up hook-events.jsonl written during durationMs test
    const dir = path.join(os.tmpdir(), "kadmon", SESSION_ID_DURATION);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it.runIf(BANDIT_INSTALLED)(
    "logs durationMs to hook-events.jsonl when findings are detected",
    () => {
      const r = runHook({
        tool_input: { file_path: INSECURE_PY },
        session_id: SESSION_ID_DURATION,
        tool_name: "Edit",
      });

      // Hook must exit 1 (findings detected)
      expect(r.code).toBe(1);

      // Read hook-events.jsonl
      const eventsPath = path.join(
        os.tmpdir(),
        "kadmon",
        SESSION_ID_DURATION,
        "hook-events.jsonl",
      );
      expect(fs.existsSync(eventsPath)).toBe(true);

      const lines = fs
        .readFileSync(eventsPath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);

      const lastEntry = JSON.parse(lines[lines.length - 1]);
      expect(lastEntry.hookName).toBe("post-edit-security");
      expect(lastEntry.exitCode).toBe(1);
      expect(typeof lastEntry.durationMs).toBe("number");
      expect(lastEntry.durationMs).toBeGreaterThan(0);
      expect(lastEntry.durationMs).toBeLessThan(10000);
    },
  );

  // -------------------------------------------------------------------------
  // Step 1.11: empty / missing file_path -> exit 0 gracefully
  // -------------------------------------------------------------------------
  it("exits 0 gracefully when input is empty object", () => {
    const r = runHook({});
    expect(r.code).toBe(0);
    expect(r.stderr).not.toMatch(/bandit/i);
  });

  it("exits 0 gracefully when tool_input is missing", () => {
    const r = runHook({ session_id: "test-empty-1" });
    expect(r.code).toBe(0);
    expect(r.stderr).not.toMatch(/bandit/i);
  });

  it("exits 0 gracefully when file_path is empty string", () => {
    const r = runHook({
      tool_input: { file_path: "" },
      session_id: "test-empty-2",
    });
    expect(r.code).toBe(0);
    expect(r.stderr).not.toMatch(/bandit/i);
  });
});
