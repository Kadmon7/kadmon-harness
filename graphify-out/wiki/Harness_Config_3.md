# Harness Config

> 14 nodes

## Key Concepts

- **/chekpoint Command** (14 connections) — `.claude/commands/chekpoint.md`
- **DiffScope Gating Object (8 boolean gates + rationale)** (4 connections) — `.claude/commands/chekpoint.md`
- **/chekpoint Tier Matrix (authoritative table)** (4 connections) — `.claude/rules/common/development-workflow.md`
- **Mandatory Reviewed: full|lite|skip Commit Footer** (4 connections) — `.claude/rules/common/git-workflow.md`
- **Phase 1 — Language-Aware Verification** (3 connections) — `.claude/commands/chekpoint.md`
- **Phase 2a — Parallel Specialist Review** (3 connections) — `.claude/commands/chekpoint.md`
- **Phase 3 — Dual-Check BLOCK Gate** (3 connections) — `.claude/commands/chekpoint.md`
- **Phase 4 — Commit and Push** (3 connections) — `.claude/commands/chekpoint.md`
- **getDiffScope Runtime Authority (ADR-034)** (3 connections) — `.claude/rules/common/development-workflow.md`
- **/chekpoint Tier Selection (full/lite/skip)** (2 connections) — `.claude/commands/chekpoint.md`
- **Phase 2b — kody Consolidation** (2 connections) — `.claude/commands/chekpoint.md`
- **/chekpoint Reviewer Override Flags** (2 connections) — `.claude/commands/chekpoint.md`
- **AUD/R id Backlog Advisory NOTE (ADR-038 source-side backstop)** (2 connections) — `.claude/commands/chekpoint.md`
- **Unknown-Language Toolchain Skip (avoid manufactured false FAILs)** (2 connections) — `.claude/commands/medik.md`

## Relationships

- [Harness Config](Harness_Config.md) (8 shared connections)
- [Hook Catalog Registry](Hook_Catalog_Registry.md) (4 shared connections)
- [Command Docs](Command_Docs.md) (3 shared connections)

## Source Files

- `.claude/commands/chekpoint.md`
- `.claude/commands/medik.md`
- `.claude/rules/common/development-workflow.md`
- `.claude/rules/common/git-workflow.md`

## Audit Trail

- EXTRACTED: 45 (88%)
- INFERRED: 6 (12%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*