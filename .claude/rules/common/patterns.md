---
alwaysApply: true
---

# Design Pattern Rules

## Architecture
- PREFER composition over inheritance
- MUST use dependency injection for testability
- NEVER use global mutable state
- PREFER pure functions where possible

## Error Handling
- NEVER swallow errors silently — always log
- PREFER returning null or Result types over throwing for expected failures
- MUST throw for unexpected/unrecoverable errors
- MUST include context in error messages: what failed, why, and what input caused it

## Data
- MUST use TypeScript interfaces from types.ts as source of truth
- MUST convert camelCase ↔ snake_case only in state-store.ts
- NEVER store derived data that can be computed
- PREFER immutable data structures