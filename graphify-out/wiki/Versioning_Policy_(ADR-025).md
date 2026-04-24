# Versioning Policy (ADR-025)

> 36 nodes · cohesion 0.06

## Key Concepts

- **ADR-025: Versioning Policy â€” Narrative MINORs, PATCH Only for Post-Release Hotfixes** (11 connections) — `docs/decisions/ADR-025-versioning-policy.md`
- **ADR-026: Graphify adoption as external knowledge-graph layer** (9 connections) — `docs/decisions/ADR-026-graphify-adoption.md`
- **Plan-003: Harness Distribution Bootstrap (superseded by plan-010)** (5 connections) — `docs/plans/plan-003-harness-distribution.md`
- **Plan-007: Sprint C data-integrity fixes** (5 connections) — `docs/plans/plan-007-sprint-c-data-integrity-fixes.md`
- **Plan-010: Harness Distribution via Hybrid Plugin + Bootstrap** (5 connections) — `docs/plans/plan-010-harness-distribution-hybrid.md`
- **.claude-plugin/plugin.json + hooks.json manifests** (3 connections) — `docs/plans/plan-010-harness-distribution-hybrid.md`
- **Adopt graphify as external dependency, not harness-internal code** (2 connections) — `docs/decisions/ADR-026-graphify-adoption.md`
- **COPY_MANIFEST (11 categories of distributable files)** (2 connections) — `docs/plans/plan-003-harness-distribution.md`
- **Plan-004: Hook script cleanup and hardening (12 findings)** (2 connections) — `docs/plans/plan-004-hook-cleanup.md`
- **Add 3 missing secret patterns (sk-ant-, AKIA, sbp_)** (2 connections) — `docs/plans/plan-004-hook-cleanup.md`
- **Extract resolveRootDir helper to ensure-dist.js** (2 connections) — `docs/plans/plan-004-hook-cleanup.md`
- **KADMON_RUNTIME_ROOT env var primitive** (2 connections) — `docs/plans/plan-010-harness-distribution-hybrid.md`
- **generate-plugin-hooks.ts (build-time helper)** (2 connections) — `docs/plans/plan-010-harness-distribution-hybrid.md`
- **ADR-010 Harness Distribution Hybrid (referenced)** (2 connections) — `docs/decisions/ADR-026-graphify-adoption.md`
- **SemVer MAJOR/MINOR/PATCH** (1 connections) — `docs/decisions/ADR-025-versioning-policy.md`
- **MAJOR â€” breaking changes to public contract** (1 connections) — `docs/decisions/ADR-025-versioning-policy.md`
- **MINOR â€” narrative feature ready for collaborators** (1 connections) — `docs/decisions/ADR-025-versioning-policy.md`
- **PATCH â€” post-release hotfix only** (1 connections) — `docs/decisions/ADR-025-versioning-policy.md`
- **Anti-patterns: one-commit = one release** (1 connections) — `docs/decisions/ADR-025-versioning-policy.md`
- **Rationale: release noise from PATCH-per-commit cadence** (1 connections) — `docs/decisions/ADR-025-versioning-policy.md`
- **Human-review enforcement (no mechanical gate)** (1 connections) — `docs/decisions/ADR-025-versioning-policy.md`
- **graphify upstream (MIT, Python 3.10+, PyPI graphifyy)** (1 connections) — `docs/decisions/ADR-026-graphify-adoption.md`
- **.graphifyignore excludes harness instruction files** (1 connections) — `docs/decisions/ADR-026-graphify-adoption.md`
- **Sprint E measurement gate (rip out if <3Ã— token reduction)** (1 connections) — `docs/decisions/ADR-026-graphify-adoption.md`
- **Alternative: Build internal Kadmon graph (rejected)** (1 connections) — `docs/decisions/ADR-026-graphify-adoption.md`
- *... and 11 more nodes in this community*

## Relationships

- No strong cross-community connections detected

## Source Files

- `docs/decisions/ADR-025-versioning-policy.md`
- `docs/decisions/ADR-026-graphify-adoption.md`
- `docs/plans/plan-003-harness-distribution.md`
- `docs/plans/plan-004-hook-cleanup.md`
- `docs/plans/plan-007-sprint-c-data-integrity-fixes.md`
- `docs/plans/plan-010-harness-distribution-hybrid.md`

## Audit Trail

- EXTRACTED: 70 (92%)
- INFERRED: 6 (8%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*