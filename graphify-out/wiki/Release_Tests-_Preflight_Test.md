# Release Tests: Preflight Test

> 12 nodes

## Key Concepts

- **preflight.test.ts** (16 connections) — `tests/lib/release/preflight.test.ts`
- **VerifyResult** (3 connections) — `scripts/lib/release/types.ts`
- **runGit()** (3 connections) — `tests/lib/release/preflight.test.ts`
- **initGitRepo()** (3 connections) — `tests/lib/release/preflight.test.ts`
- **seedRepo()** (3 connections) — `tests/lib/release/preflight.test.ts`
- **withTmpRepo()** (3 connections) — `tests/lib/release/preflight.test.ts`
- **nonEmptyUnreleasedChangelog()** (1 connections) — `tests/lib/release/preflight.test.ts`
- **emptyUnreleasedChangelog()** (1 connections) — `tests/lib/release/preflight.test.ts`
- **makeReleaseContext()** (1 connections) — `tests/lib/release/preflight.test.ts`
- **makeDeps()** (1 connections) — `tests/lib/release/preflight.test.ts`
- **blockerCodes()** (1 connections) — `tests/lib/release/preflight.test.ts`
- **ADR-0037** (1 connections) — `tests/lib/release/preflight.test.ts`

## Relationships

- [Release Preflight Gates](Release_Preflight_Gates.md) (3 shared connections)
- [Release Type Contracts](Release_Type_Contracts.md) (2 shared connections)
- [Release Tests: Orchestrate Test](Release_Tests-_Orchestrate_Test.md) (1 shared connections)
- [Lib Cluster](Lib_Cluster.md) (1 shared connections)

## Source Files

- `scripts/lib/release/types.ts`
- `tests/lib/release/preflight.test.ts`

## Audit Trail

- EXTRACTED: 37 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*