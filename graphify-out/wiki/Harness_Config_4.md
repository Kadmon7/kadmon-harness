# Harness Config

> 14 nodes

## Key Concepts

- **session-end-all Hook (consolidated Stop)** (7 connections) — `.claude/hooks/CATALOG.md`
- **Performance Rules** (7 connections) — `.claude/rules/common/performance.md`
- **/forge 8-Step Pipeline (Read/Extract/Reinforce/Evaluate/Cluster/Gate/Apply/Report)** (6 connections) — `.claude/commands/forge.md`
- **/kompact Command** (6 connections) — `.claude/commands/kompact.md`
- **/forge Command** (5 connections) — `.claude/commands/forge.md`
- **pre-compact-save Hook** (5 connections) — `.claude/hooks/CATALOG.md`
- **/evolve Step 6 Generate (CWD-aware artifact generation)** (4 connections) — `.claude/commands/evolve.md`
- **ClusterReport (domain-grouped instincts, computed not stored)** (4 connections) — `.claude/commands/forge.md`
- **/kompact Context Audit (observations + archive scan)** (4 connections) — `.claude/commands/kompact.md`
- **/kompact Pre-Compaction Safety Check** (3 connections) — `.claude/commands/kompact.md`
- **evaluate-patterns-shared Module** (3 connections) — `.claude/hooks/CATALOG.md`
- **Context Window Budget Rules** (3 connections) — `.claude/rules/common/performance.md`
- **Transactional Batch Abort on Target-Path Collision (ADR-008)** (1 connections) — `.claude/commands/evolve.md`
- **Instinct Promote/Prune Thresholds** (1 connections) — `.claude/commands/forge.md`

## Relationships

- [Harness Config](Harness_Config.md) (8 shared connections)
- [Hook Catalog Registry](Hook_Catalog_Registry.md) (8 shared connections)
- [Command Docs: Skavenger](Command_Docs-_Skavenger.md) (2 shared connections)
- [Command Docs](Command_Docs.md) (1 shared connections)

## Source Files

- `.claude/commands/evolve.md`
- `.claude/commands/forge.md`
- `.claude/commands/kompact.md`
- `.claude/hooks/CATALOG.md`
- `.claude/rules/common/performance.md`

## Audit Trail

- EXTRACTED: 51 (86%)
- INFERRED: 8 (14%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*