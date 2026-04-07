# Kadmon Harness — Genesis

> Built: 2026-03 to 2026-04
> Method: 10 iterative prompts refining architecture, hooks, agents, and testing
> Source prompts: preserved in git history (`docs/genesis/prompt-*-output.md`)

## What It Is

An operative layer for Claude Code — infrastructure that makes every session smarter than the last. Built once, carried to every project.

## Components (v1.0)

- **15 agents** (6 opus, 9 sonnet) with rich descriptions and skill linkages
- **22 skills** domain knowledge loaded on demand
- **12 commands** organized by lifecycle: Observe, Plan, Build, Scan, Remember, Evolve
- **20 hooks** (PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, SessionStart, Stop)
- **19 rules** (9 common + 5 TypeScript + 5 Python) with alwaysApply and glob triggers
- **289 tests** across 33 test files, 0 failures

## Architecture

### Orchestration Chain
Each command specifies which agent to invoke and which skills to load:
```
/abra-kdabra -> arkitect + konstruct + feniks + kody -> architecture-decision-records, tdd-workflow
/chekpoint   -> kody + 4 parallel reviewers          -> full verification + commit
/medik       -> mekanik + kurator                     -> systematic-debugging, coding-standards
/skanner     -> arkonte + kartograf                   -> context-budget, e2e-testing
```

### Persistence
- SQLite local (`~/.kadmon/kadmon.db`) — sessions, instincts, cost_events, sync_queue
- Ephemeral observations in JSONL (`/tmp/kadmon/{sid}/observations.jsonl`)
- Orphan recovery: crashed sessions recovered on next start
- Pattern evaluation at all lifecycle points: Stop, PreCompact, crash recovery

### Context Footprint
- ~18K tokens always-loaded (9% of 200K, 1.8% of 1M)
- Three tiers: always-loaded (rules, CLAUDE.md), conditional (TS rules), on-demand (agents, skills)
- Post-compact reinjection: daily logs + feedback memories + session state

### Hook Reliability (v1.0)
- Auto-build: `ensure-dist.js` detects stale dist/ and rebuilds before lifecycle hooks
- Error logging: `hook-logger.js` persists errors to `~/.kadmon/hook-errors.log`
- Backup rotation: `backup-rotate.js` maintains 3 timestamped backups of kadmon.db
- Health check: session-start banner warns if dist/ is stale after auto-build attempt

## Architectural Decisions

All 8 founding ADRs consolidated in `docs/decisions/ADR-001-v03-foundations.md`:

| # | Decision | Why |
|---|----------|-----|
| 001 | SQLite local + Supabase planned | Speed local, sync future |
| 002 | Node.js only (no Bash/Python) | Windows-native, consistent |
| 003 | Single hook profile | Simplicity over flexibility |
| 004 | no-context-guard mandatory | Enforce read-before-write |
| 005 | Ephemeral observations as JSONL | Speed (<50ms), no SQLite contention |
| 006 | Three-tier context management | 91% context free for projects |
| 007 | Post-compact context reinjection | Preserve working state across compaction |
| 008 | P0/P1/P2 prioritization for v1.0 | Ship Sprint A+B, defer the rest |

## Known Limitations

- Cost tracking uses estimation (Claude Code does not send real token data)
- Sessions are project-scoped (not shared across projects)
- Instincts are passive (inform but don't warn proactively — deferred to v1.1)
- Only 13 pattern definitions (all TS/Node — git, security, DB patterns deferred to v1.1)
- Summary is heuristic ("Edited 4 files") — does not capture intent

## Genesis Timeline

1. **2026-03**: 10 prompts built the foundation — hooks, agents, skills, commands, testing
2. **2026-03-30**: v0.3 consolidated — 154 tests, 14 agents, 20 skills, 22 hooks
3. **2026-04-01**: ADR-008 prioritization, roadmap restructure
4. **2026-04-04**: Memory system design, agent renaming (K-convention)
5. **2026-04-05**: v1.0 Sprint A+B — hook reliability + data cleanup (289 tests)
