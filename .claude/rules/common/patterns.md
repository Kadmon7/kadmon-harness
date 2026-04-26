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
- MUST use a single shared types module as the source of truth for cross-layer interfaces
- MUST convert camelCase ↔ snake_case only at the data-access boundary, never at call sites
- NEVER store derived data that can be computed
- MUST use immutable data structures — create new objects, never mutate existing ones

## Enforcement
- arkitect agent reviews system design and pattern decisions via /abra-kdabra
- kody agent validates pattern adherence via /chekpoint
- kody agent checks type safety and immutability patterns on .ts/.tsx edits (TypeScript specialist mode)
- orakle agent validates data layer patterns when editing SQL or Supabase code
- no-context-guard hook ensures code is read before modification (enforces understand-before-edit pattern)