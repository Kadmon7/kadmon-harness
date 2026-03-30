---
name: verify-counts-from-filesystem
description: Always verify agent/hook/skill/command/test counts from the filesystem and test runner, not from prior doc state
type: feedback
---

Count sources for this project:
- Agents: `ls .claude/agents/*.md | wc -l`
- Skills: `ls .claude/skills/*.md | wc -l`
- Commands: `ls .claude/commands/*.md | wc -l`
- Hooks: `ls .claude/hooks/scripts/` (exclude `parse-stdin.js` — it is a shared helper, not a hook)
- Tests: `npx vitest run 2>&1 | grep "Tests "` (run the suite, read the summary line)
- Rules: `ls .claude/rules/**/*.md | wc -l`

**Why:** parse-stdin.js lives alongside hooks but is a utility module. Counting it would inflate the hook count by 1.

**How to apply:** Before updating any count in CLAUDE.md or README.md, run the filesystem check. Never copy counts from one doc to update another.
