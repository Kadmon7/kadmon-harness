---
number: 1
title: Kadmon Harness v0.3 Foundations (Archived)
date: 2026-04
status: accepted
route: A
plan: plan-001-v03-archive.md
---

# ADR-001: Kadmon Harness v0.3 Foundations (Archived)

> Status: Archived — all decisions implemented as of v0.3.4
> Consolidates: ADR-001 through ADR-008 (2026-03 to 2026-04)

## Decision Summary

| # | Title | Decision | Date |
|---|-------|----------|------|
| 001 | Dual Persistence | SQLite write-first local store. Supabase sync deferred to v2 via queue table. | 2026-03 |
| 002 | No Bash, No Python | All hooks and scripts are Node.js only. Windows-native, no WSL dependency. | 2026-03 |
| 003 | Single Hook Profile | One profile, all hooks always active. No run-with-flags dispatcher. | 2026-03 |
| 004 | no-context-guard | PreToolUse hook on Edit/Write blocks edits without prior Read. Enforces no_context principle. | 2026-03 |
| 005 | Ephemeral Observations | Per-session JSONL in /tmp, NOT SQLite. Summarized to DB at session end. Observe hooks < 50ms. | 2026-03 |
| 006 | Context Management | Three-tier architecture: always-loaded (18K), conditional (2K), on-demand (77K). 91% context free. | 2026-04 |
| 007 | Post-Compact Reinjection | session-start reads SQLite + daily log + feedback memories after compaction. Daily logs in memory/logs/. | 2026-04 |
| 008 | v1.0 Prioritization | P0/P1/P2 tiers with themed sprints. Gate: use harness on real ToratNetz feature. | 2026-04 |

## Details

### 001: Dual Persistence (SQLite + Supabase)
SQLite is the write-first local store at `~/.kadmon/kadmon.db`. Every write goes to SQLite immediately. sync_queue table is created in schema to prepare for v2 Supabase sync. Zero-latency writes, offline resilience.

### 002: No Bash Scripts, No Python
ECC's .sh scripts and Python CLI were fragile on Windows. Rewritten everything in Node.js/TypeScript. All temp files use `os.tmpdir()`. No shell scripts, no Python runtime dependency.

### 003: Single Hook Profile
ECC had three profiles (minimal/standard/strict). Kadmon uses a single profile — all hooks always active. To disable, use `KADMON_DISABLED_HOOKS` env var or remove from settings.json. Simplicity over flexibility.

### 004: no-context-guard as PreToolUse Hook
Enforces the no_context principle at the tool level. Blocks Edit/Write if the file or directory was not previously Read/Grep/Glob'd. Exceptions for test files, markdown, JSON configs. Override via `KADMON_NO_CONTEXT_GUARD=off`.

### 005: Ephemeral Observations as JSONL
Observe hooks (pre/post) run on every tool call and must be < 50ms. Writing to SQLite would add latency. Solution: append to `/tmp/kadmon/<session-id>/observations.jsonl`. At session end, observations are summarized and summary persisted to SQLite.

### 006: Context Management Strategy
Three-tier architecture: Tier 1 (always-loaded, 18K tokens — rules, CLAUDE.md, MEMORY.md), Tier 2 (conditional, 2K — TypeScript rules on .ts edits), Tier 3 (on-demand, 77K — agent/skill/command files). Pattern evaluation at all lifecycle points: Stop, PreCompact, and crash recovery via SessionStart.

### 007: Post-Compact Context Reinjection
After compaction, session-start detects `compactionCount > 0` and outputs enriched context: current session summary, pending tasks, feedback memories, and today's daily log. Writers: pre-compact-save.js and session-end-all.js append to `memory/logs/YYYY-MM-DD.md`. Implemented via daily-log.js shared module.

### 008: v1.0 Roadmap Prioritization
Framework: P0 = failure (harness breaks), P1 = risk (failures unnoticed), P2 = inconvenience. Themed sprints of 2-4 items. Gate test after P0 sprints. Sprint A (hook reliability) and Sprint B (data cleanup) completed as the final v1.0 items. Sprint C (ToratNetz validation) moved to first post-v1.0 usage.
