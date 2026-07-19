# Agent Docs

> 11 nodes

## Key Concepts

- **arkonte (Performance, sonnet)** (4 connections) — `.claude/agents/arkonte.md`
- **Profile detection via detectSkannerProfile (harness|web|cli, arg > env > markers)** (4 connections) — `.claude/agents/arkonte.md`
- **kartograf (E2E Testing, sonnet)** (4 connections) — `.claude/agents/kartograf.md`
- **3-layer documentation model (public docs / commands / skills+agents; rules out of scope)** (3 connections) — `.claude/agents/doks.md`
- **Vitest no longer sweeps agent worktrees (.claude/worktrees excluded)** (3 connections) — `CHANGELOG.md`
- **Hook latency budget (observe <50ms, guard <100ms, others <500ms; +236ms Windows cold start)** (2 connections) — `.claude/agents/arkonte.md`
- **Per-layer write-eligibility via detectProjectProfile (harness vs consumer)** (2 connections) — `.claude/agents/doks.md`
- **kartograf profile detection (harness|web|cli, warn when forced profile lacks markers)** (2 connections) — `.claude/agents/kartograf.md`
- **Flaky test handling (5-run detection, quarantine with tracking comment)** (2 connections) — `.claude/agents/kartograf.md`
- **Profile-Analyze-Optimize-Verify (never guess the bottleneck)** (1 connections) — `.claude/agents/arkonte.md`
- **Locator + wait strategy (semantic locators, wait for conditions not time)** (1 connections) — `.claude/agents/kartograf.md`

## Relationships

- [Architect & Alchemist Agents](Architect_%26_Alchemist_Agents.md) (4 shared connections)
- [Agent Docs](Agent_Docs.md) (2 shared connections)
- [Backlog & Release Notes](Backlog_%26_Release_Notes.md) (1 shared connections)
- [Agent Docs: Doks Catalog](Agent_Docs-_Doks_Catalog.md) (1 shared connections)

## Source Files

- `.claude/agents/arkonte.md`
- `.claude/agents/doks.md`
- `.claude/agents/kartograf.md`
- `CHANGELOG.md`

## Audit Trail

- EXTRACTED: 20 (71%)
- INFERRED: 8 (29%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*