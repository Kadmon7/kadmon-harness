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
  const healthFile = path.join(os.tmpdir(), "kadmon", "mcp-health.json");
  if (!fs.existsSync(healthFile)) process.exit(0);
  const health = JSON.parse(fs.readFileSync(healthFile, "utf8"));
  const toolName = input.tool_name ?? "";
  const parts = toolName.split("__");
  const server = parts.length >= 2 ? parts[1] : "";
  if (!server || !health[server]) process.exit(0);
  const entry = health[server];
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  if (
    entry.failCount > 2 &&
    new Date(entry.lastFailure).getTime() > fiveMinAgo
  ) {
    console.error(
      `\u{26A0}\u{FE0F} MCP server "${server}" has failed ${entry.failCount} times recently.`,
    );
  }
} catch (err) {
  console.error(JSON.stringify({ error: `mcp-health-check: ${err instanceof Error ? err.message : String(err)}` }));
}
process.exit(0);
