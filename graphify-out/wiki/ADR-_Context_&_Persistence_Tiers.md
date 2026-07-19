# ADR: Context & Persistence Tiers

> 17 nodes

## Key Concepts

- **ADR-001 Kadmon Harness v0.3 Foundations** (7 connections) — `docs/decisions/ADR-001-v03-foundations.md`
- **kerka Agent** (6 connections) — `docs/decisions/ADR-009-deep-research-capability.md`
- **Token Budget Advisor** (3 connections) — `.claude/skills/token-budget-advisor/SKILL.md`
- **No Bash Scripts, No Python** (3 connections) — `docs/decisions/ADR-001-v03-foundations.md`
- **fetchYouTubeTranscript yt-dlp Helper** (3 connections) — `docs/decisions/ADR-009-deep-research-capability.md`
- **Route A — Media (multi-site yt-dlp)** (3 connections) — `docs/decisions/ADR-016-skavenger-slim-refactor.md`
- **Four Response Depth Levels (25/50/75/100)** (2 connections) — `.claude/skills/token-budget-advisor/SKILL.md`
- **Dual Persistence (SQLite write-first, Supabase deferred)** (2 connections) — `docs/decisions/ADR-001-v03-foundations.md`
- **Three-Tier Context Management** (2 connections) — `docs/decisions/ADR-001-v03-foundations.md`
- **Prompt-Enforced Iteration Caps** (2 connections) — `docs/decisions/ADR-009-deep-research-capability.md`
- **KADMON_RUNTIME_ROOT Env Var Contract** (2 connections) — `docs/decisions/ADR-010-harness-distribution-hybrid.md`
- **YouTube-Is-Protected Non-Regression Invariant** (2 connections) — `docs/decisions/ADR-016-skavenger-slim-refactor.md`
- **Token Estimation Heuristic (words x1.3 / chars/4)** (1 connections) — `.claude/skills/token-budget-advisor/SKILL.md`
- **Single Hook Profile** (1 connections) — `docs/decisions/ADR-001-v03-foundations.md`
- **no-context-guard PreToolUse Hook** (1 connections) — `docs/decisions/ADR-001-v03-foundations.md`
- **/research Command** (1 connections) — `docs/decisions/ADR-009-deep-research-capability.md`
- **Chain-Rule Violation (cataloged-but-unexecutable skill)** (1 connections) — `docs/decisions/ADR-009-deep-research-capability.md`

## Relationships

- [ADR Cluster](ADR_Cluster.md) (3 shared connections)
- [ADR: Research Capability Lineage](ADR-_Research_Capability_Lineage.md) (2 shared connections)
- [ADR: Forge-Evolve IPC](ADR-_Forge-Evolve_IPC.md) (1 shared connections)
- [ADR: Evolve Generate & Surface Audit](ADR-_Evolve_Generate_%26_Surface_Audit.md) (1 shared connections)
- [Systematic Debugging Skill](Systematic_Debugging_Skill.md) (1 shared connections)

## Source Files

- `.claude/skills/token-budget-advisor/SKILL.md`
- `docs/decisions/ADR-001-v03-foundations.md`
- `docs/decisions/ADR-009-deep-research-capability.md`
- `docs/decisions/ADR-010-harness-distribution-hybrid.md`
- `docs/decisions/ADR-016-skavenger-slim-refactor.md`

## Audit Trail

- EXTRACTED: 35 (83%)
- INFERRED: 7 (17%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*