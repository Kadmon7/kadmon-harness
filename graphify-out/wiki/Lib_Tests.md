# Lib Tests

> 14 nodes

## Key Concepts

- **upsertSession()** (18 connections) — `scripts/lib/state-store/sessions.ts`
- **generateId()** (14 connections) — `scripts/lib/utils.ts`
- **dashboard-web-data.test.ts** (14 connections) — `tests/lib/dashboard-web-data.test.ts`
- **insertHookEvent()** (11 connections) — `scripts/lib/state-store/hook-events.ts`
- **insertAgentInvocation()** (10 connections) — `scripts/lib/state-store/agent-invocations.ts`
- **db-health.test.ts** (10 connections) — `tests/lib/db-health.test.ts`
- **insertCostEvent()** (9 connections) — `scripts/lib/state-store/cost-events.ts`
- **state-store-agent-invocations.test.ts** (8 connections) — `tests/lib/state-store-agent-invocations.test.ts`
- **state-store-hook-events.test.ts** (8 connections) — `tests/lib/state-store-hook-events.test.ts`
- **seedTelemetryFixtures()** (6 connections) — `tests/lib/dashboard-web-data.test.ts`
- **deleteSession()** (5 connections) — `scripts/lib/state-store/sessions.ts`
- **writeFrontmatterFile()** (2 connections) — `tests/lib/dashboard-web-data.test.ts`
- **buildFixtureTree()** (2 connections) — `tests/lib/dashboard-web-data.test.ts`
- **nowIso()** (1 connections) — `tests/lib/db-health.test.ts`

## Relationships

- [Agent Invocation Telemetry](Agent_Invocation_Telemetry.md) (20 shared connections)
- [SQLite State Store Core](SQLite_State_Store_Core.md) (15 shared connections)
- [Instinct Lifecycle Manager](Instinct_Lifecycle_Manager.md) (8 shared connections)
- [Session Lifecycle Manager](Session_Lifecycle_Manager.md) (7 shared connections)
- [CLI Dashboard Rendering](CLI_Dashboard_Rendering.md) (4 shared connections)
- [Research Report Storage](Research_Report_Storage.md) (4 shared connections)
- [Medik Checks CLI Runner](Medik_Checks_CLI_Runner.md) (2 shared connections)
- [Forge Pipeline](Forge_Pipeline.md) (2 shared connections)
- [Dashboard Web Server](Dashboard_Web_Server.md) (2 shared connections)
- [DB Health Check](DB_Health_Check.md) (2 shared connections)

## Source Files

- `scripts/lib/state-store/agent-invocations.ts`
- `scripts/lib/state-store/cost-events.ts`
- `scripts/lib/state-store/hook-events.ts`
- `scripts/lib/state-store/sessions.ts`
- `scripts/lib/utils.ts`
- `tests/lib/dashboard-web-data.test.ts`
- `tests/lib/db-health.test.ts`
- `tests/lib/state-store-agent-invocations.test.ts`
- `tests/lib/state-store-hook-events.test.ts`

## Audit Trail

- EXTRACTED: 118 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*