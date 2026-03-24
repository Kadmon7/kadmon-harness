#!/usr/bin/env node
// Hook: session-start | Trigger: SessionStart (*)
// Purpose: Load previous context, initialize session
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

function gitExec(cmd, cwd) {
  try { return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
  catch { return null; }
}

async function main() {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8'));
    const sid = input.session_id ?? '';
    const cwd = input.cwd ?? process.cwd();
    if (!sid) process.exit(0);

    // Detect project
    const remoteUrl = gitExec('git remote get-url origin', cwd);
    if (!remoteUrl) { console.log('Kadmon: Not in a git repo — session tracking disabled.'); process.exit(0); }
    const projectHash = crypto.createHash('sha256').update(remoteUrl).digest('hex').slice(0, 16);
    const branch = gitExec('git branch --show-current', cwd) ?? 'unknown';

    // Initialize session dir
    const sessionDir = path.join(os.tmpdir(), 'kadmon', sid);
    fs.mkdirSync(sessionDir, { recursive: true });

    // Try loading previous session context from SQLite
    let context = '';
    let instinctCount = 0;
    try {
      const { openDb, getRecentSessions, getActiveInstincts } = await import('../../../dist/scripts/lib/state-store.js');
      await openDb();
      const sessions = getRecentSessions(projectHash, 1);
      const instincts = getActiveInstincts(projectHash);
      instinctCount = instincts.length;

      if (sessions.length > 0) {
        const last = sessions[0];
        context += `\n## Previous Session\n- Date: ${last.startedAt}\n- Branch: ${last.branch}`;
        if (last.tasks.length) context += `\n- Tasks: ${last.tasks.join(', ')}`;
        context += `\n- Files modified: ${last.filesModified.length}`;
      }

      if (instincts.length > 0) {
        context += `\n\n## Active Instincts (${instincts.length})`;
        for (const inst of instincts.slice(0, 5)) {
          context += `\n- [${inst.confidence.toFixed(1)}] ${inst.pattern}`;
        }
      }

      // Start new session
      const { startSession } = await import('../../../dist/scripts/lib/session-manager.js');
      startSession(sid, { projectHash, remoteUrl, branch, rootDir: cwd });
    } catch (dbErr) {
      console.error(JSON.stringify({ warn: `session-start db: ${dbErr.message}` }));
    }

    console.log(`## Kadmon Session Started\n- Project: ${projectHash}\n- Branch: ${branch}\n- Instincts: ${instinctCount}${context}`);
  } catch (err) { console.error(JSON.stringify({ error: `session-start: ${err.message}` })); }
  process.exit(0);
}
main();
