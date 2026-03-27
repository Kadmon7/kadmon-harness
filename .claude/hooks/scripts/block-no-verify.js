#!/usr/bin/env node
// Hook: block-no-verify | Trigger: PreToolUse (Bash)
// Purpose: Block git commit --no-verify and git push --no-gpg-sign
import { parseStdin } from "./parse-stdin.js";
try {
  const input = parseStdin();
  const command = input.tool_input?.command ?? "";
  const blocked = ["--no-verify", "--no-gpg-sign"];
  const found = blocked.find((flag) => command.includes(flag));
  if (found) {
    console.error(
      JSON.stringify({
        block: true,
        message: `\u{1F6AB} Blocked: "${found}" is not allowed. Git hooks must not be bypassed.`,
      }),
    );
    process.exit(2);
  }
} catch (err) {
  console.error(JSON.stringify({ error: `block-no-verify: ${err.message}` }));
}
process.exit(0);
