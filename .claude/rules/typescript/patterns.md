---
alwaysApply: true
globs: ["**/*.ts"]
---

# TypeScript Pattern Rules

## Error Handling
- PREFER Result pattern over throwing for expected errors
- MUST use typed error classes for domain errors
- NEVER use `catch (e: any)` — use `catch (e: unknown)` and narrow

## Validation
- MUST use Zod schemas for all API contracts and external data
- PREFER `.parse()` when input MUST be valid (throws on invalid)
- PREFER `.safeParse()` when graceful handling of invalid input is needed

## Immutability
- PREFER `readonly` arrays and object properties where mutation is not needed
- PREFER spread operator for creating modified copies
- NEVER mutate function arguments

## sql.js Typing
- MUST type all query results explicitly (sql.js returns Record<string, unknown>)
- MUST use mapping functions (mapSessionRow, mapInstinctRow) for type conversion
- NEVER trust raw sql.js output types

## Enforcement
- typescript-reviewer agent validates pattern compliance on .ts/.tsx edits
- database-reviewer agent validates sql.js typing and Zod validation patterns when editing database code
- code-reviewer agent checks error handling and immutability patterns via /code-review
- post-edit-typecheck hook catches type errors from pattern violations immediately