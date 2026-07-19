# Forge-Evolve Plan Lineage

> 21 nodes

## Key Concepts

- **forge-pipeline — pure pipeline with preview gate** (6 connections) — `docs/plans/plan-005-forge-evolve-pipeline.md`
- **Plan-005 — Refactor /instinct to /forge with unified pipeline** (4 connections) — `docs/plans/plan-005-forge-evolve-pipeline.md`
- **ClusterReport handoff contract (schemaVersion 1)** (4 connections) — `docs/plans/plan-005-forge-evolve-pipeline.md`
- **Plan-006 — Domain pattern engine (Sprint A v1.1)** (3 connections) — `docs/plans/plan-006-domain-pattern-engine.md`
- **tool_arg_presence pattern type + detectToolArgPresencePattern** (3 connections) — `docs/plans/plan-006-domain-pattern-engine.md`
- **runEvolveGenerate — pure proposal pipeline** (3 connections) — `docs/plans/plan-008-evolve-generate-pipeline.md`
- **Single-mutator rule — applyForgePreview is the only DB writer** (2 connections) — `docs/plans/plan-005-forge-evolve-pipeline.md`
- **file_sequence pattern type + detectFileSequencePattern** (2 connections) — `docs/plans/plan-006-domain-pattern-engine.md`
- **readClusterReportsInWindow — windowed merge by instinctId** (2 connections) — `docs/plans/plan-008-evolve-generate-pipeline.md`
- **projectHash cross-project isolation invariant** (2 connections) — `docs/plans/plan-008-evolve-generate-pipeline.md`
- **decayInstincts — 0.02 per week confidence decay** (2 connections) — `docs/plans/plan-018-ecc-features-port.md`
- **instincts.last_observed_at column + migrate-v0.5** (2 connections) — `docs/plans/plan-018-ecc-features-port.md`
- **Cross-project promotion to scope=global (2 projects, avg conf >= 0.8)** (2 connections) — `docs/plans/plan-018-ecc-features-port.md`
- **forge-report-writer — retention policy and export serializer** (1 connections) — `docs/plans/plan-005-forge-evolve-pipeline.md`
- **/instinct deprecation alias resolver** (1 connections) — `docs/plans/plan-005-forge-evolve-pipeline.md`
- **observe-pre metadata.skillName capture for Skill tool** (1 connections) — `docs/plans/plan-006-domain-pattern-engine.md`
- **applyEvolveGenerate — transactional single filesystem mutator** (1 connections) — `docs/plans/plan-008-evolve-generate-pipeline.md`
- **research_finding observation filter (R5 signal-pollution guard)** (1 connections) — `docs/plans/plan-015-skavenger-ultimate-researcher.md`
- **Plan-018 — Port ECC features into the harness** (1 connections) — `docs/plans/plan-018-ecc-features-port.md`
- **Artifact-choice rubric in alchemik (workflow/behavior/process)** (1 connections) — `docs/plans/plan-018-ecc-features-port.md`
- **user_correction detector RULED OUT (hooks see no user messages)** (1 connections) — `docs/plans/plan-018-ecc-features-port.md`

## Relationships

- [Plan Cluster](Plan_Cluster.md) (1 shared connections)

## Source Files

- `docs/plans/plan-005-forge-evolve-pipeline.md`
- `docs/plans/plan-006-domain-pattern-engine.md`
- `docs/plans/plan-008-evolve-generate-pipeline.md`
- `docs/plans/plan-015-skavenger-ultimate-researcher.md`
- `docs/plans/plan-018-ecc-features-port.md`

## Audit Trail

- EXTRACTED: 41 (91%)
- INFERRED: 4 (9%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*