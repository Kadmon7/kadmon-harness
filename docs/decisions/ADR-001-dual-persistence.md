# ADR-001: Dual Persistence (SQLite + Supabase)

## Status
Accepted (v1: SQLite only; v2: add Supabase sync)

## Context
The harness needs to persist sessions, instincts, and cost events. Options: SQLite only, Supabase only, or both.

## Decision
SQLite is the write-first local store. Every write goes to SQLite immediately. In v2, Supabase sync will be added as async via a queue table. This ensures zero-latency writes and offline resilience. Supabase will become the queryable source of truth for cross-session analysis.

## Consequences
- All writes succeed locally even without internet
- Data is queryable across sessions via SQLite in v1
- sync_queue table is created in v1 schema to prepare for v2
- Cross-machine sync requires Supabase (v2)
