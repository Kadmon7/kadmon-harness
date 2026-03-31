# Kadmon Harness Audit — 2026-03-30

## Summary

| Metric | Count | Status |
|--------|-------|--------|
| Hooks | 22 | OK |
| Agents | 14 (5 opus, 9 sonnet) | OK |
| Skills | 20 | OK |
| Commands | 17 | OK |
| Rules | 15 (9 common + 6 TS) | OK |
| Tests | 154 (16 files) | All passing |
| ADRs | 5 | Current |

## Hooks (22)

### PreToolUse (8)

| Hook | Matcher | Purpose | Status |
|------|---------|---------|--------|
| block-no-verify | Bash | Block --no-verify flag | OK |
| commit-format-guard | Bash | Enforce conventional commits | OK |
| commit-quality | Bash | Validate commit quality/scope | OK |
| git-push-reminder | Bash | Warn before push without /verify | OK |
| config-protection | Edit\|Write | Protect critical config files | OK |
| no-context-guard | Edit\|Write | Block edits without prior Read | OK |
| mcp-health-check | mcp__ | Validate MCP health before calls | OK |
| observe-pre | all | Log tool invocation to JSONL | OK |

### PostToolUse (7)

| Hook | Matcher | Purpose | Status |
|------|---------|---------|--------|
| post-edit-format | Edit\|Write | Auto-format after edits | OK |
| post-edit-typecheck | Edit\|Write | TypeScript typecheck after edits | OK |
| quality-gate | Edit\|Write | Lint/style checks after edits | OK |
| ts-review-reminder | Edit\|Write | Warn after 5+ .ts edits without review | OK |
| console-log-warn | Edit\|Write | Warn about console.log in production | OK |
| pr-created | Bash | Log PR URL on creation | OK |
| observe-post | all | Log tool result to JSONL | OK |

### PostToolUseFailure (1)

| Hook | Matcher | Purpose | Status |
|------|---------|---------|--------|
| mcp-health-failure | mcp__ | Log MCP failures | OK |

### Lifecycle (6)

| Hook | Event | Purpose | Status |
|------|-------|---------|--------|
| pre-compact-save | PreCompact | Save session state + summary + instincts before compact | OK |
| session-start | SessionStart | Load context, recover orphans, init session | OK |
| session-end-persist | Stop | Persist final summary, tasks, counts | OK |
| evaluate-session | Stop | Evaluate patterns, create/reinforce instincts | OK |
| cost-tracker | Stop | Track token usage and cost | OK |
| session-end-marker | Stop | Write clean-exit marker | OK |

### Utilities (3, not hooks)

| File | Purpose |
|------|---------|
| parse-stdin.js | Shared stdin parser (sanitizes Windows backslashes) |
| generate-session-summary.js | Heuristic summary generator (no LLM) |
| evaluate-patterns-shared.js | Pattern matching shared between compact and stop |

### Removed Hooks

| Hook | Removed | Reason |
|------|---------|--------|
| suggest-compact | 2026-03-30 | Redundant — /kompact and status line replaced it |

## Session Persistence

| Scenario | messageCount | filesModified | summary | cost | instincts |
|----------|-------------|---------------|---------|------|-----------|
| Clean exit (Stop) | Saved | Saved | Saved | Saved | Evaluated |
| /compact (PreCompact) | Saved | Saved | Saved | Not saved | Evaluated |
| Crash/terminal close | Recovered on next start | Recovered if obs exist | Recovered if obs exist | Lost | Lost |

Key improvement this session: pre-compact-save now persists summary/tasks/counts, and session-start recovers orphaned sessions.

## Agents (14)

| Agent | Model | Status |
|-------|-------|--------|
| architect | opus | OK |
| planner | opus | OK |
| code-reviewer | sonnet | OK |
| database-reviewer | opus | OK |
| security-reviewer | opus | OK |
| tdd-guide | sonnet | OK |
| build-error-resolver | sonnet | OK |
| refactor-cleaner | sonnet | OK |
| performance-optimizer | sonnet | OK |
| python-reviewer | sonnet | OK |
| docs-lookup | sonnet | OK |
| doc-updater | sonnet | OK |
| e2e-runner | sonnet | OK |
| harness-optimizer | opus | OK |

## Commands (17)

| Phase | Commands | Count |
|-------|----------|-------|
| Observe | /dashboard, /kompact | 2 |
| Remember | /checkpoint, /docs, /update-docs | 3 |
| Verify | /tdd, /verify, /build-fix, /code-review, /test-coverage, /e2e, /eval | 7 |
| Specialize | /kplan, /workflow | 2 |
| Evolve | /instinct, /evolve, /refactor-clean | 3 |

## Skills (20)

All 20 skills present in .claude/skills/. Categories: Workflow (2), Quality (4), Learning (2), Architecture (2), Data (4), Integration (2), Orchestration (1), Debugging (1), Review (1), Safety (1).

## Known Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| Cost not tracked on /compact | Sessions through compact show $0.00 | Low — cost-tracker needs transcript_path from Stop event |
| Instincts all at 0.8-0.9 | No differentiation — all 10 are promotable | Medium — need to use on real project to generate diverse instincts |
| Stop hooks don't fire on /kompact | Some data only saved by pre-compact-save | Low — mitigated by orphan recovery |
| No Supabase sync yet | Data only on local machine | Low — v2 feature |

## Recommendations

1. **Use harness on a real project** (ToratNetz or KAIRON) to validate instincts with real patterns
2. **Prune saturated instincts** — all 10 at 0.8+ means they've learned all they can from harness dev
3. **Create ADR-006** when Supabase sync design begins
4. **Consider auto-pruning** instincts > 30 days without reinforcement

## Previous Audit

Genesis audit (2026-03-26) moved to docs/genesis/harness-audit-2026-03-26.md.
That audit documented 20 hooks, 14 agents — since then: suggest-compact removed, oren agent removed, session persistence improved.
