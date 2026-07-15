---
name: hooks-catalog
description: Full hook catalog (23 registered hooks + 12 shared modules) with matchers, scripts, purposes, and exit codes. Read on-demand by /doks drift detection and human readers. Source-of-truth; rules reference this file via pointer.
---

<!-- DO NOT AUTO-LOAD: this file is read on-demand by /doks and human readers. Lives outside .claude/rules/ to avoid eager context injection. See ADR-035. -->

# Hook Catalog

## Hook Catalog (23 registered)

### UserPromptSubmit — all (1)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| graphify-reminder | inline command in `.claude/settings.json` (no separate script file) | Query-first nudge: when `graphify-out/graph.json` exists, injects `additionalContext` reminding Claude to run `graphify query/path/explain` (or read `GRAPH_REPORT.md`) before grepping or answering an architecture/codebase question from memory. Added `4415674`, 2026-06-24. | 0 always (`\|\| true`; never blocks the prompt) |

> **Co-installed graphify sibling (documented, not separately counted):** `graphify claude install` also writes a second inline injector to `.claude/settings.json` — a `PreToolUse` `Glob|Grep` hook, `graph.json`-gated like `graphify-reminder`, that nudges reading `GRAPH_REPORT.md` before raw-file searches. It reinforces the same query-first behavior and is external-tool-provided, so the "23 registered" total treats the two graphify nudges as one mechanism (the `UserPromptSubmit` entry above) rather than enumerating the `Glob|Grep` entry separately. The harness plugin itself ships **22 script hooks** (`hooks.json`); the graphify nudges arrive via the graphify install script, not the plugin.

### PreToolUse — Bash matcher (4)
| Hook | Script | Purpose | Exit |
|------|--------|---------|------|
| block-no-verify | block-no-verify.js | Blocks git commands with --no-verify flag | 2 on match |
| commit-format-guard | commit-format-guard.js | Blocks git commits that don't follow conventional commit format | 2 on violation |
| commit-quality | commit-quality.js | Language-aware staged-change scanner: console.log/debugger/secrets in .ts/.js; print()/breakpoint() in .py production code. Skips .md, test files (test_*.py, *_test.py, tests/) and hook files. | 2 on violation |
| git-push-reminder | git-push-reminder.js | Warns before git push if typecheck/tests not run in session, OR if unpushed commits contain production code (project source tree or hook scripts) or touch 10+ files without review. Docs/metadata/config commits are legitimate skip-tier and no longer trigger false warnings. | 1 as warning |

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
| post-edit-typecheck | post-edit-typecheck.js | Language-aware typecheck: .ts/.tsx → `tsc --noEmit`; .py → mypy → pyright → python -m py_compile (first installed). Exits 0 with warning if no Python typechecker is present. | 1 on type errors |
| quality-gate | quality-gate.js | Language-aware lint: .ts/.tsx/.js/.jsx → ESLint; .py → ruff check. Skips with warning if the toolchain is not installed. | 1 on issues |
| ts-review-reminder | ts-review-reminder.js | Warns after 10+ .ts/.tsx/.py edits without code review in session. Counter resets when kody, typescript-reviewer, or python-reviewer is invoked. | 1 as warning |
| console-log-warn | console-log-warn.js | Warns about console.log() in .ts/.js and print() in .py production code | 1 as warning |
| deps-change-reminder | deps-change-reminder.js | Reminds to run /almanak when package.json, pyproject.toml, or requirements.txt dependencies change | 1 as warning |
| agent-metadata-sync | agent-metadata-sync.js | Detects edits to `.claude/agents/*.md`, parses YAML frontmatter, and auto-syncs model/trigger changes into the CLAUDE.md agents table + agents catalog. Fast-bails for non-agent files. Never exits 2. | 0 ok / 1 on warning |
| post-edit-security | post-edit-security.js | Python SAST: runs `bandit -ll <file>` on .py edits. Warn-only. Graceful fallback when bandit not installed. Skips test files, fixtures, and dep paths. | 1 on findings |

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
| session-end-all | session-end-all.js | Consolidated Stop hook: persist session + daily log + evaluate patterns + track cost + persist hook events & agent invocations + write marker + cleanup + `/evolve` cadence nudge (single hook avoids races on shared SQLite handle) | 0 always |

## Shared Modules (12)

Not registered as hooks — imported by lifecycle hooks as utilities.

| Module | Purpose | Used By |
|--------|---------|---------|
| parse-stdin.js | Sanitize Windows backslashes in JSON stdin; strip `__proto__`/`constructor`/`prototype` own keys before returning (AUD-15) | All 22 hooks |
| safe-session-dir.js | Validate session_id against `/^[a-zA-Z0-9_-]+$/` and join it onto a base dir; returns null (never throws) on invalid input (AUD-15) | observe-pre, observe-post, log-hook-event, git-push-reminder, no-context-guard, ts-review-reminder, session-start, session-end-all, pre-compact-save, evaluate-patterns-shared |
| scrub-secrets.js | Redact credentials (API keys, tokens, key=value pairs) from strings before persistence (AUD-02) | observe-pre, observe-post |
| evaluate-patterns-shared.js | Pattern evaluation against definitions | session-start, session-end-all, pre-compact-save |
| generate-session-summary.js | Heuristic session summary from observations | session-start, session-end-all, pre-compact-save |
| daily-log.js | Append/read daily session logs in memory/logs/ | session-start, session-end-all, pre-compact-save |
| ensure-dist.js | Detect stale dist/ and auto-rebuild | session-start, session-end-all, pre-compact-save |
| hook-logger.js | Persist hook errors to a local log file | session-start, session-end-all, pre-compact-save, evaluate-patterns-shared |
| backup-rotate.js | Maintain 3 timestamped backups of the local SQLite database | session-start |
| log-hook-event.js | Append hook execution events to session-scoped JSONL | 9 blocking/warning hooks (persisted to DB by session-end-all) |
| install-diagnostic.js | Append InstallHealthReport to `~/.kadmon/install-diagnostic.log` on every session-start (ADR-024). Test-env guard redirects to stderr. | session-start |
| resolve-bin.js | Resolve a toolchain CLI (tsc/eslint/prettier) to its real JS entry point in `node_modules` so hooks spawn it via `node <entry>` instead of `npx` — avoids per-edit npm resolution cost and the Windows `.cmd`/`shell:true` injection surface (CVE-2024-27980). Returns null when no local install found (callers fall back to npx/warn). AUD-31. | post-edit-format, post-edit-typecheck, quality-gate |
