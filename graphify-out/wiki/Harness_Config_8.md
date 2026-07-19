# Harness Config

> 13 nodes

## Key Concepts

- **agent-eval Skill** (4 connections) — `.claude/skills/agent-eval/SKILL.md`
- **Ephemeral Test Database Rule** (3 connections) — `.claude/rules/common/testing.md`
- **Vitest Mocking Conventions (vi.fn, in-memory SQLite)** (3 connections) — `.claude/rules/typescript/testing.md`
- **YAML Task Definitions (pinned commit)** (3 connections) — `.claude/skills/agent-eval/SKILL.md`
- **Sandbox-Mode API Testing (DB-free)** (3 connections) — `.claude/skills/ai-regression-testing/SKILL.md`
- **pytest Fixtures + conftest.py Sharing** (2 connections) — `.claude/rules/python/testing.md`
- **Git Worktree Isolation for Eval Runs** (2 connections) — `.claude/skills/agent-eval/SKILL.md`
- **Eval Metrics (pass rate, cost, time, consistency)** (2 connections) — `.claude/skills/agent-eval/SKILL.md`
- **Judge Types (deterministic, pattern, LLM-as-judge)** (2 connections) — `.claude/skills/agent-eval/SKILL.md`
- **Mode 4 Before/After Baseline Comparison** (2 connections) — `.claude/skills/benchmark/SKILL.md`
- **Anchor Verification (never guess line numbers)** (2 connections) — `.claude/skills/code-tour/SKILL.md`
- **bug-check Workflow (tests before AI review)** (1 connections) — `.claude/skills/ai-regression-testing/SKILL.md`
- **Git-Tracked JSON Baseline Storage** (1 connections) — `.claude/skills/benchmark/SKILL.md`

## Relationships

- [Skill Docs](Skill_Docs.md) (2 shared connections)

## Source Files

- `.claude/rules/common/testing.md`
- `.claude/rules/python/testing.md`
- `.claude/rules/typescript/testing.md`
- `.claude/skills/agent-eval/SKILL.md`
- `.claude/skills/ai-regression-testing/SKILL.md`
- `.claude/skills/benchmark/SKILL.md`
- `.claude/skills/code-tour/SKILL.md`

## Audit Trail

- EXTRACTED: 20 (67%)
- INFERRED: 10 (33%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*