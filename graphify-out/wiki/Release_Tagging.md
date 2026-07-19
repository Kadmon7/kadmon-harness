# Release Tagging

> 12 nodes

## Key Concepts

- **tag.ts** (15 connections) — `scripts/lib/release/tag.ts`
- **tag.test.ts** (10 connections) — `tests/lib/release/tag.test.ts`
- **tagExists()** (9 connections) — `scripts/lib/release/tag.ts`
- **createReleaseTag()** (7 connections) — `scripts/lib/release/tag.ts`
- **StepResult** (7 connections) — `scripts/lib/release/types.ts`
- **runGit()** (3 connections) — `scripts/lib/release/tag.ts`
- **toReleaseError()** (3 connections) — `scripts/lib/release/tag.ts`
- **extractGitStderr()** (2 connections) — `scripts/lib/release/tag.ts`
- **ADR-0037** (1 connections) — `scripts/lib/release/tag.ts`
- **runGit()** (1 connections) — `tests/lib/release/tag.test.ts`
- **makeReleaseContext()** (1 connections) — `tests/lib/release/tag.test.ts`
- **ADR-0037** (1 connections) — `tests/lib/release/tag.test.ts`

## Relationships

- [Release Orchestration](Release_Orchestration.md) (6 shared connections)
- [Release Type Contracts](Release_Type_Contracts.md) (6 shared connections)
- [Lib Cluster](Lib_Cluster.md) (5 shared connections)
- [Release Preflight Gates](Release_Preflight_Gates.md) (3 shared connections)
- [Session Lifecycle Manager](Session_Lifecycle_Manager.md) (1 shared connections)
- [Changelog Consolidation](Changelog_Consolidation.md) (1 shared connections)

## Source Files

- `scripts/lib/release/tag.ts`
- `scripts/lib/release/types.ts`
- `tests/lib/release/tag.test.ts`

## Audit Trail

- EXTRACTED: 60 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*