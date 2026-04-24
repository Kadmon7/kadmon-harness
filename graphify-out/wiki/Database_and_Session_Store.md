# Database and Session Store

> 101 nodes · cohesion 0.05

## Key Concepts

- **state-store.ts** (79 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\state-store.ts`
- **state-store.ts** (79 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\state-store.ts`
- **getDb()** (45 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\state-store.ts`
- **nowIso()** (20 connections) — `C:\Command-Center\Kadmon-Harness\tests\lib\db-health.test.ts`
- **instinct-manager.ts** (14 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\instinct-manager.ts`
- **instinct-manager.ts** (14 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\instinct-manager.ts`
- **upsertInstinct()** (11 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\state-store.ts`
- **startSession()** (8 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\session-manager.ts`
- **getActiveInstincts()** (8 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\state-store.ts`
- **generateId()** (8 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\utils.ts`
- **main()** (7 connections) — `C:\Command-Center\Kadmon-Harness\scripts\migrate-fix-session-inversion.ts`
- **session-manager.ts** (7 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\session-manager.ts`
- **getInstinct()** (7 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\state-store.ts`
- **session-manager.ts** (7 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\session-manager.ts`
- **endSession()** (6 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\session-manager.ts`
- **upsertSession()** (6 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\state-store.ts`
- **getSession()** (6 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\state-store.ts`
- **createResearchReport()** (6 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\state-store.ts`
- **db-health.ts** (5 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\db-health.ts`
- **applyForgePreview()** (5 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\forge-pipeline.ts`
- **createInstinct()** (5 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\instinct-manager.ts`
- **reinforceInstinct()** (5 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\instinct-manager.ts`
- **contradictInstinct()** (5 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\instinct-manager.ts`
- **promoteInstinct()** (5 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\instinct-manager.ts`
- **parseJson()** (5 connections) — `C:\Command-Center\Kadmon-Harness\scripts\lib\state-store.ts`
- *... and 76 more nodes in this community*

## Relationships

- [[Dashboard and Migrations]] (31 shared connections)
- [[Forge Pipeline and Pattern Engine]] (23 shared connections)
- [[Dashboard Renderer]] (10 shared connections)
- [[Research Report Persistence]] (6 shared connections)
- [[Evolve Generate Engine]] (6 shared connections)
- [[Forge Report Writer]] (6 shared connections)
- [[log-hook-event Tests]] (1 shared connections)
- [[Plugin Session Dogfood]] (1 shared connections)

## Source Files

- `C:\Command-Center\Kadmon-Harness\scripts\cleanup-test-sessions.ts`
- `C:\Command-Center\Kadmon-Harness\scripts\db-health-check.ts`
- `C:\Command-Center\Kadmon-Harness\scripts\lib\db-health.ts`
- `C:\Command-Center\Kadmon-Harness\scripts\lib\forge-pipeline.ts`
- `C:\Command-Center\Kadmon-Harness\scripts\lib\instinct-manager.ts`
- `C:\Command-Center\Kadmon-Harness\scripts\lib\session-manager.ts`
- `C:\Command-Center\Kadmon-Harness\scripts\lib\state-store.ts`
- `C:\Command-Center\Kadmon-Harness\scripts\lib\utils.ts`
- `C:\Command-Center\Kadmon-Harness\scripts\migrate-fix-session-inversion.ts`
- `C:\Command-Center\Kadmon-Harness\tests\eval\instinct-lifecycle-e2e.test.ts`
- `C:\Command-Center\Kadmon-Harness\tests\lib\cross-project-promotion.test.ts`
- `C:\Command-Center\Kadmon-Harness\tests\lib\db-health.test.ts`
- `C:\Command-Center\Kadmon-Harness\tests\lib\instinct-manager.test.ts`
- `C:\Command-Center\Kadmon-Harness\tests\lib\session-manager.test.ts`
- `C:\Command-Center\Kadmon-Harness\tests\lib\state-store-agent-invocations.test.ts`
- `C:\Command-Center\Kadmon-Harness\tests\lib\state-store-hook-events.test.ts`
- `C:\Command-Center\Kadmon-Harness\tests\lib\state-store-migration-cleanup.test.ts`
- `C:\Command-Center\Kadmon-Harness\tests\lib\state-store-research-reports.test.ts`
- `C:\Command-Center\Kadmon-Harness\tests\lib\state-store.test.ts`
- `C:\Command-Center\Kadmon-Harness\tests\scripts\migrate-fix-session-inversion.test.ts`

## Audit Trail

- EXTRACTED: 483 (80%)
- INFERRED: 119 (20%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*