---
alwaysApply: true
---

# Hook System Rules

## Exit Codes
- exit(0) = allow the operation to proceed
- exit(1) = warn but allow (non-blocking feedback)
- exit(2) = block the operation

## Hook Catalog (22)

### PreToolUse — Bash matcher (4)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| block-no-verify | block-no-verify.js | Blocks git commands with --no-verify flag | 2 on match |
| commit-format-guard | commit-format-guard.js | Blocks git commits that don't follow conventional commit format | 2 on violation |
| commit-quality | commit-quality.js | Scans staged changes for console.log, debugger, secrets (skips .md, test, and hook files) | 2 on violation |
| git-push-reminder | git-push-reminder.js | Reminds to run /verify before git push | 1 as warning |

### PreToolUse — Edit|Write matcher (2)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| config-protection | config-protection.js | Protects critical config files from accidental edits | 2 on protected files |
| no-context-guard | no-context-guard.js | Enforces no_context principle — blocks edits without prior Read | 2 on violation |

### PreToolUse — mcp__ matcher (1)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| mcp-health-check | mcp-health-check.js | Validates MCP server health before MCP tool calls | 1 on unhealthy |

### PreToolUse — all tools (1)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| observe-pre | observe-pre.js | Logs tool invocation to observations JSONL; captures Agent, TaskCreate, and TaskUpdate metadata | 0 always |

### PostToolUse — Edit|Write matcher (5)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| post-edit-format | post-edit-format.js | Auto-formats edited files after write | 0 always |
| post-edit-typecheck | post-edit-typecheck.js | Runs TypeScript typecheck on edited .ts/.tsx files | 1 on type errors |
| quality-gate | quality-gate.js | Runs quality checks (lint, style) on edited files | 1 on issues |
| ts-review-reminder | ts-review-reminder.js | Warns after 5+ .ts edits without code review in session | 1 as warning |
| console-log-warn | console-log-warn.js | Warns about console.log() in production code | 1 as warning |

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

### Stop — all (4)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| session-end-persist | session-end-persist.js | Persists session summary, task lifecycle, and error context to SQLite | 0 always |
| evaluate-session | evaluate-session.js | Evaluates session quality and updates instinct confidence | 0 always |
| cost-tracker | cost-tracker.js | Tracks token usage and cost per session (observations-based fallback when transcript unavailable) | 0 always |
| session-end-marker | session-end-marker.js | Marks session end for lifecycle tracking | 0 always |

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
- Lifecycle hooks (session-start, session-end-persist, evaluate-session, cost-tracker) may access SQLite via compiled TypeScript in dist/
- MUST run `npm run build` before lifecycle hooks can access state-store

## Windows Compatibility
- All 22 hooks use `PATH="$PATH:/c/Program Files/nodejs"` prefix for Node.js resolution
- Non-critical hooks support `KADMON_DISABLED_HOOKS` env var (comma-separated names to skip)
- MUST use `parseStdin()` helper to sanitize unescaped Windows backslashes in JSON stdin
