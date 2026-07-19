# DB Health Check

> 13 nodes

## Key Concepts

- **db-health.ts** (14 connections) — `scripts/lib/db-health.ts`
- **db-health-check.ts** (6 connections) — `scripts/db-health-check.ts`
- **getDbHealthReport()** (5 connections) — `scripts/lib/db-health.ts`
- **detectAnomalies()** (3 connections) — `scripts/lib/db-health.ts`
- **report** (1 connections) — `scripts/db-health-check.ts`
- **TABLES** (1 connections) — `scripts/lib/db-health.ts`
- **TableName** (1 connections) — `scripts/lib/db-health.ts`
- **FRESHNESS_COLUMN** (1 connections) — `scripts/lib/db-health.ts`
- **SessionRow** (1 connections) — `scripts/lib/db-health.ts`
- **HookStat** (1 connections) — `scripts/lib/db-health.ts`
- **AgentStat** (1 connections) — `scripts/lib/db-health.ts`
- **CostStat** (1 connections) — `scripts/lib/db-health.ts`
- **DbHealthReport** (1 connections) — `scripts/lib/db-health.ts`

## Relationships

- [SQLite State Store Core](SQLite_State_Store_Core.md) (4 shared connections)
- [Agent Invocation Telemetry](Agent_Invocation_Telemetry.md) (3 shared connections)
- [Lib Tests](Lib_Tests.md) (2 shared connections)

## Source Files

- `scripts/db-health-check.ts`
- `scripts/lib/db-health.ts`

## Audit Trail

- EXTRACTED: 37 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*