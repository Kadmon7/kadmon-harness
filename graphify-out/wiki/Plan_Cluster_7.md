# Plan Cluster

> 5 nodes

## Key Concepts

- **Non-auto-loaded CATALOG.md files (agents/hooks/commands)** (4 connections) — `docs/plans/plan-035-rules-catalog-source-of-truth.md`
- **Per-turn context token savings (32.6k -> under 28k Memory files)** (1 connections) — `docs/plans/plan-035-rules-catalog-source-of-truth.md`
- **Manual /context auto-load verification gate (ABORT path)** (1 connections) — `docs/plans/plan-035-rules-catalog-source-of-truth.md`
- **agent-metadata-sync repointed to .claude/agents/CATALOG.md** (1 connections) — `docs/plans/plan-035-rules-catalog-source-of-truth.md`
- **Pointer-not-copy documentation rule (no duplicated enum literal)** (1 connections) — `docs/plans/plan-038-working-docs-status-standard.md`

## Relationships

- No strong cross-community connections detected

## Source Files

- `docs/plans/plan-035-rules-catalog-source-of-truth.md`
- `docs/plans/plan-038-working-docs-status-standard.md`

## Audit Trail

- EXTRACTED: 6 (75%)
- INFERRED: 2 (25%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*