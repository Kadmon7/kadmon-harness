#!/usr/bin/env node
// Hook: post-edit-security | Trigger: PostToolUse (Edit|Write)
// Purpose: Python SAST — run bandit -ll on .py edits (ADR-027).
//   .py  → bandit -ll <file> (single-file, never recursive)
//   other → exit 0 silently
// Warn-only (exit 1 on findings). Graceful fallback when bandit is missing.
// toolAvailable() is intentionally duplicated here (not extracted) because
// quality-gate.js and post-edit-typecheck.js each have slight differences
// in timeout and context; the rule-of-3 floor is met but extraction would
// require touching two stable hook files for marginal gain.
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseStdin, isDisabled } from "./parse-stdin.js";
import { logHookEvent } from "./log-hook-event.js";

const PY_EXT = new Set([".py"]);

// Skip non-production paths — mirrors console-log-warn.js:11-20
const SKIP_PATHS = [
  "node_modules",
  "dist",
  ".claude/hooks",
  ".test.",
  ".spec.",
  "test_",       // Python test file prefix (e.g. test_foo.py)
  "_test.py",    // Python test file suffix (e.g. foo_test.py)
  "/tests/",     // Unix conventional test directory
  "\\tests\\",   // Windows conventional test directory
];

/**
 * Probe whether a CLI tool is available on PATH.
 * On test runs, KADMON_SKIP_BANDIT_CHECK=1 forces false so tests can simulate
 * "bandit not installed" without actually removing it from PATH.
 * The VITEST/NODE_ENV guard ensures this escape hatch never fires in production.
 */
function toolAvailable(cmd) {
  if (
    process.env.KADMON_SKIP_BANDIT_CHECK === "1" &&
    (process.env.VITEST || process.env.NODE_ENV === "test")
  ) {
    return false;
  }
  try {
    const probe = process.platform === "win32" ? "where" : "which";
    execFileSync(probe, [cmd], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run bandit -ll on a single file.
 * Returns { findings: true } when bandit exits non-zero (findings detected).
 * Returns { findings: false } when bandit exits 0 (clean) or is not installed.
 */
function runBandit(fp) {
  // Harden against flag-injection: resolve to absolute so bandit treats it as
  // a file even when the relative path starts with a dash (mirrors quality-gate.js:44).
  const safeFp = path.isAbsolute(fp) ? fp : path.resolve(fp);

  if (!toolAvailable("bandit")) {
    console.error(
      `\u{26A0} post-edit-security: bandit not installed; skipping ${safeFp}. Run: pip install bandit`,
    );
    return { findings: false };
  }

  console.error(`post-edit-security: running bandit on ${safeFp}`);
  try {
    execFileSync("bandit", ["-ll", "--quiet", safeFp], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    });
    return { findings: false };
  } catch (err) {
    // bandit exits 1 when findings are present; stdout contains the report
    if (err.stdout) console.error(`\u{26A0} bandit:\n${err.stdout}`);
    if (err.stderr) console.error(`\u{26A0} bandit:\n${err.stderr}`);
    return { findings: true };
  }
}

try {
  // Disabled-check MUST come before parseStdin so the kill-switch works even
  // if stdin is malformed.
  if (isDisabled("post-edit-security")) process.exit(0);

  const start = Date.now();
  const input = parseStdin();

  const filePath = input.tool_input?.file_path ?? "";
  if (!filePath) process.exit(0);

  // Only process Python files
  const ext = path.extname(filePath);
  if (!PY_EXT.has(ext)) process.exit(0);

  // Skip non-production paths (test files, deps, hook scripts)
  if (SKIP_PATHS.some((s) => filePath.includes(s))) process.exit(0);

  const { findings } = runBandit(filePath);

  if (findings) {
    logHookEvent(input.session_id, {
      hookName: "post-edit-security",
      eventType: "post_tool",
      toolName: input.tool_name,
      exitCode: 1,
      blocked: false,
      durationMs: Date.now() - start,
      error: `bandit findings in ${path.basename(filePath)}`,
    });
    process.exit(1);
  }
} catch (err) {
  console.error(
    JSON.stringify({
      error: `post-edit-security: ${err instanceof Error ? err.message : String(err)}`,
    }),
  );
}
process.exit(0);
