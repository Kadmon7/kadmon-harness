#!/usr/bin/env node
// Hook: block-no-verify | Trigger: PreToolUse (Bash)
// Purpose: Block git commit --no-verify and git push --no-gpg-sign
import { parseStdin, isDisabled } from "./parse-stdin.js";
import { logHookEvent } from "./log-hook-event.js";
try {
  if (isDisabled("block-no-verify")) process.exit(0);
  const input = parseStdin();
  const command = input.tool_input?.command ?? "";
  const blocked = ["--no-verify", "--no-gpg-sign"];
  const found = blocked.find((flag) => command.includes(flag));
  if (found) {
    const msg = `Blocked: "${found}" is not allowed. Git hooks must not be bypassed.`;
    logHookEvent(input.session_id, {
      hookName: "block-no-verify",
      eventType: "pre_tool",
      toolName: "Bash",
      exitCode: 2,
      blocked: true,
      error: msg,
    });
    console.error(JSON.stringify({ block: true, message: `\u{1F6AB} ${msg}` }));
    process.exit(2);
  }
} catch (err) {
  console.error(JSON.stringify({ error: `block-no-verify: ${err.message}` }));
}
process.exit(0);
