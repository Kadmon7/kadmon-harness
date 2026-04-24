---
alwaysApply: true
---

# Hook System Rules

## Exit Codes
- exit(0) = allow the operation to proceed
- exit(1) = warn but allow (non-blocking feedback)
- exit(2) = block the operation

## Hook Catalog (22 registered)

### PreToolUse — Bash matcher (4)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| block-no-verify | block-no-verify.js | Blocks git commands with --no-verify flag | 2 on match |
| commit-format-guard | commit-format-guard.js | Blocks git commits that don't follow conventional commit format | 2 on violation |
| commit-quality | commit-quality.js | Language-aware staged-change scanner (ADR-020): console.log/debugger/secrets in .ts/.js; print()/breakpoint() in .py production code. Skips .md, test files (test_*.py, *_test.py, tests/) and hook files. | 2 on violation |
| git-push-reminder | git-push-reminder.js | Warns before git push if typecheck/tests not run in session, OR if unpushed commits contain production code (scripts/lib/** or .claude/hooks/scripts/** .ts/.js) or touch 10+ files without review. Docs/metadata/config commits are legitimate skip-tier and no longer trigger false warnings. | 1 as warning |

### PreToolUse — Edit|Write matcher (2)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| config-protection | config-protection.js | Protects critical config files from accidental edits | 2 on protected files |
| no-context-guard | no-context-guard.js | Enforces no_context principle — blocks edits without prior Read | 2 on violation |

### PreToolUse — mcp__ matcher (1)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| mcp-health-check | mcp-health-check.js | Validates MCP server health before MCP tool calls | 0 always (stderr warning) |

### PreToolUse — all tools (1)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| observe-pre | observe-pre.js | Logs tool invocation to observations JSONL; captures Agent, TaskCreate, and TaskUpdate metadata | 0 always |

### PostToolUse — Edit|Write matcher (8)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| post-edit-format | post-edit-format.js | Auto-formats edited files after write | 0 always |
| post-edit-typecheck | post-edit-typecheck.js | Language-aware typecheck (ADR-020): .ts/.tsx → `tsc --noEmit`; .py → mypy → pyright → python -m py_compile (first installed). Exits 0 with warning if no Python typechecker is present. | 1 on type errors |
| quality-gate | quality-gate.js | Language-aware lint (ADR-020): .ts/.tsx/.js/.jsx → ESLint; .py → ruff check. Skips with warning if the toolchain is not installed. | 1 on issues |
| ts-review-reminder | ts-review-reminder.js | Warns after 10+ .ts/.tsx/.py edits without code review in session. Counter resets when kody, typescript-reviewer, or python-reviewer is invoked. (Script name retained for backwards compat; rename deferred to 1.3.) | 1 as warning |
| console-log-warn | console-log-warn.js | Warns about console.log() in .ts/.js and print() in .py production code (ADR-020; closes `rules/python/hooks.md` print() mandate) | 1 as warning |
| deps-change-reminder | deps-change-reminder.js | Reminds to run /almanak when package.json, pyproject.toml, or requirements.txt dependencies change (ADR-020) | 1 as warning |
| agent-metadata-sync | agent-metadata-sync.js | Detects edits to `.claude/agents/*.md`, parses YAML frontmatter, and auto-syncs model/trigger changes into the CLAUDE.md agents table + `rules/common/agents.md` catalog. Fast-bails for non-agent files. Test env vars `KADMON_SYNC_CLAUDE_MD_PATH` / `KADMON_SYNC_AGENTS_MD_PATH` are gated to VITEST/NODE_ENV=test. Never exits 2. | 0 ok / 1 on warning |
| post-edit-security | post-edit-security.js | Python SAST: runs `bandit -ll <file>` on .py edits (ADR-027). Warn-only. Graceful fallback when bandit not installed. Skips test files, fixtures, and dep paths. | 1 on findings |

### PostToolUse — Bash matcher (1)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| pr-created | pr-created.js | Detects PR creation and logs PR URL | 0 always |

### PostToolUse — all tools (1)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| observe-post | observe-post.js | Logs tool result to observations JSONL; captures error messages on failures (truncated to 200 chars) | 0 always |

### PostToolUseFailure — mcp__ matcher (1)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| mcp-health-failure | mcp-health-failure.js | Logs MCP server failures for diagnostics | 0 always |

### PreCompact — all (1)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| pre-compact-save | pre-compact-save.js | Saves session state and pending tasks before context compaction | 0 always |

### SessionStart — all (1)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| session-start | session-start.js | Loads 3 recent sessions, shows history trajectory, Pending Work carry-forward, recovers orphaned sessions | 0 always |

### Stop — all (1)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| session-end-all | session-end-all.js | Consolidated Stop hook: persist session + daily log + evaluate patterns + track cost + persist hook events & agent invocations + write marker + cleanup (replaces 4 separate hooks to avoid sql.js race condition) | 0 always |

## Shared Modules (8)

Not registered as hooks — imported by lifecycle hooks as utilities.

| Module | Purpose | Used By |
|--------|---------|---------|
| parse-stdin.js | Sanitize Windows backslashes in JSON stdin | All 22 hooks |
| evaluate-patterns-shared.js | Pattern evaluation against definitions | session-start, session-end-all, pre-compact-save |
| generate-session-summary.js | Heuristic session summary from observations | session-start, session-end-all, pre-compact-save |
| daily-log.js | Append/read daily session logs in memory/logs/ | session-start, session-end-all, pre-compact-save |
| ensure-dist.js | Detect stale dist/ and auto-rebuild | session-start, session-end-all, pre-compact-save |
| hook-logger.js | Persist hook errors to ~/.kadmon/hook-errors.log | session-start, session-end-all, pre-compact-save, evaluate-patterns-shared |
| backup-rotate.js | Maintain 3 timestamped backups of kadmon.db | session-start |
| log-hook-event.js | Append hook execution events to session-scoped JSONL | 9 blocking/warning hooks (persisted to DB by session-end-all) |

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
- Sprint C (2026-04-14) instrumented 9 hooks with `durationMs = Date.now() - start` on every `logHookEvent` call: block-no-verify, commit-format-guard, commit-quality, config-protection, console-log-warn, deps-change-reminder, git-push-reminder, no-context-guard, ts-review-reminder. The `log-hook-event.js` JSDoc now documents `durationMs` as required. ADR-007 fixes the prior bug where `hook_events.duration_ms` was always NULL.
- session-end-all extracts agent invocations from `observations.jsonl` and hook events from `hook-events.jsonl`, persists both to DB
- Lifecycle hooks (session-start, session-end-all) may access SQLite via compiled TypeScript in dist/
- MUST run `npm run build` before lifecycle hooks can access state-store

## Plugin-Mode Runtime Resolution (ADR-010 Phase 1)

- Lifecycle hooks (session-start, session-end-all, pre-compact-save) import from `dist/scripts/lib/*.js` at runtime.
- **Local-dev mode**: `ensure-dist.js#resolveRootDir()` walks 3 levels up from `import.meta.url` to find the repo root.
- **Plugin mode**: `.claude-plugin/hooks.json` sets `KADMON_RUNTIME_ROOT=${CLAUDE_PLUGIN_DATA}` via the generated command prefix, so `resolveRootDir()` points at the plugin cache (`~/.claude/plugins/cache/kadmon-harness/...`). Required — the plugin cache directory does NOT have a predictable depth, so the relative walk would fail.
- MUST leave `KADMON_RUNTIME_ROOT` unset in local dev — the 3-level walk works from repo layout.
- Changing the hook install location (moving `dist/` or the canonical root symlinks) requires updating `ensure-dist.js#resolveRootDir()` and the hooks.json generator in `scripts/generate-plugin-hooks.ts`.

## Windows Compatibility
- All 22 registered hooks run via `${HOOK_CMD_PREFIX}` in `.claude-plugin/hooks.json`, which injects the Node.js PATH and `KADMON_RUNTIME_ROOT` in plugin mode (ADR-010 Phase 1). In local-dev mode the repo-root prefix is resolved via `ensure-dist.js#resolveRootDir()`.
- Non-critical hooks support `KADMON_DISABLED_HOOKS` env var (comma-separated names to skip)
- MUST use `parseStdin()` helper to sanitize unescaped Windows backslashes in JSON stdin
