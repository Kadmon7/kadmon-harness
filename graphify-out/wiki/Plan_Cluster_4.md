# Plan Cluster

> 11 nodes

## Key Concepts

- **Plan-004 — Hook Script Cleanup and Hardening** (4 connections) — `docs/plans/plan-004-hook-cleanup.md`
- **Plan-007 — Sprint C data-integrity fixes** (3 connections) — `docs/plans/plan-007-sprint-c-data-integrity-fixes.md`
- **Bug B — sessions.ended_at inversion on resume** (3 connections) — `docs/plans/plan-007-sprint-c-data-integrity-fixes.md`
- **Plan-002 — Test Gap Analysis** (2 connections) — `docs/plans/plan-002-test-gaps.md`
- **Security-first test-gap prioritization (stdin truncation, secret scrubbing)** (2 connections) — `docs/plans/plan-002-test-gaps.md`
- **scrubSecrets pattern parity with commit-quality SECRET_PATTERNS** (2 connections) — `docs/plans/plan-004-hook-cleanup.md`
- **clearSessionEndState — reset end-state so COALESCE cannot keep stale ended_at** (2 connections) — `docs/plans/plan-007-sprint-c-data-integrity-fixes.md`
- **migrate-fix-session-inversion — dry-run/apply repair migration** (2 connections) — `docs/plans/plan-007-sprint-c-data-integrity-fixes.md`
- **getAutoMemoryDir — derive auto-memory path from cwd** (1 connections) — `docs/plans/plan-004-hook-cleanup.md`
- **EBUSY race fix — copy-to-tmp then atomic rename in build script** (1 connections) — `docs/plans/plan-004-hook-cleanup.md`
- **Bug A — hook_events.duration_ms instrumentation across 9 hooks** (1 connections) — `docs/plans/plan-007-sprint-c-data-integrity-fixes.md`

## Relationships

- [Plan Cluster](Plan_Cluster.md) (3 shared connections)

## Source Files

- `docs/plans/plan-002-test-gaps.md`
- `docs/plans/plan-004-hook-cleanup.md`
- `docs/plans/plan-007-sprint-c-data-integrity-fixes.md`

## Audit Trail

- EXTRACTED: 18 (78%)
- INFERRED: 5 (22%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*