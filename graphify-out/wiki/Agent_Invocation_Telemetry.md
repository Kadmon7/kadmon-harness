# Agent Invocation Telemetry

> 35 nodes

## Key Concepts

- **getDb()** (70 connections) — `scripts/lib/state-store/core.ts`
- **state-store.test.ts** (18 connections) — `tests/lib/state-store.test.ts`
- **agent-invocations.ts** (14 connections) — `scripts/lib/state-store/agent-invocations.ts`
- **hook-events.ts** (14 connections) — `scripts/lib/state-store/hook-events.ts`
- **cost-events.ts** (12 connections) — `scripts/lib/state-store/cost-events.ts`
- **buildTelemetry()** (11 connections) — `scripts/lib/dashboard-web-data.ts`
- **sync-queue.ts** (10 connections) — `scripts/lib/state-store/sync-queue.ts`
- **migrate-fix-session-inversion.ts** (10 connections) — `scripts/migrate-fix-session-inversion.ts`
- **state-store-migration-cleanup.test.ts** (10 connections) — `tests/lib/state-store-migration-cleanup.test.ts`
- **migrate-fix-session-inversion.test.ts** (9 connections) — `tests/scripts/migrate-fix-session-inversion.test.ts`
- **getAgentInvocationStats()** (7 connections) — `scripts/lib/state-store/agent-invocations.ts`
- **getHookEventStats()** (7 connections) — `scripts/lib/state-store/hook-events.ts`
- **getAgentInvocationsBySession()** (6 connections) — `scripts/lib/state-store/agent-invocations.ts`
- **getCostSummaryByModel()** (6 connections) — `scripts/lib/state-store/cost-events.ts`
- **getHookEventsBySession()** (5 connections) — `scripts/lib/state-store/hook-events.ts`
- **main()** (5 connections) — `scripts/migrate-fix-session-inversion.ts`
- **getCostBySession()** (4 connections) — `scripts/lib/state-store/cost-events.ts`
- **markSynced()** (4 connections) — `scripts/lib/state-store/sync-queue.ts`
- **runMigration()** (4 connections) — `scripts/migrate-fix-session-inversion.ts`
- **cleanupDuplicateAgentInvocations()** (3 connections) — `scripts/lib/state-store/agent-invocations.ts`
- **cleanupDuplicateHookEvents()** (3 connections) — `scripts/lib/state-store/hook-events.ts`
- **queueSync()** (3 connections) — `scripts/lib/state-store/sync-queue.ts`
- **getPendingSync()** (3 connections) — `scripts/lib/state-store/sync-queue.ts`
- **mapAgentInvocationRow()** (2 connections) — `scripts/lib/state-store/agent-invocations.ts`
- **mapCostRow()** (2 connections) — `scripts/lib/state-store/cost-events.ts`
- *... and 10 more nodes in this community*

## Relationships

- [SQLite State Store Core](SQLite_State_Store_Core.md) (26 shared connections)
- [Instinct Lifecycle Manager](Instinct_Lifecycle_Manager.md) (20 shared connections)
- [Lib Tests](Lib_Tests.md) (20 shared connections)
- [Session Lifecycle Manager](Session_Lifecycle_Manager.md) (19 shared connections)
- [CLI Dashboard Rendering](CLI_Dashboard_Rendering.md) (9 shared connections)
- [Shared Type Definitions](Shared_Type_Definitions.md) (8 shared connections)
- [Research Report Storage](Research_Report_Storage.md) (8 shared connections)
- [Dashboard Web Server](Dashboard_Web_Server.md) (7 shared connections)
- [DB Health Check](DB_Health_Check.md) (3 shared connections)
- [Medik Checks CLI Runner](Medik_Checks_CLI_Runner.md) (3 shared connections)
- [Medik Capability Alignment](Medik_Capability_Alignment.md) (2 shared connections)

## Source Files

- `scripts/lib/dashboard-web-data.ts`
- `scripts/lib/state-store/agent-invocations.ts`
- `scripts/lib/state-store/core.ts`
- `scripts/lib/state-store/cost-events.ts`
- `scripts/lib/state-store/hook-events.ts`
- `scripts/lib/state-store/sync-queue.ts`
- `scripts/migrate-fix-session-inversion.ts`
- `tests/lib/state-store-migration-cleanup.test.ts`
- `tests/lib/state-store.test.ts`
- `tests/scripts/migrate-fix-session-inversion.test.ts`

## Audit Trail

- EXTRACTED: 249 (98%)
- INFERRED: 6 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*