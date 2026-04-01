# ADR-007: Post-Compact Context Reinjection and Daily Session Logs

## Status
Accepted

## Context
After compaction, Claude retains Tier 1 context (rules, CLAUDE.md, MEMORY.md) but loses all conversation state: what was being worked on, behavioral corrections received during the session, files being edited, and pending tasks. The pre-compact-save hook writes to SQLite, but nothing reads it back. The session-start hook already detects post-compact scenarios (session-manager.ts L17-28: existing session found means compaction occurred), but it only outputs session history -- not the current session's state.

Session summaries in SQLite are 1-2 line heuristic strings, too sparse to reconstruct working context. Observations.jsonl has rich data but is ephemeral and not human-readable across sessions.

## Decision

### 1. Post-Compact Context Reinjection via SessionStart
Claude Code does NOT have a PostCompact hook event. However, SessionStart fires after compaction (verified: session-manager.ts merges existing session and increments compactionCount). The session-start hook already detects this case.

**Approach**: Enhance session-start.js to detect compactionCount > 0 (post-compact) and output a richer context block including:
- Current session's summary, pending tasks, and top files from SQLite
- Active feedback memories (read from `~/.claude/projects/.../memory/feedback_*.md`)
- Git status (already present)

This uses stdout -- the only mechanism hooks have to inject text into Claude's context.

**No new hook script needed.** Modify session-start.js only.

### 2. Daily Session Logs
**Location**: `~/.claude/projects/C--Command-Center-Kadmon-Harness/memory/logs/YYYY-MM-DD.md`

Rationale: Lives inside the auto-memory directory (already gitignored, user-scoped, survives across sessions). NOT git-tracked in the repo (logs are personal, not project architecture). NOT in /tmp (would be lost on reboot). The `logs/` subdirectory avoids polluting the memory root.

**Writers**: pre-compact-save.js (append before compact) and session-end-all.js (append at session end).

**Format**:
```markdown
# 2026-03-31

## Session abc12345 (10:30 - 12:45)
- Branch: feat/memory-improvements
- Summary: Edited 5 files: session-start.js, pre-compact-save.js...
- Commits: feat(hooks): add post-compact reinjection
- Files: session-start.js (4 edits), pre-compact-save.js (2 edits)
- Pending: Implement daily log auto-loading
- Cost: $0.42 (opus: 12K in, 8K out)
```

**Auto-loading**: session-start.js reads today's log file (if exists) and appends it to the output block under `## Today's Log`. Yesterday's log is NOT auto-loaded (diminishing returns vs context cost; previous session summary already covers it).

### 3. Memory Flush Pre-Compact
**Not a separate feature.** The pre-compact-save hook already generates a summary from observations. The enhancement is: after generating the summary, append it to today's daily log file. This is a 10-line addition to pre-compact-save.js, not a new hook.

## Architecture

```
                  PreCompact                    SessionStart (post-compact)
                     |                                |
          pre-compact-save.js                  session-start.js
           |              |                     |            |
     SQLite upsert   Append to daily log   Read SQLite   Read daily log
                      (logs/YYYY-MM-DD.md)     |         Read feedback_*.md
                                               |            |
                                          stdout: rich context block
                                          (pending tasks, files, feedback)
```

## File Changes

| File | Change |
|------|--------|
| `.claude/hooks/scripts/session-start.js` | Detect post-compact (compactionCount > 0), read current session from SQLite, read today's log, read feedback memories, output enriched context |
| `.claude/hooks/scripts/pre-compact-save.js` | After SQLite upsert, append session block to `logs/YYYY-MM-DD.md` |
| `.claude/hooks/scripts/session-end-all.js` | After persist phase, append session block to `logs/YYYY-MM-DD.md` |
| `scripts/lib/types.ts` | No changes needed (SessionSummary already has all required fields) |
| `.claude/settings.json` | No changes needed (no new hooks) |

## Consequences
- **Context retention**: ~+12% estimated (feedback reminders + current work state + daily log)
- **No new hook scripts**: All changes are enhancements to 3 existing files
- **No new hook events**: Uses SessionStart's existing post-compact detection
- **No breaking changes**: Daily logs are additive; session-start output is additive
- **Latency**: Daily log append is a single fs.appendFileSync (~5ms). Reading feedback files adds ~20ms to session-start (glob + read 5-10 small .md files). Well within 500ms budget.
- **Risk**: Daily log files grow unbounded. Mitigation: session-start.js only reads today's file; old logs are harmless disk usage. Optional future cleanup after 30 days.
- **Risk**: Feedback memory files could be renamed/deleted. Mitigation: glob for `feedback_*.md` pattern, graceful fallback if none found.
- **Review date**: 2026-04-15 (after 2 weeks of usage)
