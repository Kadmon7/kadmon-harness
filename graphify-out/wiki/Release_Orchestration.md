# Release Orchestration

> 20 nodes

## Key Concepts

- **orchestrate.ts** (43 connections) — `scripts/lib/release/orchestrate.ts`
- **planRelease()** (13 connections) — `scripts/lib/release/orchestrate.ts`
- **orchestrate.e2e.test.ts** (8 connections) — `tests/lib/release/orchestrate.e2e.test.ts`
- **applyReleaseWrites()** (6 connections) — `scripts/lib/release/orchestrate.ts`
- **commitAndTag()** (6 connections) — `scripts/lib/release/orchestrate.ts`
- **isVersionAlreadyBumped()** (4 connections) — `scripts/lib/release/orchestrate.ts`
- **commitRelease()** (4 connections) — `scripts/lib/release/orchestrate.ts`
- **isReleaseWritesComplete()** (4 connections) — `scripts/lib/release/orchestrate.ts`
- **toGitError()** (3 connections) — `scripts/lib/release/orchestrate.ts`
- **blockedResult()** (3 connections) — `scripts/lib/release/orchestrate.ts`
- **runGit()** (2 connections) — `scripts/lib/release/orchestrate.ts`
- **extractGitStderr()** (2 connections) — `scripts/lib/release/orchestrate.ts`
- **scanSuggestedLevel()** (2 connections) — `scripts/lib/release/orchestrate.ts`
- **RELEASE_FILES** (1 connections) — `scripts/lib/release/orchestrate.ts`
- **DOKS_SYNC_FILES** (1 connections) — `scripts/lib/release/orchestrate.ts`
- **COMMIT_ALLOWLIST** (1 connections) — `scripts/lib/release/orchestrate.ts`
- **ADR-0037** (1 connections) — `scripts/lib/release/orchestrate.ts`
- **FIXED_NOW** (1 connections) — `tests/lib/release/orchestrate.e2e.test.ts`
- **runGit()** (1 connections) — `tests/lib/release/orchestrate.e2e.test.ts`
- **ADR-0037** (1 connections) — `tests/lib/release/orchestrate.e2e.test.ts`

## Relationships

- [Release Type Contracts](Release_Type_Contracts.md) (10 shared connections)
- [Lib Cluster](Lib_Cluster.md) (9 shared connections)
- [Changelog Consolidation](Changelog_Consolidation.md) (8 shared connections)
- [Release Preflight Gates](Release_Preflight_Gates.md) (6 shared connections)
- [Release Tagging](Release_Tagging.md) (6 shared connections)
- [Release Tests: Orchestrate Test](Release_Tests-_Orchestrate_Test.md) (4 shared connections)
- [ADR & Plan Status Flips](ADR_%26_Plan_Status_Flips.md) (3 shared connections)
- [Session Lifecycle Manager](Session_Lifecycle_Manager.md) (1 shared connections)

## Source Files

- `scripts/lib/release/orchestrate.ts`
- `tests/lib/release/orchestrate.e2e.test.ts`

## Audit Trail

- EXTRACTED: 107 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*