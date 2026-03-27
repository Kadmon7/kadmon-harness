---
name: coding-standards
description: TypeScript/JavaScript conventions for Kadmon projects — naming, types, imports, error handling. Use this skill whenever writing new code, reviewing code for convention compliance, or unsure about naming (camelCase vs PascalCase vs snake_case), import style (node: prefix, .js extensions), error handling patterns, or file organization. Also consult when onboarding to the project or when the typescript-reviewer agent flags issues.
---

# Coding Standards

TypeScript/JavaScript conventions for the Kadmon Harness ecosystem.

## When to Use
- Writing any new TypeScript code
- Reviewing code for convention compliance
- Onboarding to the project

## How It Works

### TypeScript
- strict mode always enabled
- No `any` types — use `unknown` and narrow
- No `!` non-null assertions without justification
- Prefer interfaces over type aliases for object shapes
- Use discriminated unions for state machines

### Naming
- camelCase for variables, functions, properties
- PascalCase for types, interfaces, classes
- snake_case only in SQL column names (conversion in state-store.ts)
- Descriptive names: `getActiveInstincts` not `getAI`

### Files
- One module per file
- Small files (< 200 lines preferred)
- Co-locate tests: `foo.ts` → `tests/lib/foo.test.ts`

### Error Handling
- Never catch and swallow silently
- Log errors to stderr as JSON: `{ ts, level, msg }`
- Return null/false on failure instead of throwing (in hooks)
- Use try/catch at service boundaries

### Imports
- Node.js builtins: `import fs from 'node:fs'` (with node: prefix)
- Local imports: relative paths with .js extension (Node16 resolution)
- No circular dependencies

## Rules
- Every exported function has at least one test
- No console.log in production code — use the log() utility
- Conventional commits: feat:, fix:, docs:, chore:

## no_context Application
Coding standards are derived from the actual codebase patterns (types.ts, state-store.ts, utils.ts) — not from generic best practices. When in doubt, read existing code.