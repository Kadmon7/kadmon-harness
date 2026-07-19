# ADR: Forge-Evolve IPC

> 18 nodes

## Key Concepts

- **ADR-005 /forge Unified Pipeline and /evolve Handoff** (5 connections) — `docs/decisions/ADR-005-forge-evolve-pipeline.md`
- **/forge 8-Step Unified Pipeline** (5 connections) — `docs/decisions/ADR-005-forge-evolve-pipeline.md`
- **ClusterReport Handoff Contract** (5 connections) — `docs/decisions/ADR-005-forge-evolve-pipeline.md`
- **Ephemeral Observations as JSONL** (4 connections) — `docs/decisions/ADR-001-v03-foundations.md`
- **ADR-008 /evolve Generate Step 6** (4 connections) — `docs/decisions/ADR-008-evolve-generate-pipeline.md`
- **runEvolveGenerate Pure Pipeline** (4 connections) — `docs/decisions/ADR-008-evolve-generate-pipeline.md`
- **agent-metadata-sync PostToolUse Hook** (4 connections) — `docs/decisions/ADR-008-evolve-generate-pipeline.md`
- **ADR-006 Domain Pattern Engine** (3 connections) — `docs/decisions/ADR-006-domain-pattern-engine.md`
- **file_sequence Pattern Type** (3 connections) — `docs/decisions/ADR-006-domain-pattern-engine.md`
- **12 Domain-Specific Pattern Definitions** (3 connections) — `docs/decisions/ADR-006-domain-pattern-engine.md`
- **tool_arg_presence Pattern Type** (2 connections) — `docs/decisions/ADR-006-domain-pattern-engine.md`
- **research_finding Observation Type** (2 connections) — `docs/decisions/ADR-015-skavenger-ultimate-researcher.md`
- **Single Preview Gate Before Mutation** (1 connections) — `docs/decisions/ADR-005-forge-evolve-pipeline.md`
- **JSON File IPC Instead of In-Memory Coupling** (1 connections) — `docs/decisions/ADR-005-forge-evolve-pipeline.md`
- **/instinct Deprecation Alias** (1 connections) — `docs/decisions/ADR-005-forge-evolve-pipeline.md`
- **Bash + Skill Dual-Surface Follow-up Matching** (1 connections) — `docs/decisions/ADR-006-domain-pattern-engine.md`
- **projectHash Cross-Project Isolation Invariant** (1 connections) — `docs/decisions/ADR-008-evolve-generate-pipeline.md`
- **CREATE_HOOK Category Deferral** (1 connections) — `docs/decisions/ADR-008-evolve-generate-pipeline.md`

## Relationships

- [ADR: Research Capability Lineage](ADR-_Research_Capability_Lineage.md) (2 shared connections)
- [ADR: Evolve Generate & Surface Audit](ADR-_Evolve_Generate_%26_Surface_Audit.md) (2 shared connections)
- [ADR: Context & Persistence Tiers](ADR-_Context_%26_Persistence_Tiers.md) (1 shared connections)
- [ADR: Skill Loading Enforcement](ADR-_Skill_Loading_Enforcement.md) (1 shared connections)

## Source Files

- `docs/decisions/ADR-001-v03-foundations.md`
- `docs/decisions/ADR-005-forge-evolve-pipeline.md`
- `docs/decisions/ADR-006-domain-pattern-engine.md`
- `docs/decisions/ADR-008-evolve-generate-pipeline.md`
- `docs/decisions/ADR-015-skavenger-ultimate-researcher.md`

## Audit Trail

- EXTRACTED: 48 (96%)
- INFERRED: 2 (4%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*