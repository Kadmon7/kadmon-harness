# CLI Dashboard & Evolve Reader

> 17 nodes

## Key Concepts

- **dashboard.ts** (18 connections) — `scripts/dashboard.ts`
- **evolve-report-reader.ts** (15 connections) — `scripts/lib/evolve-report-reader.ts`
- **main()** (9 connections) — `scripts/dashboard.ts`
- **evolve-report-reader.test.ts** (8 connections) — `tests/lib/evolve-report-reader.test.ts`
- **readClusterReportsInWindow()** (6 connections) — `scripts/lib/evolve-report-reader.ts`
- **summarizePendingClusterReports()** (5 connections) — `scripts/lib/evolve-report-reader.ts`
- **Cluster** (5 connections) — `scripts/lib/types.ts`
- **findActiveSessionDir()** (4 connections) — `scripts/dashboard.ts`
- **mergeByInstinctId()** (4 connections) — `scripts/lib/evolve-report-reader.ts`
- **loadObservations()** (2 connections) — `scripts/dashboard.ts`
- **fileMtimeMs()** (2 connections) — `scripts/dashboard.ts`
- **resolveWindowDays()** (2 connections) — `scripts/lib/evolve-report-reader.ts`
- **PendingReportsSummary** (2 connections) — `scripts/lib/evolve-report-reader.ts`
- **ReadReportsOptions** (1 connections) — `scripts/lib/evolve-report-reader.ts`
- **ADR-0008** (1 connections) — `scripts/lib/evolve-report-reader.ts`
- **daysAgo()** (1 connections) — `tests/lib/evolve-report-reader.test.ts`
- **ADR-0008** (1 connections) — `tests/lib/evolve-report-reader.test.ts`

## Relationships

- [CLI Dashboard Rendering](CLI_Dashboard_Rendering.md) (8 shared connections)
- [Shared Type Definitions](Shared_Type_Definitions.md) (8 shared connections)
- [Evolve Generate Pipeline](Evolve_Generate_Pipeline.md) (6 shared connections)
- [SQLite State Store Core](SQLite_State_Store_Core.md) (5 shared connections)
- [Forge Report Writer](Forge_Report_Writer.md) (3 shared connections)
- [Medik Checks CLI Runner](Medik_Checks_CLI_Runner.md) (3 shared connections)
- [Forge Pipeline](Forge_Pipeline.md) (1 shared connections)

## Source Files

- `scripts/dashboard.ts`
- `scripts/lib/evolve-report-reader.ts`
- `scripts/lib/types.ts`
- `tests/lib/evolve-report-reader.test.ts`

## Audit Trail

- EXTRACTED: 86 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*