# Session Lifecycle Manager

> 29 nodes

## Key Concepts

- **utils.ts** (31 connections) — `scripts/lib/utils.ts`
- **session-manager.ts** (19 connections) — `scripts/lib/session-manager.ts`
- **core.ts** (18 connections) — `scripts/lib/state-store/core.ts`
- **sessions.ts** (17 connections) — `scripts/lib/state-store/sessions.ts`
- **session-manager.test.ts** (12 connections) — `tests/lib/session-manager.test.ts`
- **utils.test.ts** (11 connections) — `tests/lib/utils.test.ts`
- **getRecentSessions()** (10 connections) — `scripts/lib/state-store/sessions.ts`
- **startSession()** (8 connections) — `scripts/lib/session-manager.ts`
- **parseJson()** (7 connections) — `scripts/lib/state-store/core.ts`
- **getSession()** (7 connections) — `scripts/lib/state-store/sessions.ts`
- **endSession()** (6 connections) — `scripts/lib/session-manager.ts`
- **ensureDir()** (6 connections) — `scripts/lib/utils.ts`
- **mapSessionRow()** (5 connections) — `scripts/lib/state-store/sessions.ts`
- **getOrphanedSessions()** (5 connections) — `scripts/lib/state-store/sessions.ts`
- **sessionDir()** (5 connections) — `scripts/lib/utils.ts`
- **clearSessionEndState()** (4 connections) — `scripts/lib/state-store/sessions.ts`
- **ProjectInfo** (4 connections) — `scripts/lib/types.ts`
- **nowMs()** (4 connections) — `scripts/lib/utils.ts`
- **kadmonDataDir()** (4 connections) — `scripts/lib/utils.ts`
- **getLastSession()** (3 connections) — `scripts/lib/session-manager.ts`
- **SessionSummary** (3 connections) — `scripts/lib/types.ts`
- **tmpDir()** (3 connections) — `scripts/lib/utils.ts`
- **formatDuration()** (2 connections) — `scripts/lib/utils.ts`
- **ADR-0007** (1 connections) — `scripts/lib/session-manager.ts`
- **ADR-0022** (1 connections) — `scripts/lib/session-manager.ts`
- *... and 4 more nodes in this community*

## Relationships

- [Agent Invocation Telemetry](Agent_Invocation_Telemetry.md) (19 shared connections)
- [SQLite State Store Core](SQLite_State_Store_Core.md) (13 shared connections)
- [Instinct Lifecycle Manager](Instinct_Lifecycle_Manager.md) (11 shared connections)
- [Lib Tests](Lib_Tests.md) (7 shared connections)
- [Medik Checks CLI Runner](Medik_Checks_CLI_Runner.md) (6 shared connections)
- [Shared Type Definitions](Shared_Type_Definitions.md) (5 shared connections)
- [Research Report Storage](Research_Report_Storage.md) (4 shared connections)
- [Lib Cluster](Lib_Cluster.md) (3 shared connections)
- [Dashboard Web Server](Dashboard_Web_Server.md) (2 shared connections)
- [CLI Dashboard Rendering](CLI_Dashboard_Rendering.md) (2 shared connections)
- [Forge Pipeline](Forge_Pipeline.md) (1 shared connections)
- [Forge Report Writer](Forge_Report_Writer.md) (1 shared connections)

## Source Files

- `scripts/lib/session-manager.ts`
- `scripts/lib/state-store/core.ts`
- `scripts/lib/state-store/sessions.ts`
- `scripts/lib/types.ts`
- `scripts/lib/utils.ts`
- `tests/lib/session-manager.test.ts`
- `tests/lib/utils.test.ts`

## Audit Trail

- EXTRACTED: 196 (98%)
- INFERRED: 4 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*