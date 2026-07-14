---
alwaysApply: true
---

# Hook System Rules

## Exit Codes
- exit(0) = allow the operation to proceed
- exit(1) = warn but allow (non-blocking feedback)
- exit(2) = block the operation

> Full Hook Catalog (23 registered hooks across 12 matcher groups + 12 shared modules) — see [`.claude/hooks/CATALOG.md`](../../hooks/CATALOG.md). Single source-of-truth per ADR-035.

## Safety
- NEVER crash Claude Code — always exit(0) on unexpected errors
- MUST wrap all hook logic in try/catch
- MUST log errors to stderr as JSON: `{ "error": "..." }`
- Exception (fail-closed): the 4 blocking security hooks — `config-protection.js`, `no-context-guard.js`, `block-no-verify.js`, `commit-quality.js` — MUST `exit(2)` (block), NOT exit(0), when `parseStdin()` throws or reports truncation. A security control that can't verify its input must fail closed, not silently allow the operation. This is scoped narrowly to the stdin-parse-failure branch only — every OTHER unexpected internal error in those same hooks still follows the exit(0) "never crash" rule above via the outer catch.

## Performance
- observe-pre and observe-post MUST complete in < 50ms (file append only)
- no-context-guard MUST complete in < 100ms (reads observations JSONL)
- All other hooks MUST complete in < 500ms
- Exception: `post-edit-typecheck.js`, `quality-gate.js`, and `post-edit-format.js` legitimately exceed 500ms — they spawn `tsc`/`eslint`/`prettier` and are bounded by that toolchain's runtime, not hook logic. This is documented, not a violation; real optimization is tracked as AUD-31 in BACKLOG.md.

## Data
- Hooks read input from stdin as JSON
- observe hooks write to JSONL files (file append, no DB)
- 11 blocking/warning hooks write to `hook-events.jsonl` via `logHookEvent()` (persisted to SQLite by session-end-all)
- Blocking/warning hooks log `durationMs = Date.now() - start` on every `logHookEvent` call for performance telemetry
- session-end-all extracts agent invocations from `observations.jsonl` and hook events from `hook-events.jsonl`, persists both to DB
- Lifecycle hooks (session-start, session-end-all) may access SQLite via compiled TypeScript in dist/
- MUST run `npm run build` (or project equivalent) before lifecycle hooks can import compiled TypeScript modules from `dist/`

## Plugin-Mode Runtime Resolution

Lifecycle hooks (session-start, session-end-all, pre-compact-save) import from compiled TypeScript in `dist/`. Local-dev mode resolves via repo-root walk; plugin mode resolves via `KADMON_RUNTIME_ROOT` env var set by the plugin manifest. Full reference (resolver logic, plugin cache layout, hooks.json generator contract) — see **`hook-authoring` skill**.

## Windows Compatibility
- Non-critical hooks support `KADMON_DISABLED_HOOKS` env var (comma-separated names to skip)
- MUST use `parseStdin()` helper to sanitize unescaped Windows backslashes in JSON stdin
- Plugin-mode hook command prefix injection + Windows PATH deep detail — see **`hook-authoring` skill**
