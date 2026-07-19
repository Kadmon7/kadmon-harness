# Agent Docs

> 8 nodes

## Key Concepts

- **orakle (DB Specialist, sonnet)** (4 connections) — `.claude/agents/orakle.md`
- **Test anti-patterns (mocking what you own, shared state, testing implementation details)** (2 connections) — `.claude/agents/feniks.md`
- **sql.js patterns (saveToDisk timing, :memory: for tests, WASM path on Windows)** (2 connections) — `.claude/agents/orakle.md`
- **Idempotent migrations + index-every-foreign-key principle** (2 connections) — `.claude/agents/orakle.md`
- **agent_invocations.tool_use_id 4-col unique index + forward migration (AUD-29)** (2 connections) — `CHANGELOG.md`
- **AUD-41 - per-fork upgrade runbook (Sentinel-harness + Kadmon7Cowork-Harness, shared-DB gotcha)** (2 connections) — `BACKLOG.md`
- **WORK - plan-036 Sentinel-harness fork (in flight elsewhere)** (2 connections) — `WORK.md`
- **C-002 - never revert unrecognized working-tree changes** (1 connections) — `CORRECTIONS.md`

## Relationships

- [Architect & Alchemist Agents](Architect_%26_Alchemist_Agents.md) (2 shared connections)
- [Agent Docs](Agent_Docs.md) (1 shared connections)

## Source Files

- `.claude/agents/feniks.md`
- `.claude/agents/orakle.md`
- `BACKLOG.md`
- `CHANGELOG.md`
- `CORRECTIONS.md`
- `WORK.md`

## Audit Trail

- EXTRACTED: 11 (65%)
- INFERRED: 4 (24%)
- AMBIGUOUS: 2 (12%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*