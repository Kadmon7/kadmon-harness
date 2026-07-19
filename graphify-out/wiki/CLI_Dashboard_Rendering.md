# CLI Dashboard Rendering

> 30 nodes

## Key Concepts

- **dashboard.ts** (40 connections) — `scripts/lib/dashboard.ts`
- **dashboard.test.ts** (21 connections) — `tests/lib/dashboard.test.ts`
- **renderDashboard()** (20 connections) — `scripts/lib/dashboard.ts`
- **getInstinctCounts()** (7 connections) — `scripts/lib/state-store/instincts.ts`
- **getInstinctRows()** (6 connections) — `scripts/lib/dashboard.ts`
- **getSessionRows()** (4 connections) — `scripts/lib/dashboard.ts`
- **getModelCostRows()** (4 connections) — `scripts/lib/dashboard.ts`
- **ObservabilityEvent** (4 connections) — `scripts/lib/types.ts`
- **renderConfidenceBar()** (3 connections) — `scripts/lib/dashboard.ts`
- **getHookHealthRows()** (3 connections) — `scripts/lib/dashboard.ts`
- **getHookStatRows()** (3 connections) — `scripts/lib/dashboard.ts`
- **getAgentStatRows()** (3 connections) — `scripts/lib/dashboard.ts`
- **getDbStatus()** (3 connections) — `scripts/lib/dashboard.ts`
- **computeHealthScore()** (3 connections) — `scripts/lib/dashboard.ts`
- **fmtTokens()** (2 connections) — `scripts/lib/dashboard.ts`
- **fmtDuration()** (2 connections) — `scripts/lib/dashboard.ts`
- **fmtMs()** (2 connections) — `scripts/lib/dashboard.ts`
- **miniBar()** (2 connections) — `scripts/lib/dashboard.ts`
- **statusBadge()** (2 connections) — `scripts/lib/dashboard.ts`
- **sectionHeader()** (2 connections) — `scripts/lib/dashboard.ts`
- **separator()** (2 connections) — `scripts/lib/dashboard.ts`
- **InstinctRow** (1 connections) — `scripts/lib/dashboard.ts`
- **SessionRow** (1 connections) — `scripts/lib/dashboard.ts`
- **HookHealthRow** (1 connections) — `scripts/lib/dashboard.ts`
- **ModelCostRow** (1 connections) — `scripts/lib/dashboard.ts`
- *... and 5 more nodes in this community*

## Relationships

- [Agent Invocation Telemetry](Agent_Invocation_Telemetry.md) (9 shared connections)
- [CLI Dashboard & Evolve Reader](CLI_Dashboard_%26_Evolve_Reader.md) (8 shared connections)
- [Instinct Lifecycle Manager](Instinct_Lifecycle_Manager.md) (6 shared connections)
- [SQLite State Store Core](SQLite_State_Store_Core.md) (4 shared connections)
- [Lib Tests](Lib_Tests.md) (4 shared connections)
- [Shared Type Definitions](Shared_Type_Definitions.md) (3 shared connections)
- [Session Lifecycle Manager](Session_Lifecycle_Manager.md) (2 shared connections)
- [Forge Pipeline](Forge_Pipeline.md) (1 shared connections)

## Source Files

- `scripts/lib/dashboard.ts`
- `scripts/lib/state-store/instincts.ts`
- `scripts/lib/types.ts`
- `tests/lib/dashboard.test.ts`

## Audit Trail

- EXTRACTED: 147 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*