#!/usr/bin/env node
// Hook: mcp-health-check | Trigger: PreToolUse (mcp__*)
// Purpose: Warn if MCP recently failed
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseStdin } from './parse-stdin.js';
try {
  const input = parseStdin();
  const healthFile = path.join(os.tmpdir(), 'kadmon', 'mcp-health.json');
  if (!fs.existsSync(healthFile)) process.exit(0);
  const health = JSON.parse(fs.readFileSync(healthFile, 'utf8'));
  const toolName = input.tool_name ?? '';
  const parts = toolName.split('__');
  const server = parts.length >= 2 ? parts[1] : '';
  if (!server || !health[server]) process.exit(0);
  const entry = health[server];
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  if (entry.failCount > 2 && new Date(entry.lastFailure).getTime() > fiveMinAgo) {
    console.log(`Warning: MCP server "${server}" has failed ${entry.failCount} times recently.`);
  }
} catch (err) { console.error(JSON.stringify({ error: `mcp-health-check: ${err.message}` })); }
process.exit(0);
