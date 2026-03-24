#!/usr/bin/env node
// Hook: suggest-compact | Trigger: PreToolUse (*)
// Purpose: Suggest /compact when tool count gets high
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const sid = input.session_id ?? '';
  if (!sid) process.exit(0);
  const countFile = path.join(os.tmpdir(), 'kadmon', sid, 'tool_count.txt');
  let count = 0;
  try { count = parseInt(fs.readFileSync(countFile, 'utf8'), 10) || 0; } catch {}
  count++;
  fs.mkdirSync(path.dirname(countFile), { recursive: true });
  fs.writeFileSync(countFile, String(count));
  if (count > 50 && count % 10 === 0) {
    console.log(`Context getting large (${count} tool calls). Consider running /compact.`);
  }
} catch (err) { console.error(JSON.stringify({ error: `suggest-compact: ${err.message}` })); }
process.exit(0);
