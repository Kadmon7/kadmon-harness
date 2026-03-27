#!/usr/bin/env node
// Hook: evaluate-session | Trigger: Stop (*)
// Purpose: Extract patterns from session and create/update instincts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { parseStdin } from './parse-stdin.js';

function gitExec(cmd, cwd) {
  try { return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
  catch { return null; }
}

async function main() {
  try {
    const input = parseStdin();
    const sid = input.session_id ?? '';
    const cwd = input.cwd ?? process.cwd();
    if (!sid) process.exit(0);

    const obsPath = path.join(os.tmpdir(), 'kadmon', sid, 'observations.jsonl');
    if (!fs.existsSync(obsPath)) process.exit(0);

    const lines = fs.readFileSync(obsPath, 'utf8').split('\n').filter(Boolean);
    if (lines.length < 10) process.exit(0); // too short to extract patterns

    // Detect project
    const remoteUrl = gitExec('git remote get-url origin', cwd);
    if (!remoteUrl) process.exit(0);
    const projectHash = crypto.createHash('sha256').update(remoteUrl).digest('hex').slice(0, 16);

    // Analyze patterns
    const toolSequences = [];
    for (const line of lines) {
      try { const e = JSON.parse(line); if (e.eventType === 'tool_pre') toolSequences.push(e.toolName); } catch {}
    }

    // Evaluate patterns using configurable engine
    let instinctsUpdated = 0;
    try {
      const { openDb, getActiveInstincts } = await import(new URL('../../../dist/scripts/lib/state-store.js', import.meta.url).href);
      const { createInstinct, reinforceInstinct } = await import(new URL('../../../dist/scripts/lib/instinct-manager.js', import.meta.url).href);
      const { evaluatePatterns, loadPatternDefinitions } = await import(new URL('../../../dist/scripts/lib/pattern-engine.js', import.meta.url).href);
      await openDb(process.env.KADMON_TEST_DB || undefined);

      // Load pattern definitions from JSON
      const defsPath = new URL('../pattern-definitions.json', import.meta.url);
      const definitions = loadPatternDefinitions(defsPath.pathname.replace(/^\/([A-Z]:)/, '$1'));
      const results = evaluatePatterns(definitions, toolSequences, lines);

      const existing = getActiveInstincts(projectHash);
      const existingPatterns = new Map(existing.map(i => [i.pattern, i]));

      function applyPattern(pattern, action) {
        if (existingPatterns.has(pattern)) {
          reinforceInstinct(existingPatterns.get(pattern).id, sid);
        } else {
          createInstinct(projectHash, pattern, action, sid);
        }
        instinctsUpdated++;
      }

      // Apply all triggered patterns
      for (const r of results) {
        if (r.triggered) applyPattern(r.name, r.action);
      }
    } catch (dbErr) {
      console.error(JSON.stringify({ warn: `evaluate-session db: ${dbErr.message}` }));
    }

    if (instinctsUpdated > 0) console.log(`Session evaluated: ${instinctsUpdated} instincts updated`);
  } catch (err) { console.error(JSON.stringify({ error: `evaluate-session: ${err.message}` })); }
  process.exit(0);
}
main();
