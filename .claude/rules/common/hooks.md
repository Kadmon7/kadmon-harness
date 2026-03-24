---
alwaysApply: true
---

# Hook System Rules

## Exit Codes
- exit(0) = allow the operation to proceed
- exit(1) = warn but allow (non-blocking feedback)
- exit(2) = block the operation

## Safety
- NEVER crash Claude Code — always exit(0) on unexpected errors
- MUST wrap all hook logic in try/catch
- MUST log errors to stderr as JSON: `{ "error": "..." }`

## Performance
- observe-pre and observe-post MUST complete in < 50ms
- no-context-guard MUST complete in < 100ms
- All other hooks MUST complete in < 500ms

## Data
- Hooks read input from stdin as JSON
- observe hooks write to JSONL files (file append, no DB)
- Lifecycle hooks (session-start, session-end) may access SQLite via compiled TypeScript in dist/
- MUST run `npm run build` before lifecycle hooks can access state-store