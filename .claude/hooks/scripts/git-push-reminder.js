#!/usr/bin/env node
// Hook: git-push-reminder | Trigger: PreToolUse (Bash)
// Purpose: Print review reminder before git push
import { parseStdin } from './parse-stdin.js';
try {
  const input = parseStdin();
  const cmd = input.tool_input?.command ?? '';
  if (cmd.includes('git push')) {
    console.log('Pre-push checklist: tests passing? typecheck clean? CLAUDE.md updated?');
  }
} catch (err) { console.error(JSON.stringify({ error: `git-push-reminder: ${err.message}` })); }
process.exit(0);
