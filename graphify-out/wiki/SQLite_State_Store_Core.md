# SQLite State Store Core

> 42 nodes

## Key Concepts

- **state-store.ts** (57 connections) — `scripts/lib/state-store.ts`
- **openDb()** (52 connections) — `scripts/lib/state-store/core.ts`
- **closeDb()** (46 connections) — `scripts/lib/state-store/core.ts`
- **migrate-archive-hygiene-instincts.test.ts** (12 connections) — `tests/scripts/migrate-archive-hygiene-instincts.test.ts`
- **migrate-archive-hygiene-instincts.ts** (10 connections) — `scripts/migrate-archive-hygiene-instincts.ts`
- **hook-health-24h.test.ts** (8 connections) — `tests/lib/medik-checks/hook-health-24h.test.ts`
- **state-store-legacy-db-migration.test.ts** (8 connections) — `tests/lib/state-store-legacy-db-migration.test.ts`
- **instinct-decay-candidates.test.ts** (7 connections) — `tests/lib/medik-checks/instinct-decay-candidates.test.ts`
- **WrappedDb** (6 connections) — `scripts/lib/state-store/core.ts`
- **dashboard-web-server.test.ts** (6 connections) — `tests/lib/dashboard-web-server.test.ts`
- **cleanup-test-sessions.ts** (5 connections) — `scripts/cleanup-test-sessions.ts`
- **migrate-v0.6.ts** (5 connections) — `scripts/migrate-v0.6.ts`
- **runCheck()** (4 connections) — `scripts/lib/medik-checks/hook-health-24h.ts`
- **runCheck()** (4 connections) — `scripts/lib/medik-checks/instinct-decay-candidates.ts`
- **cleanupTestSessions()** (4 connections) — `scripts/lib/state-store/sessions.ts`
- **runArchiveMigration()** (4 connections) — `scripts/migrate-archive-hygiene-instincts.ts`
- **main()** (4 connections) — `scripts/migrate-archive-hygiene-instincts.ts`
- **migrate-v0.3.ts** (4 connections) — `scripts/migrate-v0.3.ts`
- **migrate-v0.4.ts** (4 connections) — `scripts/migrate-v0.4.ts`
- **migrate-v0.5.ts** (4 connections) — `scripts/migrate-v0.5.ts`
- **main()** (3 connections) — `scripts/migrate-v0.3.ts`
- **main()** (3 connections) — `scripts/migrate-v0.4.ts`
- **main()** (3 connections) — `scripts/migrate-v0.5.ts`
- **main()** (3 connections) — `scripts/migrate-v0.6.ts`
- **.exec()** (2 connections) — `scripts/lib/state-store/core.ts`
- *... and 17 more nodes in this community*

## Relationships

- [Agent Invocation Telemetry](Agent_Invocation_Telemetry.md) (26 shared connections)
- [Instinct Lifecycle Manager](Instinct_Lifecycle_Manager.md) (15 shared connections)
- [Lib Tests](Lib_Tests.md) (15 shared connections)
- [Session Lifecycle Manager](Session_Lifecycle_Manager.md) (13 shared connections)
- [Medik Checks CLI Runner](Medik_Checks_CLI_Runner.md) (10 shared connections)
- [Dashboard Web Server](Dashboard_Web_Server.md) (9 shared connections)
- [Research Report Storage](Research_Report_Storage.md) (9 shared connections)
- [Medik Capability Alignment](Medik_Capability_Alignment.md) (6 shared connections)
- [CLI Dashboard & Evolve Reader](CLI_Dashboard_%26_Evolve_Reader.md) (5 shared connections)
- [Forge Pipeline](Forge_Pipeline.md) (5 shared connections)
- [DB Health Check](DB_Health_Check.md) (4 shared connections)
- [CLI Dashboard Rendering](CLI_Dashboard_Rendering.md) (4 shared connections)

## Source Files

- `scripts/cleanup-test-sessions.ts`
- `scripts/lib/medik-checks/hook-health-24h.ts`
- `scripts/lib/medik-checks/instinct-decay-candidates.ts`
- `scripts/lib/state-store.ts`
- `scripts/lib/state-store/core.ts`
- `scripts/lib/state-store/sessions.ts`
- `scripts/migrate-archive-hygiene-instincts.ts`
- `scripts/migrate-v0.3.ts`
- `scripts/migrate-v0.4.ts`
- `scripts/migrate-v0.5.ts`
- `scripts/migrate-v0.6.ts`
- `tests/lib/dashboard-web-server.test.ts`
- `tests/lib/medik-checks/hook-health-24h.test.ts`
- `tests/lib/medik-checks/instinct-decay-candidates.test.ts`
- `tests/lib/state-store-legacy-db-migration.test.ts`
- `tests/scripts/migrate-archive-hygiene-instincts.test.ts`

## Audit Trail

- EXTRACTED: 289 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*