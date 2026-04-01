---
description: Full context rebuild — search all 18 sources to restore orientation after compact, session start, or context loss
---

## Purpose
On-demand deep context recovery. Searches git, SQLite, memory, docs, and harness state to rebuild a complete picture of where we are. Use after compaction, at the start of long sessions, or when context feels incomplete.

## When to Use
- After a /kompact that cleared significant context
- At the start of a session where you need full project awareness
- When you feel "lost" mid-session and need to re-orient
- NOT needed for quick sessions or simple tasks (session-start hook provides basics)

## Steps

### Group 1: Git State
1. Run: `git log --oneline -15` (recent commits)
2. Run: `git diff --stat` (uncommitted changes)
3. Run: `git stash list` (forgotten stashed work)
4. Run: `git branch` (active branches, detect feature work)

### Group 2: Project State (SQLite + temp)
5. Run: `npx tsx scripts/dashboard.ts` (sessions, instincts, costs, hook health)
6. Check for active tasks via TaskList
7. Check for active plans in `~/.claude/plans/`

### Group 3: Memory Deep Read
8. Read `~/.claude/projects/C--Command-Center-Kadmon-Harness/memory/MEMORY.md` (index)
9. Read any memory files flagged as CRITICAL in the feedback section
10. Note memories older than 7 days that may be stale

### Group 4: Documentation
11. List ADR titles: `ls docs/decisions/`
12. Read roadmap current milestone: `docs/roadmap/` (scan for pending items)
13. Check GitHub: `gh pr list --limit 5` and `gh issue list --limit 5`

### Group 5: Harness Health
14. Read `package.json` for version
15. Count test files: `find tests/ -name "*.test.ts" | wc -l`
16. Check current observations for errors: scan `/tmp/kadmon/{session_id}/observations.jsonl` for failures

## Output Format
Present results as a structured report:

```
## Kompas — Full Context Rebuild

### Git (recent activity)
{15 recent commits}
Uncommitted: {count} files | Stashes: {count} | Branches: {list}

### Project State
{dashboard summary: sessions, instincts, costs}
Active tasks: {list or "none"}
Active plans: {list or "none"}

### Memory
{total files} memories | Critical reminders: {list}
Potentially stale (>7d): {list or "none"}

### Documentation
ADRs: {count} ({latest title})
Roadmap: {current milestone} — {N pending items}
GitHub: {N open PRs} | {N open issues}

### Harness Health
v{version} | {N} test files | Hook errors: {count}
```

## Rules
- This command is READ-ONLY — never modify files, commit, or write
- Run all 5 groups — do not skip any
- If a source is unavailable (no GitHub, no SQLite), note it and continue
- Keep output concise — summaries, not full file contents
- Total context cost: ~10-15K tokens (acceptable for full rebuild)
