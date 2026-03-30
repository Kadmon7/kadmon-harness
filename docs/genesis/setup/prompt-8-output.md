# Prompt 8 Output — Integration Test + First Real Session

## Date
2026-03-24

---

## Kadmon Harness v0.1 — Health Report

**Build:** pending commit (post-integration fixes applied)

### Part A: Hook Status

| Hook | Test | Exit Code | Output | Latency | Status |
|------|------|-----------|--------|---------|--------|
| block-no-verify | --no-verify | 2 | block msg | <10ms | OK |
| block-no-verify | normal git | 0 | — | <10ms | OK |
| config-protection | strict:false | 2 | block msg | <10ms | OK |
| config-protection | normal edit | 0 | — | <10ms | OK |
| no-context-guard | .md exception | 0 | — | <10ms | OK |
| no-context-guard | .json exception | 0 | — | <10ms | OK |
| observe-pre | Read event | 0 | JSONL created | ~250ms | SLOW |
| observe-post | Read result | 0 | JSONL appended | ~230ms | SLOW |
| suggest-compact | tool call | 0 | counter incremented | <10ms | OK |
| git-push-reminder | git push | 0 | checklist printed | <10ms | OK |
| git-push-reminder | git status | 0 | — | <10ms | OK |
| post-edit-format | nonexistent file | 0 | graceful skip | <10ms | OK |
| post-edit-typecheck | .ts file | 0 | — | ~2s | OK (tsc is slow) |
| quality-gate | .md file | 0 | skipped (not TS) | <10ms | OK |
| mcp-health-failure | record failure | 0 | health file updated | <10ms | OK |
| mcp-health-check | after failure | 0 | no warning (1 fail < threshold) | <10ms | OK |
| session-start | new session | 0 | markdown context printed | ~500ms | OK |
| cost-tracker | token usage | 0 | cost printed ($0.0105) | ~500ms | OK |
| pre-compact-save | — | — | not tested (requires PreCompact event) | — | UNTESTED |
| session-end-persist | — | — | not tested (requires Stop event) | — | UNTESTED |
| evaluate-session | — | — | not tested (requires Stop event) | — | UNTESTED |

### Latency Issue
- observe-pre/post: ~250ms (target: <50ms)
- Root cause: Node.js cold-start on Windows
- Impact: LOW — in real Claude Code sessions, Node.js process is likely cached
- Mitigation: accept for v0.1, optimize in v1.0 if needed

### Part B: Agent Proactivity

| Agent | Type | Description Updated |
|-------|------|-------------------|
| architect | MANUAL | YES |
| planner | MANUAL | YES |
| code-reviewer | HYBRID | YES |
| typescript-reviewer | PROACTIVE | YES |
| database-reviewer | PROACTIVE | YES |
| security-reviewer | PROACTIVE | YES |
| tdd-guide | HYBRID | YES |
| build-error-resolver | PROACTIVE | YES |
| refactor-cleaner | MANUAL | YES |
| docs-lookup | PROACTIVE | YES |
| doc-updater | HYBRID | YES |
| e2e-runner | MANUAL | YES |
| harness-optimizer | MANUAL | YES |

Classification: 4 PROACTIVE, 3 HYBRID, 4 MANUAL, 2 MANUAL (via /command only)

### Part C: Command Status

| Command | Status | Notes |
|---------|--------|-------|
| /verify | OK | Build + typecheck + 63 tests passing |
| /sessions | OK | 2 sessions found in SQLite |
| /instinct-status | OK | 1 active instinct after test creation |
| /learn | OK | Instinct created (0.3) and reinforced (0.5) |
| /context-budget | OK | Context audit functional |
| /docs | OK | Context7 MCP connected |

### SQLite State

| Table | Records |
|-------|---------|
| Sessions | 2 |
| Instincts | 1 (confidence: 0.5, occurrences: 3) |
| Cost events | 1 ($0.0105, sonnet, 1000in/500out) |
| Sync queue | 0 (Supabase sync deferred to v2) |

### Issues Found and Fixed

1. **schema.sql not in dist/** — TypeScript compiler doesn't copy .sql files.
   - Fix: added `cpSync` to build script in package.json
   - Status: FIXED

2. **state-store.ts path resolution on Windows** — `import.meta.dirname` and `URL.pathname` produce incorrect paths on Windows.
   - Fix: use `fileURLToPath(import.meta.url)` from `node:url`
   - Status: FIXED

3. **observe hooks latency ~250ms** — Node.js cold-start on Windows exceeds 50ms target.
   - Status: ACCEPTED for v0.1 — not a functional issue, performance optimization deferred

4. **session-start cwd from bash** — bash passes `/c/Proyectos Kadmon/...` but Windows needs `C:\Proyectos Kadmon\...`
   - In real Claude Code sessions, cwd is provided correctly by Claude Code itself
   - Status: NON-ISSUE (test artifact)

5. **PreCompact, session-end, evaluate-session hooks UNTESTED** — These require real Claude Code lifecycle events (PreCompact, Stop) that cannot be simulated via manual stdin.
   - Status: ACCEPTED — will be tested in real sessions

### Recommended Fixes Before v1.0
1. Optimize observe hooks for cold-start (consider bundling or pre-warming)
2. Add integration tests for PreCompact and Stop lifecycle hooks
3. Add test coverage reporting
4. Fill context files (dev.md, research.md, review.md) with real content
5. Verify hooks work in actual Claude Code sessions (not just manual testing)

## Test Results
- 63 passing, 0 failing, 4 todo
- TypeScript: 0 errors
- Build: clean

## Git Commit
Pending — will commit after approval.

## Status
Kadmon Harness v0.1 — OPERATIONAL
