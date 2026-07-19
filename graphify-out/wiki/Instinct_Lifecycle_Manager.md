# Instinct Lifecycle Manager

> 22 nodes

## Key Concepts

- **nowISO()** (33 connections) — `scripts/lib/utils.ts`
- **upsertInstinct()** (25 connections) — `scripts/lib/state-store/instincts.ts`
- **instinct-manager.ts** (21 connections) — `scripts/lib/instinct-manager.ts`
- **getActiveInstincts()** (19 connections) — `scripts/lib/state-store/instincts.ts`
- **instincts.ts** (15 connections) — `scripts/lib/state-store/instincts.ts`
- **instinct-lifecycle-e2e.test.ts** (14 connections) — `tests/eval/instinct-lifecycle-e2e.test.ts`
- **instinct-manager.test.ts** (14 connections) — `tests/lib/instinct-manager.test.ts`
- **getInstinct()** (13 connections) — `scripts/lib/state-store/instincts.ts`
- **promoteToGlobal()** (8 connections) — `scripts/lib/instinct-manager.ts`
- **getPromotableInstincts()** (7 connections) — `scripts/lib/state-store/instincts.ts`
- **createInstinct()** (6 connections) — `scripts/lib/instinct-manager.ts`
- **reinforceInstinct()** (6 connections) — `scripts/lib/instinct-manager.ts`
- **contradictInstinct()** (6 connections) — `scripts/lib/instinct-manager.ts`
- **promoteInstinct()** (6 connections) — `scripts/lib/instinct-manager.ts`
- **mapInstinctRow()** (6 connections) — `scripts/lib/state-store/instincts.ts`
- **getCrossProjectPromotionCandidates()** (6 connections) — `scripts/lib/state-store/instincts.ts`
- **cross-project-promotion.test.ts** (6 connections) — `tests/lib/cross-project-promotion.test.ts`
- **applyForgePreview()** (5 connections) — `scripts/lib/forge-pipeline.ts`
- **pruneInstincts()** (5 connections) — `scripts/lib/instinct-manager.ts`
- **getInstinctSummary()** (4 connections) — `scripts/lib/instinct-manager.ts`
- **decayInstincts()** (3 connections) — `scripts/lib/instinct-manager.ts`
- **seed()** (2 connections) — `tests/lib/cross-project-promotion.test.ts`

## Relationships

- [Agent Invocation Telemetry](Agent_Invocation_Telemetry.md) (20 shared connections)
- [Forge Pipeline](Forge_Pipeline.md) (17 shared connections)
- [SQLite State Store Core](SQLite_State_Store_Core.md) (15 shared connections)
- [Session Lifecycle Manager](Session_Lifecycle_Manager.md) (11 shared connections)
- [Lib Tests](Lib_Tests.md) (8 shared connections)
- [CLI Dashboard Rendering](CLI_Dashboard_Rendering.md) (6 shared connections)
- [Forge Report Writer](Forge_Report_Writer.md) (5 shared connections)
- [Evolve Generate Pipeline](Evolve_Generate_Pipeline.md) (4 shared connections)
- [Shared Type Definitions](Shared_Type_Definitions.md) (2 shared connections)
- [Research Report Storage](Research_Report_Storage.md) (2 shared connections)
- [Dashboard Web Server](Dashboard_Web_Server.md) (1 shared connections)
- [Lib Cluster](Lib_Cluster.md) (1 shared connections)

## Source Files

- `scripts/lib/forge-pipeline.ts`
- `scripts/lib/instinct-manager.ts`
- `scripts/lib/state-store/instincts.ts`
- `scripts/lib/utils.ts`
- `tests/eval/instinct-lifecycle-e2e.test.ts`
- `tests/lib/cross-project-promotion.test.ts`
- `tests/lib/instinct-manager.test.ts`

## Audit Trail

- EXTRACTED: 224 (97%)
- INFERRED: 6 (3%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*