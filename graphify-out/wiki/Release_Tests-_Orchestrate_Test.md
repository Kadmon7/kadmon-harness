# Release Tests: Orchestrate Test

> 13 nodes

## Key Concepts

- **orchestrate.test.ts** (22 connections) — `tests/lib/release/orchestrate.test.ts`
- **runGit()** (5 connections) — `tests/lib/release/orchestrate.test.ts`
- **seedRepo()** (4 connections) — `tests/lib/release/orchestrate.test.ts`
- **initGitRepo()** (3 connections) — `tests/lib/release/orchestrate.test.ts`
- **withRepo()** (3 connections) — `tests/lib/release/orchestrate.test.ts`
- **commitCount()** (2 connections) — `tests/lib/release/orchestrate.test.ts`
- **tagList()** (2 connections) — `tests/lib/release/orchestrate.test.ts`
- **writeJson()** (2 connections) — `tests/lib/release/orchestrate.test.ts`
- **FIXED_NOW** (1 connections) — `tests/lib/release/orchestrate.test.ts`
- **pluginVersion()** (1 connections) — `tests/lib/release/orchestrate.test.ts`
- **makeCtx()** (1 connections) — `tests/lib/release/orchestrate.test.ts`
- **makeDeps()** (1 connections) — `tests/lib/release/orchestrate.test.ts`
- **ADR-0037** (1 connections) — `tests/lib/release/orchestrate.test.ts`

## Relationships

- [Release Orchestration](Release_Orchestration.md) (4 shared connections)
- [Changelog Consolidation](Changelog_Consolidation.md) (2 shared connections)
- [Release Type Contracts](Release_Type_Contracts.md) (1 shared connections)
- [Release Tests: Preflight Test](Release_Tests-_Preflight_Test.md) (1 shared connections)
- [Release Preflight Gates](Release_Preflight_Gates.md) (1 shared connections)
- [Lib Cluster](Lib_Cluster.md) (1 shared connections)

## Source Files

- `tests/lib/release/orchestrate.test.ts`

## Audit Trail

- EXTRACTED: 48 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*