# ADR Cluster

> 14 nodes

## Key Concepts

- **checkInstallHealth diagnostic module** (6 connections) — `docs/decisions/ADR-024-install-health-telemetry.md`
- **Kadmon Harness Genesis** (4 connections) — `docs/genesis/genesis.md`
- **Shared Toolchain Map** (3 connections) — `docs/decisions/ADR-020-runtime-language-detection.md`
- **Warn-not-fail on Missing Toolchain** (2 connections) — `docs/decisions/ADR-020-runtime-language-detection.md`
- **Tri-state Symlink Detection** (2 connections) — `docs/decisions/ADR-024-install-health-telemetry.md`
- **Passive Principle — Warn, Don't Mutate** (2 connections) — `docs/decisions/ADR-024-install-health-telemetry.md`
- **rotating-jsonl-log shared helper** (2 connections) — `docs/decisions/ADR-024-install-health-telemetry.md`
- **Auto-loaded Context Token Budget** (2 connections) — `docs/decisions/ADR-035-rules-catalog-source-of-truth.md`
- **Three-tier Context Management** (2 connections) — `docs/genesis/genesis.md`
- **Hook Reliability Layer (ensure-dist, hook-logger, backup-rotate)** (2 connections) — `docs/genesis/genesis.md`
- **renderRemediation presentation module** (1 connections) — `docs/decisions/ADR-024-install-health-telemetry.md`
- **VersionedInstallReport contract** (1 connections) — `docs/decisions/ADR-028-v1.3-medik-expansion-release.md`
- **Command → Agent → Skill Orchestration Chain** (1 connections) — `docs/genesis/genesis.md`
- **Ephemeral Observations as JSONL** (1 connections) — `docs/genesis/genesis.md`

## Relationships

- [ADR Cluster](ADR_Cluster.md) (5 shared connections)

## Source Files

- `docs/decisions/ADR-020-runtime-language-detection.md`
- `docs/decisions/ADR-024-install-health-telemetry.md`
- `docs/decisions/ADR-028-v1.3-medik-expansion-release.md`
- `docs/decisions/ADR-035-rules-catalog-source-of-truth.md`
- `docs/genesis/genesis.md`

## Audit Trail

- EXTRACTED: 24 (77%)
- INFERRED: 7 (23%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*