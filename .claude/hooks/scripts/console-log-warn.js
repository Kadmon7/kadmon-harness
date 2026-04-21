#!/usr/bin/env node
// Hook: console-log-warn | Trigger: PostToolUse (Edit|Write)
// Purpose: Warn about debug prints left in production code. Exit 1 as warning.
//   .ts/.tsx/.js/.jsx  → detect console.log(
//   .py                → detect print(  (closes rules/python/hooks.md:18 gap)
// Skip tests, hook scripts, node_modules, dist.
import path from "node:path";
import { parseStdin, isDisabled } from "./parse-stdin.js";
import { logHookEvent } from "./log-hook-event.js";

const SKIP_PATHS = [
  "node_modules",
  "dist",
  ".claude/hooks",
  ".test.",
  ".spec.",
  "test_", // Python test file prefix
  "/tests/", // Unix conventional test directory
  "\\tests\\", // Windows conventional test directory
];
const TS_JS_EXT = new Set([".ts", ".js", ".tsx", ".jsx"]);
const PY_EXT = new Set([".py"]);

const TS_JS_PATTERN = /console\.log\s*\(/;
const PY_PATTERN = /\bprint\s*\(/;

try {
  if (isDisabled("console-log-warn")) process.exit(0);
  const start = Date.now();
  const input = parseStdin();
  const filePath = input.tool_input?.file_path ?? "";
  if (!filePath) process.exit(0);

  // Only check code files
  const ext = path.extname(filePath);
  const isTsJs = TS_JS_EXT.has(ext);
  const isPy = PY_EXT.has(ext);
  if (!isTsJs && !isPy) process.exit(0);

  // Skip non-production files
  if (SKIP_PATHS.some((s) => filePath.includes(s))) process.exit(0);

  const content =
    input.tool_input?.new_string ?? input.tool_input?.content ?? "";

  let matchLabel = "";
  if (isTsJs && TS_JS_PATTERN.test(content)) {
    matchLabel = "console.log()";
  } else if (isPy && PY_PATTERN.test(content)) {
    matchLabel = "print()";
  }

  if (matchLabel) {
    logHookEvent(input.session_id, {
      hookName: "console-log-warn",
      eventType: "post_tool",
      toolName: input.tool_name,
      exitCode: 1,
      blocked: false,
      durationMs: Date.now() - start,
      error: `${matchLabel} in ${path.basename(filePath)}`,
    });
    console.error(
      `\u{26A0}\u{FE0F} ${matchLabel} detected in ${path.basename(filePath)} — remove before committing`,
    );
    process.exit(1);
  }
} catch (err) {
  console.error(JSON.stringify({ error: `console-log-warn: ${err instanceof Error ? err.message : String(err)}` }));
}
process.exit(0);
