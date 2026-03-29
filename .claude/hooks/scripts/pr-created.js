#!/usr/bin/env node
// Hook: pr-created | Trigger: PostToolUse (Bash)
// Purpose: Log PR URL when a PR is created via gh cli. Exit 0 always (informative).
import { parseStdin } from "./parse-stdin.js";

try {
  const input = parseStdin();
  const cmd = input.tool_input?.command ?? "";

  // Only trigger on gh pr create
  if (!cmd.includes("gh pr create")) process.exit(0);

  const result = input.tool_result ?? input.response ?? "";
  if (!result) process.exit(0);

  // Extract PR URL from gh output (format: https://github.com/owner/repo/pull/123)
  const urlMatch = String(result).match(
    /https:\/\/github\.com\/[^\s]+\/pull\/\d+/,
  );
  if (urlMatch) {
    const url = urlMatch[0];
    const prNumber = url.split("/").pop();
    console.log(
      `\u{1F517} PR created: ${url}\n   Review: gh pr view ${prNumber}`,
    );
  }
} catch (err) {
  console.error(JSON.stringify({ error: `pr-created: ${err.message}` }));
}
process.exit(0);
