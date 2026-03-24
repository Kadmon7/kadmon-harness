#!/usr/bin/env node
// Hook: pre-compact-save | Trigger: PreCompact (*)
// Purpose: Save session state snapshot before context compaction
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function main() {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8'));
    const sid = input.session_id ?? '';
    if (!sid) process.exit(0);

    const obsPath = path.join(os.tmpdir(), 'kadmon', sid, 'observations.jsonl');
    let fileCount = 0;
    let toolCount = 0;

    if (fs.existsSync(obsPath)) {
      const lines = fs.readFileSync(obsPath, 'utf8').split('\n').filter(Boolean);
      toolCount = lines.length;
      const files = new Set();
      for (const line of lines) {
        try {
          const e = JSON.parse(line);
          if (e.filePath) files.add(e.filePath);
        } catch {}
      }
      fileCount = files.size;
    }

    try {
      const { openDb, upsertSession, getSession } = await import('../../../dist/scripts/lib/state-store.js');
      await openDb();
      const session = getSession(sid);
      if (session) {
        upsertSession({ ...session, id: sid, compactionCount: (session.compactionCount ?? 0) + 1 });
      }
    } catch (dbErr) {
      console.error(JSON.stringify({ warn: `pre-compact-save db: ${dbErr.message}` }));
    }

    console.log(`Session state saved before compaction (${toolCount} tool calls, ${fileCount} files)`);
  } catch (err) { console.error(JSON.stringify({ error: `pre-compact-save: ${err.message}` })); }
  process.exit(0);
}
main();
