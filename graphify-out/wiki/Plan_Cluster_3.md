# Plan Cluster

> 13 nodes

## Key Concepts

- **detectProjectLanguage — typescript/python/mixed/unknown** (5 connections) — `docs/plans/plan-020-runtime-language-detection.md`
- **KADMON_RUNTIME_ROOT runtime primitive** (4 connections) — `docs/plans/plan-010-harness-distribution-hybrid.md`
- **Plan-001 — Kadmon Harness v0.3 Plans (Archived)** (2 connections) — `docs/plans/plan-001-v03-archive.md`
- **Hook path robustness via git rev-parse --show-toplevel prefix** (2 connections) — `docs/plans/plan-001-v03-archive.md`
- **resolveRootDir extracted into ensure-dist.js** (2 connections) — `docs/plans/plan-004-hook-cleanup.md`
- **Hygiene-to-domain pattern rewrite (13 out, 12 in)** (2 connections) — `docs/plans/plan-006-domain-pattern-engine.md`
- **migrate-archive-hygiene-instincts — idempotent archival migration** (2 connections) — `docs/plans/plan-006-domain-pattern-engine.md`
- **Plan-020 — Runtime language detection** (2 connections) — `docs/plans/plan-020-runtime-language-detection.md`
- **Hook branching on file extension (6 hooks)** (2 connections) — `docs/plans/plan-020-runtime-language-detection.md`
- **KADMON_PROJECT_LANGUAGE env override** (2 connections) — `docs/plans/plan-020-runtime-language-detection.md`
- **daily-log.js shared module (appendDailyLog / readTodayLog)** (1 connections) — `docs/plans/plan-001-v03-archive.md`
- **Toolchain struct — build/typecheck/lint/test per language** (1 connections) — `docs/plans/plan-020-runtime-language-detection.md`
- **Safe default — unknown language falls back to TS toolchain** (1 connections) — `docs/plans/plan-020-runtime-language-detection.md`

## Relationships

- [Plan Cluster](Plan_Cluster.md) (3 shared connections)
- [Onboarding: Reference Kadmon Harness](Onboarding-_Reference_Kadmon_Harness.md) (1 shared connections)

## Source Files

- `docs/plans/plan-001-v03-archive.md`
- `docs/plans/plan-004-hook-cleanup.md`
- `docs/plans/plan-006-domain-pattern-engine.md`
- `docs/plans/plan-010-harness-distribution-hybrid.md`
- `docs/plans/plan-020-runtime-language-detection.md`

## Audit Trail

- EXTRACTED: 20 (71%)
- INFERRED: 8 (29%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*