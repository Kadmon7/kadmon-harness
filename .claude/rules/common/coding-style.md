---
alwaysApply: true
---

# Coding Style Rules

## Naming
- MUST use camelCase for variables, functions, and object properties
- MUST use PascalCase for types, interfaces, and classes
- MUST use kebab-case for file names (e.g., instinct-manager.ts)
- MUST use snake_case ONLY for SQL column names (conversion in state-store.ts)
- PREFER descriptive names: `getActiveInstincts` not `getAI`

## Types
- NEVER use `any` type — use `unknown` and narrow with type guards
- MUST use explicit return types on all exported functions
- PREFER `interface` over `type` for object shapes
- NEVER use non-null assertion (`!`) without a justification comment

## Variables
- NEVER use `var` — use `const` or `let`
- PREFER `const` over `let` when value does not change
- PREFER early returns over nested if/else blocks

## Validation
- MUST use Zod for all external input validation
- MUST validate at system boundaries (API inputs, file reads, stdin)

## Files
- PREFER small files (< 200 lines)
- MUST have one module per file
- MUST co-locate tests: `foo.ts` → `tests/lib/foo.test.ts`

## Imports
- MUST use `node:` prefix for Node.js builtins: `import fs from 'node:fs'`
- MUST use .js extension for local imports (Node16 resolution)
- NEVER create circular dependencies

## Enforcement
- kody agent auto-checks strict mode, type safety, Node16 resolution on .ts/.tsx edits, and validates naming conventions and import patterns via /kreview and /checkpoint
- post-edit-typecheck hook validates TypeScript compilation after every Edit/Write
- quality-gate hook runs lint/style checks after every Edit/Write
- coding-standards skill provides reference conventions during implementation