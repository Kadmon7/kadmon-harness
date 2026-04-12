---
alwaysApply: false
globs: ["tests/**/*.ts", "**/*.test.ts", "**/*.spec.ts"]
---

# TypeScript Testing Rules

> This file extends [common/testing.md](../common/testing.md) with TypeScript-specific content.

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
- kartograf agent specializes in Playwright test generation and execution
- PREFER Vitest for harness E2E tests, Playwright for web app E2E tests

## Enforcement
- feniks agent enforces red-green-refactor cycle via /abra-kdabra (when needs_tdd: true)
- kartograf agent generates and runs E2E tests via /skanner command
- /chekpoint command runs typecheck + tests + lint as verification loop before commit
- post-edit-typecheck hook catches type errors in test files after edits
- tdd-workflow skill provides TDD methodology guidance
- e2e-testing skill provides E2E test patterns and structure
- verification-loop skill orchestrates the full verify pipeline