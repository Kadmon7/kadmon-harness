---
alwaysApply: true
globs: ["tests/**/*.ts"]
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