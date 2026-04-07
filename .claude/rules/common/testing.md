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
- MUST write failing test before implementation for new features and bug fixes — config changes, docs, and trivial one-liners are exempt
- MUST fix implementation when tests fail — only modify tests if the test itself is incorrect
- NEVER mark tests as .skip in committed code without tracking comment
- MUST run full test suite before committing

## Enforcement
- feniks agent enforces red-green-refactor cycle via /abra-kdabra (when needs_tdd: true)
- kartograf agent runs full workflow tests via /skanner command
- /chekpoint command runs typecheck + tests + lint as verification loop before commit
- /akademy command evaluates agent and skill quality with structured tests
- post-edit-typecheck hook catches type errors immediately after edits
- verification-loop skill orchestrates the full verify pipeline
- tdd-workflow skill provides TDD methodology guidance
- e2e-testing skill provides E2E test patterns and structure