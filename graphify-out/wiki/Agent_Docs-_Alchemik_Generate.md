# Agent Docs: Alchemik Generate

> 8 nodes

## Key Concepts

- **Instinct system (confidence 0.3 start, promote at >=0.7 and >=3 occurrences)** (4 connections) — `README.md`
- **observations.archive.jsonl fix - /forge and /kompact went blind on long sessions** (4 connections) — `CHANGELOG.md`
- **Session lifecycle (SessionStart -> PreCompact -> Stop, orphan recovery)** (2 connections) — `README.md`
- **Generate step 6 (propose artifacts from /forge ClusterReports, propose-only)** (2 connections) — `.claude/agents/alchemik.md`
- **BACKLOG - orphan-recovery read path parity (session-start reads live-only)** (2 connections) — `BACKLOG.md`
- **BACKLOG - /forge and /kompact blind on long sessions (observations.jsonl wiped per Stop)** (1 connections) — `BACKLOG.md`
- **BACKLOG - ECC validation experiment (8 YAML seed instincts gating /instinct-import, OVERDUE)** (1 connections) — `BACKLOG.md`
- **BACKLOG - v2.0 ECC-delta ports track (Waves 0-4)** (1 connections) — `BACKLOG.md`

## Relationships

- [Backlog & Release Notes](Backlog_%26_Release_Notes.md) (1 shared connections)
- [Architect & Alchemist Agents](Architect_%26_Alchemist_Agents.md) (1 shared connections)
- [Agent Docs: Doks Catalog](Agent_Docs-_Doks_Catalog.md) (1 shared connections)

## Source Files

- `.claude/agents/alchemik.md`
- `BACKLOG.md`
- `CHANGELOG.md`
- `README.md`

## Audit Trail

- EXTRACTED: 8 (47%)
- INFERRED: 9 (53%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*