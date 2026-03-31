---
description: Start TDD cycle — write failing test first, then implement
agent: tdd-guide
skills: [tdd-workflow]
---

## Purpose
Enforce test-driven development. Every feature starts with a failing test before any implementation code is written.

## Steps
1. Invoke tdd-guide agent (sonnet) with the feature description
2. Agent writes a failing test file (RED)
3. Run test to confirm it fails: `npx vitest run [test-file]`
4. Write minimum implementation to pass (GREEN)
5. Run test to confirm it passes
6. Refactor if needed without changing behavior (REFACTOR)
7. Run full test suite to confirm no regressions

## Output
Test file path + implementation file path + test results (pass/fail count).

## Example
```
User: /tdd add getSessionCost function

RED: tests/lib/cost-calculator.test.ts — 1 new test, FAILS
GREEN: scripts/lib/cost-calculator.ts — getSessionCost implemented, PASSES
REFACTOR: extracted pricing lookup into helper, all tests PASS
```