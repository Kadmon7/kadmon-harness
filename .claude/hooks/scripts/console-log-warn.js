#!/usr/bin/env node
// Hook: console-log-warn | Trigger: PostToolUse (Edit|Write)
// Purpose: Warn about console.log() left in production code. Exit 1 as warning.
import path from "node:path";
import { parseStdin, isDisabled } from "./parse-stdin.js";
import { logHookEvent } from "./log-hook-event.js";

const SKIP_PATHS = [
  "node_modules",
  "dist",
  ".claude/hooks",
  ".test.",
  ".spec.",
];
const CODE_EXT = [".ts", ".js", ".tsx", ".jsx"];

try {
  if (isDisabled("console-log-warn")) process.exit(0);
  const input = parseStdin();
  const filePath = input.tool_input?.file_path ?? "";
  if (!filePath) process.exit(0);

  // Only check code files
  const ext = path.extname(filePath);
  if (!CODE_EXT.includes(ext)) process.exit(0);

  // Skip non-production files
  if (SKIP_PATHS.some((s) => filePath.includes(s))) process.exit(0);

  const content =
    input.tool_input?.new_string ?? input.tool_input?.content ?? "";
  if (content.includes("console.log(")) {
    logHookEvent(input.session_id, {
      hookName: "console-log-warn",
      eventType: "post_tool",
      toolName: input.tool_name,
      exitCode: 1,
      blocked: false,
      error: `console.log() in ${path.basename(filePath)}`,
    });
    console.error(
      `\u{26A0}\u{FE0F} console.log() detected in ${path.basename(filePath)} — remove before committing`,
    );
    process.exit(1);
  }
} catch (err) {
  console.error(JSON.stringify({ error: `console-log-warn: ${err instanceof Error ? err.message : String(err)}` }));
}
process.exit(0);
