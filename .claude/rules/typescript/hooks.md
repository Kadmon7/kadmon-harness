---
alwaysApply: false
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

## Windows Compatibility
- MUST use `parseStdin()` helper to sanitize unescaped Windows backslashes in JSON stdin
- All 20 hooks use `PATH="$PATH:/c/Program Files/nodejs"` prefix for Node.js resolution
- MUST use `cmd /c npx` wrapper for MCP servers (GitHub, Context7)

## Lifecycle Hooks (3 registered + sub-modules)
- session-start.js — initializes session, loads instincts and previous session summary, recovers orphaned sessions
- session-end-all.js — consolidated Stop hook: persist session + evaluate patterns + track cost + write marker + daily log (imports generate-session-summary, evaluate-patterns-shared, daily-log as shared modules)
- pre-compact-save.js — saves session state, generates summary, evaluates patterns before context compaction

## Enforcement
- post-edit-typecheck hook validates hook script changes compile correctly
- no-context-guard hook ensures hook code is read before modification
- build-error-resolver agent assists when hook compilation fails