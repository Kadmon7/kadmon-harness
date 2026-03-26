#!/usr/bin/env node
// Hook: transparency-reminder | Trigger: PreToolUse (Agent)
// Purpose: Remind to announce agent invocations with transparency emojis. Exit 1 as warning.
import { parseStdin } from "./parse-stdin.js";
try {
  const input = parseStdin();
  const toolName = input.tool_name ?? "";
  if (toolName !== "Agent") process.exit(0);
  const agentType = input.tool_input?.subagent_type ?? "general-purpose";
  const desc = input.tool_input?.description ?? "";
  console.log(
    `\u{1F4CB} transparency: announce \u{1F916} [${agentType}]: ${desc}`,
  );
} catch (err) {
  console.error(
    JSON.stringify({ error: `transparency-reminder: ${err.message}` }),
  );
  process.exit(0);
}
process.exit(1);
