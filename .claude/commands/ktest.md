---
description: Full testing pipeline — TDD red-green-refactor, coverage check, and E2E workflow tests
agent: feniks, kartograf
skills: [tdd-workflow, e2e-testing]
---

## Purpose
Unified testing command. TDD for new features, coverage reporting, and E2E for workflow tests. Absorbs the former /tdd, /test-coverage, and /e2e.

## Arguments
- `<feature description>` — start TDD cycle for a new feature (default mode)
- `coverage` — run tests with coverage, flag files below 80%
- `e2e` — run all 3 core E2E scenarios (expensive)
- `e2e <scenario>` — run specific E2E scenario: `session`, `instinct`, or `hooks`

## Steps

### TDD Mode (default — `<feature description>`)
1. Invoke **feniks agent** (sonnet) with the feature description
2. **RED**: Agent writes a failing test file
3. Run test to confirm it fails: `npx vitest run [test-file]`
4. **GREEN**: Write minimum implementation to pass
5. Run test to confirm it passes
6. **REFACTOR**: Refactor if needed without changing behavior
7. Run full test suite to confirm no regressions: `npx vitest run`

### Coverage Mode (`coverage`)
1. Run: `npx vitest run --coverage`
2. Parse coverage report
3. Flag files below 80% threshold
4. Report per-file coverage table

### E2E Mode (`e2e` — expensive, on-demand)
1. Invoke **kartograf agent** (sonnet)
2. Run specified scenarios (or all 3 core scenarios):
   - `session` — session lifecycle: start -> observe -> end -> verify SQLite
   - `instinct` — instinct lifecycle: create -> reinforce -> promote
   - `hooks` — hook chain: observe-pre -> edit -> observe-post -> verify JSONL
3. Report results per scenario with timing

## Output
Mode-specific: TDD results, coverage table, or E2E pass/fail report.

## Example: TDD
```
/ktest add getSessionCost function

RED:   tests/lib/cost-calculator.test.ts — 1 new test, FAILS
GREEN: scripts/lib/cost-calculator.ts — getSessionCost implemented, PASSES
REFACTOR: extracted pricing lookup into helper, all tests PASS
```

## Example: Coverage
```
/ktest coverage

| File                          | Coverage | Status     |
|-------------------------------|----------|------------|
| scripts/lib/utils.ts          | 95%      | OK         |
| scripts/lib/state-store.ts    | 82%      | OK         |
| scripts/lib/instinct-manager.ts | 71%    | BELOW 80%  |
```

## Example: E2E
```
/ktest e2e

E2E Results:
  Session lifecycle:  PASS (1.2s)
  Instinct lifecycle: PASS (0.8s)
  Hook chain:         PASS (0.5s)

3/3 scenarios passed (2.5s total)
```
