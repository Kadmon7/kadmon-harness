# Lib Cluster

> 13 nodes

## Key Concepts

- **ReleaseContext** (16 connections) — `scripts/lib/release/types.ts`
- **backlog-prune.ts** (13 connections) — `scripts/lib/release/backlog-prune.ts`
- **log()** (13 connections) — `scripts/lib/utils.ts`
- **pruneBacklog()** (8 connections) — `scripts/lib/release/backlog-prune.ts`
- **backlog-prune.test.ts** (8 connections) — `tests/lib/release/backlog-prune.test.ts`
- **collectDoneItems()** (6 connections) — `scripts/lib/release/backlog-prune.ts`
- **backlogPath()** (3 connections) — `scripts/lib/release/backlog-prune.ts`
- **readChangelogText()** (3 connections) — `scripts/lib/release/backlog-prune.ts`
- **parseId()** (2 connections) — `scripts/lib/release/backlog-prune.ts`
- **defaultRunDiff()** (2 connections) — `scripts/lib/release/upgrade-advisory.ts`
- **makeTmpDir()** (1 connections) — `tests/lib/release/backlog-prune.test.ts`
- **writeFixture()** (1 connections) — `tests/lib/release/backlog-prune.test.ts`
- **makeCtx()** (1 connections) — `tests/lib/release/backlog-prune.test.ts`

## Relationships

- [Release Orchestration](Release_Orchestration.md) (9 shared connections)
- [Release Type Contracts](Release_Type_Contracts.md) (6 shared connections)
- [Release Tagging](Release_Tagging.md) (5 shared connections)
- [ADR & Plan Status Flips](ADR_%26_Plan_Status_Flips.md) (4 shared connections)
- [Session Lifecycle Manager](Session_Lifecycle_Manager.md) (3 shared connections)
- [Changelog Consolidation](Changelog_Consolidation.md) (2 shared connections)
- [Release Upgrade Advisory](Release_Upgrade_Advisory.md) (2 shared connections)
- [Release Preflight Gates](Release_Preflight_Gates.md) (1 shared connections)
- [Release Tests: Orchestrate Test](Release_Tests-_Orchestrate_Test.md) (1 shared connections)
- [Release Tests: Preflight Test](Release_Tests-_Preflight_Test.md) (1 shared connections)
- [Instinct Lifecycle Manager](Instinct_Lifecycle_Manager.md) (1 shared connections)

## Source Files

- `scripts/lib/release/backlog-prune.ts`
- `scripts/lib/release/types.ts`
- `scripts/lib/release/upgrade-advisory.ts`
- `scripts/lib/utils.ts`
- `tests/lib/release/backlog-prune.test.ts`

## Audit Trail

- EXTRACTED: 76 (99%)
- INFERRED: 1 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*