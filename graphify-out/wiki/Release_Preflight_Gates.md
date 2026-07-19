# Release Preflight Gates

> 12 nodes

## Key Concepts

- **preflight.ts** (21 connections) — `scripts/lib/release/preflight.ts`
- **runPreflight()** (9 connections) — `scripts/lib/release/preflight.ts`
- **ReleaseDeps** (8 connections) — `scripts/lib/release/types.ts`
- **toGitError()** (4 connections) — `scripts/lib/release/preflight.ts`
- **checkDirtyTree()** (4 connections) — `scripts/lib/release/preflight.ts`
- **checkNotOnMain()** (4 connections) — `scripts/lib/release/preflight.ts`
- **runGit()** (3 connections) — `scripts/lib/release/preflight.ts`
- **checkVerifyRed()** (3 connections) — `scripts/lib/release/preflight.ts`
- **checkEmptyUnreleased()** (3 connections) — `scripts/lib/release/preflight.ts`
- **checkTagExists()** (3 connections) — `scripts/lib/release/preflight.ts`
- **extractGitStderr()** (2 connections) — `scripts/lib/release/preflight.ts`
- **ADR-0037** (1 connections) — `scripts/lib/release/preflight.ts`

## Relationships

- [Release Orchestration](Release_Orchestration.md) (6 shared connections)
- [Release Type Contracts](Release_Type_Contracts.md) (4 shared connections)
- [Changelog Consolidation](Changelog_Consolidation.md) (3 shared connections)
- [Release Tagging](Release_Tagging.md) (3 shared connections)
- [Release Tests: Preflight Test](Release_Tests-_Preflight_Test.md) (3 shared connections)
- [Lib Cluster](Lib_Cluster.md) (1 shared connections)
- [Release Tests: Orchestrate Test](Release_Tests-_Orchestrate_Test.md) (1 shared connections)

## Source Files

- `scripts/lib/release/preflight.ts`
- `scripts/lib/release/types.ts`

## Audit Trail

- EXTRACTED: 65 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*