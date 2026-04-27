---
alwaysApply: true
---

# Hook System Rules

## Exit Codes
- exit(0) = allow the operation to proceed
- exit(1) = warn but allow (non-blocking feedback)
- exit(2) = block the operation

> Full Hook Catalog (22 registered hooks across 9 matcher groups + 8 shared modules) — see [`.claude/hooks/CATALOG.md`](../../hooks/CATALOG.md). Single source-of-truth per ADR-035.

## Safety
- NEVER crash Claude Code — always exit(0) on unexpected errors
- MUST wrap all hook logic in try/catch
- MUST log errors to stderr as JSON: `{ "error": "..." }`

## Performance
- observe-pre and observe-post MUST complete in < 50ms (file append only)
- no-context-guard MUST complete in < 100ms (reads observations JSONL)
- All other hooks MUST complete in < 500ms

## Data
- Hooks read input from stdin as JSON
- observe hooks write to JSONL files (file append, no DB)
- 9 blocking/warning hooks write to `hook-events.jsonl` via `logHookEvent()` (persisted to SQLite by session-end-all)
- Blocking/warning hooks log `durationMs = Date.now() - start` on every `logHookEvent` call for performance telemetry
- session-end-all extracts agent invocations from `observations.jsonl` and hook events from `hook-events.jsonl`, persists both to DB
- Lifecycle hooks (session-start, session-end-all) may access SQLite via compiled TypeScript in dist/
- MUST run `npm run build` before lifecycle hooks can access state-store

## Plugin-Mode Runtime Resolution

Lifecycle hooks (session-start, session-end-all, pre-compact-save) import from compiled TypeScript in `dist/`. Local-dev mode resolves via repo-root walk; plugin mode resolves via `KADMON_RUNTIME_ROOT` env var set by the plugin manifest. Full reference (resolver logic, plugin cache layout, hooks.json generator contract) — see **`hook-authoring` skill**.

## Windows Compatibility
- Non-critical hooks support `KADMON_DISABLED_HOOKS` env var (comma-separated names to skip)
- MUST use `parseStdin()` helper to sanitize unescaped Windows backslashes in JSON stdin
- Plugin-mode hook command prefix injection + Windows PATH deep detail — see **`hook-authoring` skill**
