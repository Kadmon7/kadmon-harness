#!/usr/bin/env node
// Hook: mcp-health-failure | Trigger: PostToolUseFailure (mcp__*)
// Purpose: Record MCP failure for health tracking
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const healthFile = path.join(os.tmpdir(), 'kadmon', 'mcp-health.json');
  const dir = path.dirname(healthFile);
  fs.mkdirSync(dir, { recursive: true });
  let health = {};
  try { health = JSON.parse(fs.readFileSync(healthFile, 'utf8')); } catch {}
  const parts = (input.tool_name ?? '').split('__');
  const server = parts.length >= 2 ? parts[1] : 'unknown';
  if (!health[server]) health[server] = { failCount: 0, lastFailure: null };
  health[server].failCount++;
  health[server].lastFailure = new Date().toISOString();
  fs.writeFileSync(healthFile, JSON.stringify(health, null, 2));
} catch (err) { console.error(JSON.stringify({ error: `mcp-health-failure: ${err.message}` })); }
process.exit(0);
