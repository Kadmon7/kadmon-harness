# Release Type Contracts

> 30 nodes

## Key Concepts

- **types.ts** (30 connections) — `scripts/lib/release/types.ts`
- **version-bump.ts** (16 connections) — `scripts/lib/release/version-bump.ts`
- **version-bump.test.ts** (13 connections) — `tests/lib/release/version-bump.test.ts`
- **ReleaseError** (7 connections) — `scripts/lib/release/types.ts`
- **applyVersionBump()** (7 connections) — `scripts/lib/release/version-bump.ts`
- **ReleaseValidationError** (5 connections) — `scripts/lib/release/version-bump.ts`
- **computeNextVersion()** (5 connections) — `scripts/lib/release/version-bump.ts`
- **ReleaseErrorCode** (4 connections) — `scripts/lib/release/types.ts`
- **BumpLevel** (3 connections) — `scripts/lib/release/types.ts`
- **PreflightResult** (2 connections) — `scripts/lib/release/types.ts`
- **StatusFlipProposal** (2 connections) — `scripts/lib/release/types.ts`
- **UnnarratedPruneWarning** (2 connections) — `scripts/lib/release/types.ts`
- **ReleasePlan** (2 connections) — `scripts/lib/release/types.ts`
- **.constructor()** (2 connections) — `scripts/lib/release/version-bump.ts`
- **parseVersion()** (2 connections) — `scripts/lib/release/version-bump.ts`
- **readJsonFile()** (2 connections) — `scripts/lib/release/version-bump.ts`
- **writeVersionedJson()** (2 connections) — `scripts/lib/release/version-bump.ts`
- **toRelative()** (2 connections) — `scripts/lib/release/version-bump.ts`
- **ReleaseOptions** (1 connections) — `scripts/lib/release/types.ts`
- **VerifyRunner** (1 connections) — `scripts/lib/release/types.ts`
- **StepStatus** (1 connections) — `scripts/lib/release/types.ts`
- **ADR-0037** (1 connections) — `scripts/lib/release/types.ts`
- **ADR-0037** (1 connections) — `scripts/lib/release/version-bump.ts`
- **REPO_ROOT** (1 connections) — `tests/lib/release/version-bump.test.ts`
- **REAL_PLUGIN_JSON** (1 connections) — `tests/lib/release/version-bump.test.ts`
- *... and 5 more nodes in this community*

## Relationships

- [Release Orchestration](Release_Orchestration.md) (10 shared connections)
- [Lib Cluster](Lib_Cluster.md) (6 shared connections)
- [Release Tagging](Release_Tagging.md) (6 shared connections)
- [Release Preflight Gates](Release_Preflight_Gates.md) (4 shared connections)
- [ADR & Plan Status Flips](ADR_%26_Plan_Status_Flips.md) (3 shared connections)
- [Changelog Consolidation](Changelog_Consolidation.md) (2 shared connections)
- [Release Tests: Preflight Test](Release_Tests-_Preflight_Test.md) (2 shared connections)
- [Release Tests: Orchestrate Test](Release_Tests-_Orchestrate_Test.md) (1 shared connections)

## Source Files

- `scripts/lib/release/types.ts`
- `scripts/lib/release/version-bump.ts`
- `tests/lib/release/version-bump.test.ts`

## Audit Trail

- EXTRACTED: 120 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*