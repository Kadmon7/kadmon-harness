# ADR Cluster

> 11 nodes

## Key Concepts

- **Hybrid Plugin + Installer Distribution** (7 connections) — `docs/decisions/ADR-010-harness-distribution-hybrid.md`
- **ADR-003 Harness Distribution Strategy** (4 connections) — `docs/decisions/ADR-003-harness-distribution.md`
- **Option A — Copy-Based Bootstrap Script** (4 connections) — `docs/decisions/ADR-003-harness-distribution.md`
- **install.sh / install.ps1 Bootstrap Installer** (4 connections) — `docs/decisions/ADR-010-harness-distribution-hybrid.md`
- **The Rules Gap (plugins cannot ship .claude/rules)** (2 connections) — `docs/decisions/ADR-003-harness-distribution.md`
- **The Permissions Gap (permissions.deny not distributable)** (2 connections) — `docs/decisions/ADR-003-harness-distribution.md`
- **settings.json Smart Merge Strategy** (2 connections) — `docs/decisions/ADR-003-harness-distribution.md`
- **ADR-010 Harness Distribution via Hybrid Plugin + Bootstrap** (2 connections) — `docs/decisions/ADR-010-harness-distribution-hybrid.md`
- **Glob-Based COPY_MANIFEST (no hardcoded counts)** (2 connections) — `docs/decisions/ADR-010-harness-distribution-hybrid.md`
- **generateHookCommand Cross-Platform Emitter** (1 connections) — `docs/decisions/ADR-010-harness-distribution-hybrid.md`
- **ECC v1.10.0 Hybrid Pattern Precedent** (1 connections) — `docs/decisions/ADR-010-harness-distribution-hybrid.md`

## Relationships

- [ADR: Context & Persistence Tiers](ADR-_Context_%26_Persistence_Tiers.md) (2 shared connections)
- [ADR Cluster](ADR_Cluster.md) (1 shared connections)
- [Systematic Debugging Skill](Systematic_Debugging_Skill.md) (1 shared connections)
- [ADR: Research Capability Lineage](ADR-_Research_Capability_Lineage.md) (1 shared connections)

## Source Files

- `docs/decisions/ADR-003-harness-distribution.md`
- `docs/decisions/ADR-010-harness-distribution-hybrid.md`

## Audit Trail

- EXTRACTED: 29 (94%)
- INFERRED: 2 (6%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*