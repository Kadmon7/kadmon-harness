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

## Steps — 18 MANDATORY sources (do NOT skip any)

IMPORTANT: Every source below is MANDATORY. Execute ALL 18. Mark each [x] in the output.
Run independent steps in PARALLEL where marked.

### PARALLEL BLOCK A — Git State (run all 4 simultaneously)
1. **Git log**: Run `git log --oneline -15`
2. **Git diff**: Run `git diff --stat`
3. **Git stash**: Run `git stash list`
4. **Git branches**: Run `git branch`

### PARALLEL BLOCK B — Project State (run all 3 simultaneously)
5. **Dashboard**: Run `npx tsx scripts/dashboard.ts` (sessions, instincts, costs, hook health)
6. **Active tasks**: Call TaskList tool to check pending tasks
7. **Active plans**: Run `ls ~/.claude/plans/` and read any plan file names

### PARALLEL BLOCK C — Memory Deep Read (run all 3 simultaneously)
8. **Memory index**: Read `~/.claude/projects/C--Command-Center-Kadmon-Harness/memory/MEMORY.md`
9. **Feedback memories**: Read ALL `feedback_*.md` files in memory directory (behavioral corrections)
10. **Project + Gotcha memories**: Read ALL `project_*.md` files in memory directory (state + gotchas)

### PARALLEL BLOCK D — Documentation (run all 3 simultaneously)
11. **ADRs**: Run `ls docs/decisions/` and list titles
12. **Roadmap**: Read `docs/roadmap/v1.0-production.md` — scan for pending items in current milestone
13. **GitHub**: Run `gh pr list --limit 5` and `gh issue list --limit 5`

### PARALLEL BLOCK E — Harness Health (run all 5 simultaneously)
14. **Version**: Read `package.json` — extract version field
15. **Tests**: Run `npx vitest run --reporter=dot 2>&1 | tail -5` — get pass/fail count
16. **Observations errors**: Read `/tmp/kadmon/{session_id}/observations.jsonl` — count lines with `"error"`
17. **Component counts**: Run `ls .claude/agents/*.md | wc -l` and `ls .claude/skills/*.md | wc -l` and `ls .claude/commands/*.md | wc -l`
18. **Hook count**: Run `grep -c '"command"' .claude/settings.json` — count registered hooks

## Output Format
Present results as a structured checklist report:

```
## Kompas — Full Context Rebuild

### Checklist (18/18)
- [x] Git log — {N} recent commits, latest: {hash} {message}
- [x] Git diff — {N} uncommitted files
- [x] Git stash — {N} stashes
- [x] Git branches — {list}
- [x] Dashboard — {N} sessions, {N} instincts ({N} promotable), ${cost}
- [x] Tasks — {list or "none"}
- [x] Plans — {list or "none"}
- [x] Memory index — {N} files across {N} sections
- [x] Feedback memories — {N} files, critical: {list key reminders}
- [x] Project memories — {N} files, current state: {summary}
- [x] ADRs — {N} decisions, latest: {title}
- [x] Roadmap — {current milestone}, {N} pending items
- [x] GitHub — {N} PRs, {N} issues
- [x] Version — v{version}
- [x] Tests — {N} passing, {N} failing
- [x] Observations — {N} errors this session
- [x] Components — {N} agents, {N} skills, {N} commands
- [x] Hooks — {N} registered

### Key Findings
{List anything surprising, stale, or requiring attention}

### Critical Reminders (from feedback memories)
{Top 3 behavioral corrections to keep in mind}
```

## Rules
- This command is READ-ONLY — never modify files, commit, or write
- ALL 18 sources are MANDATORY — if one fails, note the error and continue
- Use PARALLEL BLOCKS to minimize token and time cost
- Keep output concise — summaries and counts, not full file contents
- Total context cost: ~10-15K tokens (acceptable for full rebuild)
- If checklist shows fewer than 18 [x] marks, something was skipped — go back and fix it
