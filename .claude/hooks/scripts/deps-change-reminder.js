#!/usr/bin/env node
// Hook: deps-change-reminder | Trigger: PostToolUse (Edit|Write)
// Purpose: Remind to check /almanak when package.json dependencies change
// Exit 1 (warning) when package.json is edited, exit 0 otherwise.
import { parseStdin, isDisabled } from "./parse-stdin.js";
import { logHookEvent } from "./log-hook-event.js";

try {
  if (isDisabled("deps-change-reminder")) process.exit(0);
  const input = parseStdin();
  const filePath = input.tool_input?.file_path ?? "";

  if (!filePath.endsWith("package.json")) process.exit(0);

  // Only warn when dependency sections are modified
  const content =
    input.tool_input?.new_string ?? input.tool_input?.content ?? "";
  if (
    !/"(?:dependencies|devDependencies|peerDependencies|optionalDependencies)"/i.test(
      content,
    )
  )
    process.exit(0);

  logHookEvent(input.session_id, {
    hookName: "deps-change-reminder",
    eventType: "post_tool",
    toolName: input.tool_name,
    exitCode: 1,
    blocked: false,
    error: "package.json deps modified",
  });
  console.error(
    JSON.stringify({
      warn: true,
      message:
        "package.json modified. If dependency versions changed, run /almanak <library> breaking changes before committing.",
    }),
  );
  process.exit(1);
} catch (err) {
  console.error(
    JSON.stringify({ error: `deps-change-reminder: ${err instanceof Error ? err.message : String(err)}` }),
  );
}
process.exit(0);
