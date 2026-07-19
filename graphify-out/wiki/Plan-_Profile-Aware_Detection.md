# Plan: Profile-Aware Detection

> 15 nodes

## Key Concepts

- **detectProjectProfile (generic rename of detectSkannerProfile)** (5 connections) — `docs/plans/plan-032-doks-project-agnostic.md`
- **detectSkannerProfile (harness | web | cli)** (4 connections) — `docs/plans/plan-031-project-agnostic-skanner-stack.md`
- **getDiffScope(stagedFiles, fileContents?) -> DiffScope** (4 connections) — `docs/plans/plan-034-chekpoint-phase1-diff-scope.md`
- **Profile precedence: arg > env > harness markers > web markers > cli markers > fallback web** (2 connections) — `docs/plans/plan-031-project-agnostic-skanner-stack.md`
- **/doks per-layer write eligibility (Layer 1 always, Layer 2 harness-only, Layers 3-4 cwd-only)** (2 connections) — `docs/plans/plan-032-doks-project-agnostic.md`
- **detectMedikProfile adapter (collapses web|cli to consumer)** (2 connections) — `docs/plans/plan-033-medik-project-agnostic.md`
- **Kadmon Harness Mode conditional agent sections (arkonte/kartograf)** (1 connections) — `docs/plans/plan-031-project-agnostic-skanner-stack.md`
- **detectSkannerProfile takes cwd, never KADMON_RUNTIME_ROOT** (1 connections) — `docs/plans/plan-031-project-agnostic-skanner-stack.md`
- **Deprecated alias by function-reference identity (back-compat contract)** (1 connections) — `docs/plans/plan-032-doks-project-agnostic.md`
- **Empirical correction: consumers have no .claude/{agents,skills,commands}** (1 connections) — `docs/plans/plan-032-doks-project-agnostic.md`
- **Env precedence tiers: KADMON_DOKS_PROFILE > KADMON_PROJECT_PROFILE > KADMON_SKANNER_PROFILE** (1 connections) — `docs/plans/plan-032-doks-project-agnostic.md`
- **Profile banner is diagnostic-only, never a skip gate** (1 connections) — `docs/plans/plan-033-medik-project-agnostic.md`
- **Conservative-by-default invariant (uncertainty resolves to TRUE)** (1 connections) — `docs/plans/plan-034-chekpoint-phase1-diff-scope.md`
- **--force-spektr / --force-orakle / --force-all override flags** (1 connections) — `docs/plans/plan-034-chekpoint-phase1-diff-scope.md`
- **Runtime authority: getDiffScope over the descriptive tier table** (1 connections) — `docs/plans/plan-034-chekpoint-phase1-diff-scope.md`

## Relationships

- No strong cross-community connections detected

## Source Files

- `docs/plans/plan-031-project-agnostic-skanner-stack.md`
- `docs/plans/plan-032-doks-project-agnostic.md`
- `docs/plans/plan-033-medik-project-agnostic.md`
- `docs/plans/plan-034-chekpoint-phase1-diff-scope.md`

## Audit Trail

- EXTRACTED: 28 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*