#!/usr/bin/env node
// Hook: deps-change-reminder | Trigger: PostToolUse (Edit|Write)
// Purpose: Remind to check /docs when package.json dependencies change
// Exit 1 (warning) when package.json is edited, exit 0 otherwise.
import { parseStdin } from "./parse-stdin.js";

try {
  const input = parseStdin();
  const filePath = input.tool_input?.file_path ?? "";

  if (!filePath.endsWith("package.json")) process.exit(0);

  console.error(
    JSON.stringify({
      warn: true,
      message:
        "package.json modified. If dependency versions changed, run /docs <library> breaking changes before committing.",
    }),
  );
  process.exit(1);
} catch (err) {
  console.error(
    JSON.stringify({ error: `deps-change-reminder: ${err.message}` }),
  );
}
process.exit(0);
