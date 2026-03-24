---
alwaysApply: true
globs: [".claude/hooks/scripts/*.js"]
---

# TypeScript Hook Rules

## Compilation
- Hook scripts are .js files that run directly via Node.js
- Lifecycle hooks import compiled TypeScript from dist/scripts/lib/
- MUST run `npm run build` before lifecycle hooks work
- MUST handle import failures gracefully with visible WARNING message

## Types
- MUST import types from scripts/lib/types.ts for type checking
- MUST handle null/undefined from sql.js queries (rows can be null)
- MUST type all JSON.parse results (use unknown + validation)

## Input
- MUST read stdin as: `fs.readFileSync(0, 'utf8')`
- MUST parse with try/catch: `JSON.parse(raw)`
- MUST handle missing fields with optional chaining: `input.tool_input?.file_path`