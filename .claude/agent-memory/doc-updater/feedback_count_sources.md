---
name: verify-counts-from-filesystem
description: Always verify agent/hook/skill/command/test counts from the filesystem and test runner, not from prior doc state
type: feedback
---

Count sources for this project:
- Agents: `ls .claude/agents/*.md | wc -l`
- Skills: `ls .claude/skills/*.md | wc -l`
- Commands: `ls .claude/commands/*.md | wc -l`
- Hooks: count entries in `.claude/settings.json` (grep '"command"'). The scripts/ dir has 25 files but 3 are helpers: `parse-stdin.js`, `evaluate-patterns-shared.js`, `generate-session-summary.js`. Registered hooks = 22.
- Tests: `npx vitest run 2>&1 | grep "Tests "` (run the suite, read the summary line)
- Test files: `find tests/ -name "*.test.ts" | wc -l`
- Rules: `ls .claude/rules/common/ | wc -l` + `ls .claude/rules/typescript/ | wc -l`
- ADRs: `ls docs/decisions/ | wc -l`

**Why:** helpers live alongside hooks in scripts/ but are utility modules imported by hooks. The authoritative hook count is what settings.json registers.

**Recurring discrepancies found 2026-03-31:**
- GUIDE.md had 14 rules instead of 15
- GUIDE.md auto memory listed 4 types instead of 6
- GUIDE.md hooks section was missing 7 hooks (commit-quality, commit-format-guard, git-push-reminder, ts-review-reminder, console-log-warn, pr-created, session-end-marker)
- REFERENCE.md tests section showed 101 tests in 14 files (stale from before v0.3)
- REFERENCE.md had 5 ADRs instead of 6 (ADR-006 was added but not documented)
- CLAUDE.md Quick Start said "146+ tests"

**How to apply:** Before updating any count in CLAUDE.md or README.md, run the filesystem check. Never copy counts from one doc to update another. Always check ALL 4 docs (CLAUDE.md, README.md, GUIDE.md, REFERENCE.md) — they drift independently.
