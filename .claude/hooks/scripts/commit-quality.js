#!/usr/bin/env node
// Hook: commit-quality | Trigger: PreToolUse (Bash)
// Purpose: Scan staged changes for console.log, debugger, and secrets before commit.
// Exit 2 on problems found, exit 0 otherwise.
import { execSync } from "node:child_process";
import { parseStdin, isDisabled } from "./parse-stdin.js";
import { logHookEvent } from "./log-hook-event.js";

const SECRET_PATTERNS = [
  /(?:api[_-]?key|secret[_-]?key|token|password|credentials)\s*[:=]\s*["'][A-Za-z0-9+/=]{16,}["']/i,
  /(?:sk|pk)[-_](?:live|test)[-_][A-Za-z0-9]{20,}/,
  /ghp_[A-Za-z0-9]{36,}/,
  /xox[bpas]-[A-Za-z0-9-]{10,}/,
];

try {
  if (isDisabled("commit-quality")) process.exit(0);
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

  // Only check added lines (lines starting with +, but not +++ headers)
  const addedLines = diff
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"));

  // Detect current file being diffed
  const fileHeaders = diff.split("\n").filter((l) => l.startsWith("+++ b/"));
  const isTestFile = (filePath) =>
    /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath);
  const isDocFile = (filePath) => filePath.endsWith(".md");
  const isScriptOrHook = (filePath) =>
    filePath.startsWith(".claude/hooks/scripts/") ||
    filePath.startsWith("scripts/") ||
    (filePath.endsWith(".js") && filePath.includes("hooks/"));

  // Build a map of which added lines belong to which file
  let currentFile = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6);
      continue;
    }
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    if (isTestFile(currentFile)) continue;

    const content = line.slice(1); // Remove leading +

    // Skip console.log/debugger checks for hook scripts, CLI scripts, and docs
    if (!isScriptOrHook(currentFile) && !isDocFile(currentFile)) {
      // Check for console.log
      if (/console\.log\s*\(/.test(content)) {
        issues.push(`console.log() found in ${currentFile}`);
      }

      // Check for debugger
      if (/\bdebugger\b/.test(content)) {
        issues.push(`debugger statement found in ${currentFile}`);
      }
    }

    // Check for secrets
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        issues.push(`Possible secret/API key in ${currentFile}`);
        break;
      }
    }
  }

  // Deduplicate
  const uniqueIssues = [...new Set(issues)];

  if (uniqueIssues.length > 0) {
    const error = uniqueIssues.join("; ");
    logHookEvent(input.session_id, {
      hookName: "commit-quality",
      eventType: "pre_tool",
      toolName: "Bash",
      exitCode: 2,
      blocked: true,
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
  console.error(JSON.stringify({ error: `commit-quality: ${err.message}` }));
}
process.exit(0);
