#!/usr/bin/env node
// Hook: commit-quality | Trigger: PreToolUse (Bash)
// Purpose: Scan staged changes for debug markers and secrets before commit.
//   TS/JS files: console.log + debugger
//   Python files: print() + breakpoint()  (plan-020 Phase B)
// Exit 2 on problems found, exit 0 otherwise.
import { execSync } from "node:child_process";
import { parseStdin, isDisabled } from "./parse-stdin.js";
import { logHookEvent } from "./log-hook-event.js";

const SECRET_PATTERNS = [
  /(?:api[_-]?key|secret[_-]?key|token|password|credentials)\s*[:=]\s*["'][A-Za-z0-9+/=]{16,}["']/i,
  /(?:sk|pk)[-_](?:live|test)[-_][A-Za-z0-9]{20,}/,
  /ghp_[A-Za-z0-9]{36,}/,
  /xox[bpas]-[A-Za-z0-9-]{10,}/,
  /sk-ant-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /sbp_[a-f0-9]{40,}/,
];

const TS_JS_TEST_RE = /\.(test|spec)\.(ts|js|tsx|jsx)$/;
const PY_TEST_RE = /(^|\/)test_[^/]+\.py$|_test\.py$|(^|\/)tests\//;

try {
  if (isDisabled("commit-quality")) process.exit(0);
  const start = Date.now();
  const input = parseStdin();
  const cmd = input.tool_input?.command ?? "";

  // Only check git commit commands
  if (!cmd.includes("git commit")) process.exit(0);
  // Skip amend-only (no new code)
  if (cmd.includes("--amend") && !cmd.includes("-m")) process.exit(0);

  let diff = "";
  try {
    diff = execSync("git diff --cached --diff-filter=ACMR", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    });
  } catch {
    process.exit(0); // Can't get diff, allow
  }

  if (!diff) process.exit(0);

  const issues = [];

  const isTsJsFile = (fp) => /\.(ts|tsx|js|jsx)$/.test(fp);
  const isPyFile = (fp) => fp.endsWith(".py");
  const isTestFile = (fp) => TS_JS_TEST_RE.test(fp) || PY_TEST_RE.test(fp);
  const isDocFile = (fp) => fp.endsWith(".md");
  const isScriptOrHook = (fp) =>
    fp.startsWith(".claude/hooks/scripts/") ||
    fp.startsWith("scripts/") ||
    (fp.endsWith(".js") && fp.includes("hooks/"));
  // dist/ is generated tsc output of scripts/ — apply the same script-tier
  // exemption (CLI tools and harness scripts use console.log intentionally).
  const isCompiledDist = (fp) => fp.startsWith("dist/");

  let currentFile = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6);
      continue;
    }
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    if (isTestFile(currentFile)) continue;

    const content = line.slice(1); // Remove leading +
    const exemptDebug =
      isScriptOrHook(currentFile) ||
      isDocFile(currentFile) ||
      isCompiledDist(currentFile);

    if (!exemptDebug) {
      if (isTsJsFile(currentFile)) {
        if (/console\.log\s*\(/.test(content)) {
          issues.push(`console.log() found in ${currentFile}`);
        }
        if (/\bdebugger\b/.test(content)) {
          issues.push(`debugger statement found in ${currentFile}`);
        }
      } else if (isPyFile(currentFile)) {
        if (/\bprint\s*\(/.test(content)) {
          issues.push(`print() found in ${currentFile}`);
        }
        if (/\bbreakpoint\s*\(/.test(content)) {
          issues.push(`breakpoint() found in ${currentFile}`);
        }
      }
    }

    // Secret detection is language-agnostic
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        issues.push(`Possible secret/API key in ${currentFile}`);
        break;
      }
    }
  }

  const uniqueIssues = [...new Set(issues)];

  if (uniqueIssues.length > 0) {
    const error = uniqueIssues.join("; ");
    logHookEvent(input.session_id, {
      hookName: "commit-quality",
      eventType: "pre_tool",
      toolName: "Bash",
      exitCode: 2,
      blocked: true,
      durationMs: Date.now() - start,
      error,
    });
    console.error(
      JSON.stringify({
        block: true,
        message: `\u{1F6A8} Commit quality issues found:\n${uniqueIssues.map((i) => `  - ${i}`).join("\n")}\n\nFix these issues before committing, or remove them if intentional.`,
      }),
    );
    process.exit(2);
  }
} catch (err) {
  console.error(JSON.stringify({ error: `commit-quality: ${err instanceof Error ? err.message : String(err)}` }));
}
process.exit(0);
