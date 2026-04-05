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
- MUST use immutable data structures — create new objects, never mutate existing ones

## Enforcement
- arkitect agent reviews system design and pattern decisions via /kplan
- kody agent validates pattern adherence via /kreview and /checkpoint
- kody agent checks type safety and immutability patterns on .ts/.tsx edits (TypeScript specialist mode)
- database-reviewer agent validates data layer patterns when editing SQL or Supabase code
- no-context-guard hook ensures code is read before modification (enforces understand-before-edit pattern)