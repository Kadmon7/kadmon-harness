---
name: hooks-catalog
description: Full hook catalog (22 registered hooks + 9 shared modules) with matchers, scripts, purposes, and exit codes. Read on-demand by /doks drift detection and human readers. Source-of-truth; rules reference this file via pointer.
---

<!-- DO NOT AUTO-LOAD: this file is read on-demand by /doks and human readers. Lives outside .claude/rules/ to avoid eager context injection. See ADR-035. -->

# Hook Catalog

## Hook Catalog (22 registered)

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
| session-end-all | session-end-all.js | Consolidated Stop hook: persist session + daily log + evaluate patterns + track cost + persist hook events & agent invocations + write marker + cleanup (single hook avoids races on shared SQLite handle) | 0 always |

## Shared Modules (9)

Not registered as hooks — imported by lifecycle hooks as utilities.

| Module | Purpose | Used By |
|--------|---------|---------|
| parse-stdin.js | Sanitize Windows backslashes in JSON stdin | All 22 hooks |
| evaluate-patterns-shared.js | Pattern evaluation against definitions | session-start, session-end-all, pre-compact-save |
| generate-session-summary.js | Heuristic session summary from observations | session-start, session-end-all, pre-compact-save |
| daily-log.js | Append/read daily session logs in memory/logs/ | session-start, session-end-all, pre-compact-save |
| ensure-dist.js | Detect stale dist/ and auto-rebuild | session-start, session-end-all, pre-compact-save |
| hook-logger.js | Persist hook errors to a local log file | session-start, session-end-all, pre-compact-save, evaluate-patterns-shared |
| backup-rotate.js | Maintain 3 timestamped backups of the local SQLite database | session-start |
| log-hook-event.js | Append hook execution events to session-scoped JSONL | 9 blocking/warning hooks (persisted to DB by session-end-all) |
| install-diagnostic.js | Append InstallHealthReport to `~/.kadmon/install-diagnostic.log` on every session-start (ADR-024). Test-env guard redirects to stderr. | session-start |
