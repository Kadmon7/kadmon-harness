---
alwaysApply: true
---

# Testing Rules

## Coverage
- MUST have at least one test for every exported function
- MUST target 80%+ coverage on new code
- MUST test: happy path + error path + edge cases

## Framework
- MUST use Vitest as test runner
- Test file naming: `[module].test.ts` in `tests/` directory
- MUST use :memory: SQLite for database tests — NEVER touch production DB

## Patterns
- PREFER arrange-act-assert structure
- MUST clean up test fixtures in afterEach
- PREFER real dependencies over mocks when practical
- MUST test hook scripts using execFileSync with input option (Windows-safe)

## TDD
- MUST write failing test before implementation (when using /tdd)
- NEVER mark tests as .skip in committed code without tracking comment
- MUST run full test suite before committing