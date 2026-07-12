#!/usr/bin/env node
// Hook: mcp-health-check | Trigger: PreToolUse (mcp__*)
// Purpose: Warn if MCP recently failed
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseStdin, isDisabled } from "./parse-stdin.js";
try {
  if (isDisabled("mcp-health-check")) process.exit(0);
  const input = parseStdin();
  const healthFile = path.join(os.tmpdir(), "kadmon", "mcp-health.jsonl");
  if (!fs.existsSync(healthFile)) process.exit(0);
  const toolName = input.tool_name ?? "";
  const parts = toolName.split("__");
  const server = parts.length >= 2 ? parts[1] : "";
  if (!server) process.exit(0);

  // Aggregate on read: the shared file is now an append-only JSONL log
  // (mcp-health-failure.js), not a per-server JSON object, so failCount and
  // lastFailure are computed here from matching lines instead of being
  // stored fields. Matches the original semantics exactly: failCount is the
  // total number of recorded failures for this server (all-time within the
  // retained/rotated log), lastFailure is the most recent one. Malformed
  // lines (e.g. a torn write) are skipped rather than crashing the hook.
  const lines = fs
    .readFileSync(healthFile, "utf8")
    .split("\n")
    .filter(Boolean);
  let failCount = 0;
  let lastFailureMs = 0;
  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.server !== server) continue;
    failCount++;
    const ts = new Date(entry.timestamp).getTime();
    if (!Number.isNaN(ts) && ts > lastFailureMs) lastFailureMs = ts;
  }
  if (failCount === 0) process.exit(0);

  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  if (failCount > 2 && lastFailureMs > fiveMinAgo) {
    console.error(
      `\u{26A0}\u{FE0F} MCP server "${server}" has failed ${failCount} times recently.`,
    );
  }
} catch (err) {
  console.error(JSON.stringify({ error: `mcp-health-check: ${err instanceof Error ? err.message : String(err)}` }));
}
process.exit(0);
