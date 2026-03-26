---
alwaysApply: false
globs: ["**/*.ts", "**/*.tsx"]
---

# TypeScript Coding Style Rules

## Strict Mode
- MUST enable strict mode in tsconfig.json
- MUST use explicit interface over type alias for object shapes
- NEVER use non-null assertion (!) without justification comment
- PREFER discriminated unions over boolean flags for state

## Types
- MUST use `as const` for literal type assertions
- PREFER `unknown` over `any` for untyped values
- MUST use explicit generic constraints: `<T extends object>` not `<T>`
- NEVER use type assertions (`as X`) when a type guard would work

## Modules
- MUST use .js extension in import paths (Node16 module resolution)
- MUST use `import type` for type-only imports
- NEVER use require() — use ES module imports only

## Enforcement
- typescript-reviewer agent auto-checks strict mode, type safety, async patterns, and Node16 resolution on .ts/.tsx edits
- post-edit-typecheck hook validates TypeScript compilation after every Edit/Write (PostToolUse, exit 1 on errors)
- quality-gate hook runs lint/style checks after every Edit/Write (PostToolUse)
- coding-standards skill provides TypeScript convention reference