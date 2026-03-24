#!/usr/bin/env node
// Hook: observe-pre | Trigger: PreToolUse (*)
// Purpose: Append tool call metadata to observations JSONL. Target: <50ms
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const sid = input.session_id ?? '';
  if (!sid) process.exit(0);
  const dir = path.join(os.tmpdir(), 'kadmon', sid);
  fs.mkdirSync(dir, { recursive: true });
  const event = {
    timestamp: new Date().toISOString(),
    sessionId: sid,
    eventType: 'tool_pre',
    toolName: input.tool_name ?? '',
    filePath: input.tool_input?.file_path ?? input.tool_input?.path ?? null,
    metadata: { command: input.tool_input?.command ?? null },
  };
  fs.appendFileSync(path.join(dir, 'observations.jsonl'), JSON.stringify(event) + '\n');
} catch (err) { console.error(JSON.stringify({ error: `observe-pre: ${err.message}` })); }
process.exit(0);
