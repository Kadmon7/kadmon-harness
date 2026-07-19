# Research Report Storage

> 26 nodes

## Key Concepts

- **persist-research-report.ts** (18 connections) — `scripts/persist-research-report.ts`
- **research-reports.ts** (17 connections) — `scripts/lib/state-store/research-reports.ts`
- **state-store-research-reports.test.ts** (11 connections) — `tests/lib/state-store-research-reports.test.ts`
- **persist-research-report.test.ts** (11 connections) — `tests/scripts/persist-research-report.test.ts`
- **createResearchReport()** (8 connections) — `scripts/lib/state-store/research-reports.ts`
- **runPersistReport()** (8 connections) — `scripts/persist-research-report.ts`
- **mapResearchReportRow()** (5 connections) — `scripts/lib/state-store/research-reports.ts`
- **getResearchReport()** (5 connections) — `scripts/lib/state-store/research-reports.ts`
- **queryResearchReports()** (5 connections) — `scripts/lib/state-store/research-reports.ts`
- **getLastResearchReport()** (4 connections) — `scripts/lib/state-store/research-reports.ts`
- **ResearchReport** (4 connections) — `scripts/lib/types.ts`
- **hasFTS5Support()** (3 connections) — `scripts/lib/state-store/research-reports.ts`
- **buildFrontmatter()** (3 connections) — `scripts/persist-research-report.ts`
- **_resetFTS5Cache()** (2 connections) — `scripts/lib/state-store/research-reports.ts`
- **PersistReportInput** (2 connections) — `scripts/persist-research-report.ts`
- **PersistReportResult** (2 connections) — `scripts/persist-research-report.ts`
- **validateSlug()** (2 connections) — `scripts/persist-research-report.ts`
- **padNumber()** (2 connections) — `scripts/persist-research-report.ts`
- **scanDiskMaxReportNumber()** (2 connections) — `scripts/persist-research-report.ts`
- **escapeYamlString()** (2 connections) — `scripts/persist-research-report.ts`
- **ADR-0015** (1 connections) — `scripts/lib/state-store/research-reports.ts`
- **PersistReportInputSchema** (1 connections) — `scripts/persist-research-report.ts`
- **PersistReportOptions** (1 connections) — `scripts/persist-research-report.ts`
- **ADR-0015** (1 connections) — `scripts/persist-research-report.ts`
- **sampleInput()** (1 connections) — `tests/lib/state-store-research-reports.test.ts`
- *... and 1 more nodes in this community*

## Relationships

- [SQLite State Store Core](SQLite_State_Store_Core.md) (9 shared connections)
- [Agent Invocation Telemetry](Agent_Invocation_Telemetry.md) (8 shared connections)
- [Session Lifecycle Manager](Session_Lifecycle_Manager.md) (4 shared connections)
- [Lib Tests](Lib_Tests.md) (4 shared connections)
- [Shared Type Definitions](Shared_Type_Definitions.md) (3 shared connections)
- [Instinct Lifecycle Manager](Instinct_Lifecycle_Manager.md) (2 shared connections)

## Source Files

- `scripts/lib/state-store/research-reports.ts`
- `scripts/lib/types.ts`
- `scripts/persist-research-report.ts`
- `tests/lib/state-store-research-reports.test.ts`
- `tests/scripts/persist-research-report.test.ts`

## Audit Trail

- EXTRACTED: 120 (98%)
- INFERRED: 2 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*