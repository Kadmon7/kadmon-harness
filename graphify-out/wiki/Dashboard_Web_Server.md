# Dashboard Web Server

> 33 nodes

## Key Concepts

- **dashboard-web-data.ts** (28 connections) — `scripts/lib/dashboard-web-data.ts`
- **dashboard-web.ts** (22 connections) — `scripts/dashboard-web.ts`
- **buildCatalog()** (9 connections) — `scripts/lib/dashboard-web-data.ts`
- **handleRequest()** (6 connections) — `scripts/dashboard-web.ts`
- **main()** (6 connections) — `scripts/dashboard-web.ts`
- **readFrontmatter()** (5 connections) — `scripts/lib/dashboard-web-data.ts`
- **getHookBudget()** (5 connections) — `scripts/lib/dashboard-web-data.ts`
- **DashboardDataBuilders** (4 connections) — `scripts/dashboard-web.ts`
- **createServer()** (4 connections) — `scripts/dashboard-web.ts`
- **attachErrorHandler()** (4 connections) — `scripts/dashboard-web.ts`
- **readMarkdownFrontmatters()** (4 connections) — `scripts/lib/dashboard-web-data.ts`
- **sendJson()** (3 connections) — `scripts/dashboard-web.ts`
- **sendNotFound()** (3 connections) — `scripts/dashboard-web.ts`
- **scanAgents()** (3 connections) — `scripts/lib/dashboard-web-data.ts`
- **scanCommands()** (3 connections) — `scripts/lib/dashboard-web-data.ts`
- **scanSkills()** (3 connections) — `scripts/lib/dashboard-web-data.ts`
- **resolvePort()** (2 connections) — `scripts/dashboard-web.ts`
- **formatServerErrorMessage()** (2 connections) — `scripts/dashboard-web.ts`
- **getFrontmatterBlock()** (2 connections) — `scripts/lib/dashboard-web-data.ts`
- **extractFrontmatterField()** (2 connections) — `scripts/lib/dashboard-web-data.ts`
- **countHooks()** (2 connections) — `scripts/lib/dashboard-web-data.ts`
- **countTestFiles()** (2 connections) — `scripts/lib/dashboard-web-data.ts`
- **BUDGET_50_HOOKS** (2 connections) — `scripts/lib/dashboard-web-data.ts`
- **BUDGET_100_HOOKS** (2 connections) — `scripts/lib/dashboard-web-data.ts`
- **EXEMPT_HOOKS** (2 connections) — `scripts/lib/dashboard-web-data.ts`
- *... and 8 more nodes in this community*

## Relationships

- [SQLite State Store Core](SQLite_State_Store_Core.md) (9 shared connections)
- [Agent Invocation Telemetry](Agent_Invocation_Telemetry.md) (7 shared connections)
- [Medik Checks CLI Runner](Medik_Checks_CLI_Runner.md) (3 shared connections)
- [Session Lifecycle Manager](Session_Lifecycle_Manager.md) (2 shared connections)
- [Lib Tests](Lib_Tests.md) (2 shared connections)
- [Instinct Lifecycle Manager](Instinct_Lifecycle_Manager.md) (1 shared connections)

## Source Files

- `scripts/dashboard-web.ts`
- `scripts/lib/dashboard-web-data.ts`

## Audit Trail

- EXTRACTED: 138 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*