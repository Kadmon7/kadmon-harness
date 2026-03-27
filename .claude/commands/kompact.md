---
description: Smart context compaction — audit, summarize, compact, reload essentials
---

## Purpose
Intelligent context compaction that preserves critical state and reloads essentials automatically. Replaces the manual flow of /context-budget → think → /compact → re-read files.

## Steps

### 1. Audit
Report current context state:
- Count tool calls this session from observations JSONL: `wc -l /tmp/kadmon/<session>/observations.jsonl`
- List the 5 most recently Read/Edited files from observations
- Run `git diff --stat` to check for uncommitted changes

### 2. Safety Check
Warn and ask for confirmation if:
- **Uncommitted changes** exist → "You have uncommitted changes. Consider /checkpoint first."
- **Last tool was Edit** → "You're mid-edit. Compacting now may lose context about your changes."
- **Active debugging** → Check observations for recent tool_fail events

If all clear: "Safety: OK — good time to compact."

### 3. Summarize Current Work
Before compacting, write a 2-3 line summary of:
- What task is currently in progress
- Which files are being actively worked on
- What the next step would be after compaction

Display this summary — it will survive compaction as part of the conversation.

### 4. Compact
Run the built-in `/compact` command. The `pre-compact-save` hook will automatically:
- Save tool count and file count to SQLite
- Increment compactionCount on the session

### 5. Reload Essentials
After compaction, automatically re-read these files:
- `scripts/lib/types.ts` — the vocabulary (always reload)
- The most recently edited file from observations (if any)
- Run `/dashboard` to restore awareness of harness state

## Output
```
/kompact Report:
━━━━━━━━━━━━━━━━━━━━━━
Audit:
  Tool calls: 287
  Files touched: 15
  Recent: state-store.ts, session-manager.ts, types.ts

Safety: OK (no uncommitted changes)

Summary: "Optimizing skill descriptions using skill-creator.
Working on: .claude/skills/*.md (Batch 2+3)
Next: commit optimized skills, then Phase 2 B-grade skills."

Compacting... done.

Reloaded:
  ✓ scripts/lib/types.ts
  ✓ .claude/skills/postgres-patterns.md (last edited)
  ✓ /dashboard
━━━━━━━━━━━━━━━━━━━━━━
```
