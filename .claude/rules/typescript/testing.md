---
alwaysApply: false
globs: ["tests/**/*.ts", "**/*.test.ts", "**/*.spec.ts"]
---

# TypeScript Testing Rules

## Mocking
- PREFER vi.fn() over manual mock objects
- MUST mock external dependencies (git commands, file system) in unit tests
- PREFER real :memory: SQLite over mocking state-store in integration tests

## Type Testing
- MUST test TypeScript types with `expectTypeOf` where relevant
- MUST verify that function return types match expected interfaces

## Cleanup
- MUST close database connections in afterEach
- MUST remove temp files/directories in afterEach
- NEVER leave test artifacts on disk

## Hook Testing
- MUST test hooks via execFileSync with input option
- MUST verify both exit code AND stderr/stdout content
- MUST test both blocking (exit 2) and allowing (exit 0) scenarios

## E2E Testing
- USE Playwright as the E2E testing framework for critical user flows
- e2e-runner agent specializes in Playwright test generation and execution
- PREFER Vitest for harness E2E tests, Playwright for web app E2E tests

## Enforcement
- tdd-guide agent enforces red-green-refactor cycle via /tdd command
- e2e-runner agent generates and runs E2E tests via /e2e command
- /verify command runs typecheck + tests + lint as verification loop
- /test-coverage command reports coverage per file
- post-edit-typecheck hook catches type errors in test files after edits
- tdd-workflow skill provides TDD methodology guidance
- e2e-testing skill provides E2E test patterns and structure
- verification-loop skill orchestrates the full verify pipeline