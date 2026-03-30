---
description: Smart context compaction — audit, summarize, compact, reload essentials
---

## Purpose
Intelligent context compaction that preserves critical state. Replaces the manual flow of /context-budget → think → /compact → re-read files.

## Steps

### 1. Audit
Report current context state:
- Count tool calls this session from observations JSONL — use pipes to avoid `$()` permission prompts:
  - `ls -td /tmp/kadmon/*/ 2>/dev/null | head -1 | xargs -I{} wc -l {}observations.jsonl`
  - `ls -td /tmp/kadmon/*/ 2>/dev/null | head -1 | xargs -I{} grep -o '"file_path":"[^"]*"' {}observations.jsonl | sort | uniq -c | sort -rn | head -5`
- Run `git diff --stat` to check for uncommitted changes

### 2. Safety Check
Warn and ask for confirmation if:
- **Uncommitted changes** exist → "You have uncommitted changes. Consider /checkpoint first."
- **Last tool was Edit** → "You're mid-edit. Compacting now may lose context about your changes."
- **Active debugging** → Check observations for recent tool_fail events
- **Productive session (>30 tool calls) without /learn** → "Consider /learn first to capture patterns before compacting."

If all clear: "Safety: OK — good time to compact."

### 3. Summarize Current Work
Before compacting, write a summary that includes:
- What task is currently in progress
- Which files are being actively worked on
- What the next step would be after compaction
- **Files to reload after compact:** list the 1-2 most important files to re-read (e.g., `scripts/lib/types.ts`, the last edited file)

Display this summary — it will survive compaction as part of the conversation and serve as a reload guide.

### 4. Compact
Tell the user to run `/compact` — do NOT attempt to execute it (it is a built-in CLI command that cannot be called programmatically).
Display: `Ready to compact. Run: /compact`
Then STOP and wait. The `pre-compact-save` hook will automatically save session state to SQLite.

## Output
```
/kompact Report:
━━━━━━━━━━━━━━━━━━━━━━
Audit:
  Tool calls: 287
  Files touched: 15
  Recent: state-store.ts, session-manager.ts, types.ts

Safety: OK (no uncommitted changes)

Summary:
  Task: Optimizing skill descriptions using skill-creator.
  Working on: .claude/skills/*.md (Batch 2+3)
  Next: commit optimized skills, then Phase 2 B-grade skills.
  Reload after compact: scripts/lib/types.ts, .claude/skills/postgres-patterns.md

Ready to compact. Run: /compact
━━━━━━━━━━━━━━━━━━━━━━
```
