---
number: 33
title: /medik project-agnostic via cwd-target-existence detection
date: 2026-04-26
status: proposed
route: A
plan: plan-033-medik-project-agnostic.md
---

# ADR-033: /medik project-agnostic via cwd-target-existence detection

**Deciders**: Ych-Kadmon (architect), arkitect (proposer)

**Supersedes**: original 2026-04-26 ADR-033 draft (same file, replaced in-place because the ADR was never accepted). Reason for in-place rewrite — original draft used a binary `profile: 'harness' | 'consumer'` gate on `CheckContext` that treated 8 of 14 checks as "harness-only" and emitted `NOTE: requires harness profile` in consumer projects. Empirical correction 2026-04-26 invalidated that premise: consumer projects (Kadmon-Sports, ToratNetz, KAIRON) WILL have their own project-local `.claude/{agents,skills,commands}/` plus project-scoped instincts via `project_hash` partitioning of `~/.kadmon/kadmon.db`. The corrected design replaces the binary gate with per-check cwd-target-existence detection, mirroring the plan-032 doks pattern.

## Context

`/medik` is the Kadmon Harness diagnostic command — 14 health checks shipped 2026-04-24 in v1.3.0. The harness identity per `CLAUDE.md` "Project Overview" is unambiguous: it is "operative layer ... encode how Claude should work on **any project** ... carried to **every new project** via bootstrap." Therefore harness commands MUST work in consumer projects (Kadmon-Sports, ToratNetz, KAIRON), not only inside the harness self-repo.

Per the project-agnostic mandate driving ADR-031 (skanner) and ADR-032 (doks, shipped 2026-04-26 commit `8484ee2`), `/medik` MUST run cleanly in any cwd. Its current body bakes harness assumptions into 9 of 14 checks — invoked from a consumer cwd, the command produces a wall of FAIL/WARN/NOTE entries against telemetry tables and skill catalogs that the consumer either does not have or has its OWN copy of.

### Empirical correction (the original ADR-033 binary-gate premise was wrong)

The earlier draft assumed consumer projects are second-class citizens of `/medik` — they should run only the 5 generic language-aware checks (#1–#5) plus stale-plans (#10), with the remaining 8 checks emitting `NOTE: requires harness profile — skipped`. Verification 2026-04-26 (after plan-032 shipped) falsifies that premise:

1. **Consumer projects WILL have project-local `.claude/{agents,skills,commands}/`** — per user clarification 2026-04-26 driving the plan-032 rewrite. ToratNetz needs its own `kabbalist` agent. Kadmon-Sports needs its own `betting-strategist`. KAIRON needs its own `voice-pipeline-debugger`. These coexist with plugin-provided components (plugin wins on name collision; both load when names unique — verified via Anthropic plugin docs in plan-032 Phase 0).
2. **`~/.kadmon/kadmon.db` is already project-scoped via `project_hash`** — the schema partitions every row (sessions, instincts, hook_events, agent_invocations, cost_events) by the hash of the cwd-derived git remote URL (`scripts/lib/project-detect.ts`). Harness self-test queries the harness's `project_hash`; a consumer cwd queries the consumer's `project_hash`. Cross-project instincts (scope=`global` or `cross_project`) surface in either query by design.
3. **Plugin-provided agents/skills/commands resolve at the plugin cache** (`~/.claude/plugins/cache/kadmon-harness/...`), not at the consumer cwd. A `/medik` check that scans `cwd-relative .claude/agents/*.md` only sees consumer-local additions, not the plugin-provided 16 agents. This is by design — plugin enumeration belongs to the harness self-repo, not the consumer.
4. **`skill-creator-probe` is already project-aware** — it probes 3 candidate paths (`~/.claude/plugins/cache/skill-creator/SKILL.md`, `<cwd>/.claude/skills/skill-creator/SKILL.md`, `~/.claude/skills/skill-creator/SKILL.md`). Consumer projects benefit from this check exactly as much as the harness does.
5. **`stale-plans` is already cwd-existence-gated** — it returns PASS when `<cwd>/docs/plans/` does not exist. This is the symmetric pattern: a check returns informational status when its target is absent, not a "harness-only required" gate.

The "8 of 14 checks are harness-only" framing is therefore a **classification error**. 5 of those 8 should run anywhere with a per-target existence guard:

| # | Check | Original framing | Corrected classification |
|---|---|---|---|
| 8 | Agent frontmatter (inline `lint-agent-frontmatter.ts`) | harness-only inline | **Run if `<cwd>/.claude/agents/` exists.** Lint consumer-local agents. Emit informational NOTE when absent. |
| 11 | Hook health 24h | harness-only module gate | **Run any cwd; SQLite filter by `project_hash`.** Harness query → harness telemetry; consumer query → consumer telemetry (empty if consumer has no hook events yet — emit existing PASS). |
| 12 | Instinct decay candidates | harness-only module gate | **Run any cwd; SQLite filter by `project_hash`.** Includes `scope='cross_project'` instincts in either query. |
| 13 | Skill-creator probe | harness-only module gate | **Run any cwd, unchanged.** Plugin-cache + project-skills + global-skills probe is meaningful in any project. |
| 14 | Capability alignment | deferred to v1.4 (original Risk #6 explicitly punted) | **Run if `<cwd>/.claude/agents/` AND `<cwd>/.claude/skills/` both exist.** Audit consumer-local catalog. v1.4 defer is **canceled** — the cwd-existence pattern is the exact mitigation Risk #6 specified. |

Correctly classified (no change from original ADR):

- **#1, #2, #3** Build / Typecheck / Tests — language-aware via ADR-020 toolchain. Already project-agnostic.
- **#4** Hook errors — global file `~/.kadmon/hook-errors.log`. Already project-agnostic.
- **#5** DB health — global file `~/.kadmon/kadmon.db`. Already project-agnostic.
- **#6** dist/ sync — TS-only. Runs if `<cwd>/dist/` exists. Already cwd-aware.
- **#7** Dependencies audit — language-aware (npm audit / pip-audit). Already project-agnostic.
- **#9** Install health — per-project, ADR-024. Already cwd-aware.
- **#10** Stale plans — already cwd-existence-gated (returns PASS when `docs/plans/` absent).

Reusable infrastructure already exists: `scripts/lib/detect-project-language.ts#detectProjectProfile(cwd, explicitArg)` was renamed and shipped in plan-032 commit `8484ee2`, with the `detectSkannerProfile` alias preserved for plan-031 callers. The function returns `'harness' | 'web' | 'cli'` and honors `KADMON_PROJECT_PROFILE` (umbrella) plus `KADMON_SKANNER_PROFILE` (back-compat). `/medik` inherits this detector — the rename is NOT redone in plan-033.

A separate concern — **kody exemption** — mirrors ADR-031 and ADR-032 verbatim. Kody is the `/chekpoint` Phase 2b consolidator (per `.claude/rules/common/agents.md` "Consolidator boundary" section), not a `/medik` participant. `/medik` Phase 2 invokes mekanik and kurator, both of which are diagnostic agents and project-agnostic at the agent level. Kody is therefore not in scope for this ADR.

## Decision

Adopt **per-check cwd-target-existence detection** for `/medik`. Drop the binary `profile` gate from `CheckContext`. Each check resolves its own target locally. Profile detection becomes diagnostic-only — a banner hint, never a skip switch.

**Detection strategy**:

- `detectMedikProfile(cwd, explicitArg): 'harness' | 'consumer'` — thin adapter over `detectProjectProfile` that collapses `web | cli` → `consumer`. Exported from `scripts/lib/detect-project-language.ts`.
- Used **only** to render the diagnostic banner: `Detected: harness (source: markers)` or `Detected: consumer (source: env)`.
- NOT consumed by any `runCheck()` as a skip gate.
- Override precedence: explicit `/medik harness|consumer` arg → `KADMON_MEDIK_PROFILE` env → `KADMON_PROJECT_PROFILE` (umbrella) → markers → fallback `consumer`.

**Per-check target resolution**:

- **File-target checks (#8, #14)**: if `<cwd>/.claude/<dir>/` is absent → return `status: 'NOTE'` with message `"no consumer-local <kind> in this project — nothing to <verb>"`. This is informational, NOT a "skip because consumer". A harness self-check with empty `.claude/agents/` would emit the same NOTE. Symmetry by design.
- **SQLite-filtered checks (#11, #12)**: scope by `project_hash` derived from cwd via `scripts/lib/project-detect.ts`. Harness self-test → harness telemetry; consumer → consumer telemetry. Cross-project (`scope='global'` or `'cross_project'`) instincts surface in either query. Empty result = existing PASS message ("No hook health issues in last 24h" / "No instinct decay candidates"), not "requires harness profile".
- **Plugin-aware check (#13)**: unchanged — already probes 3 candidate paths and is meaningful in any project.
- **Inline checks #1–#7, #9, #10**: unchanged. Already cwd-aware or globally-scoped via existing logic.

**`CheckContext` shape — UNCHANGED**:

```typescript
export interface CheckContext {
  projectHash: string;
  cwd: string;
}
```

No `profile` field. No binary gate. The profile is rendered to the user as a diagnostic hint but never reaches `runCheck()`.

**Cancellation of original Risk #6 v1.4 defer**:

The original ADR draft punted Check #14 (capability-alignment) fork-aware mode to v1.4 with a "harness-only" stop-gap. This v1.4 defer is **canceled**. The cwd-existence pattern is the exact mitigation Risk #6 specified — implement it now in v1.3.

**Function rename — already shipped**:

The `detectSkannerProfile` → `detectProjectProfile` rename, the `detectSkannerProfile` deprecated alias, and the `KADMON_PROJECT_PROFILE` umbrella env var all shipped in plan-032 commit `8484ee2`. Plan-033 inherits via the existing alias and adds only `detectMedikProfile()` + the `MedikProfile` type.

**Kody exemption**: same as ADR-031, ADR-032. Kody is `/chekpoint` Phase 2b consolidator, not a `/medik` participant. No change to `/chekpoint` orchestration.

## Alternatives Considered

### Alternative 1: Binary `profile` gate on CheckContext (the original ADR-033 design)
- **Pros**: simplest possible refactor; single conditional per check; mirrors plan-031's profile pattern verbatim.
- **Cons**: treats consumer projects as second-class — 8/14 checks emit `NOTE: requires harness profile` regardless of whether the consumer has its own project-local catalog. Mis-classifies 5 of those 8 checks (#8, #11, #12, #13, #14) which can run productively in any project. Defers Check #14 fork-aware mode to v1.4 unnecessarily.
- **Why not**: rejected after 2026-04-26 user clarification that consumer projects WILL have their own `.claude/{agents,skills,commands}/` and project-scoped instincts. The binary gate fights the actual deployment model.

### Alternative 2: Skip-with-error in consumer (FAIL on harness checks)
- **Pros**: loud signal that harness checks didn't run.
- **Cons**: turns `/medik` from a helper into a nag in consumer workspaces; false-positive FAILs scare users; encourages disabling the command entirely; conflates "check could not apply" with "check ran and failed".
- **Why not**: rejected for UX. NOTE severity for absent targets is the correct signal — "the check ran, found nothing to assess".

### Alternative 3: Two separate commands (`/medik` for harness, `/medik-consumer` for consumer)
- **Pros**: zero conditional logic per check; each command is single-purpose.
- **Cons**: command sprawl; users in mixed workflows would forget which to call; doubles documentation surface; violates the single-entry-point contract that motivated `/medik` (ADR-028, plan-028).
- **Why not**: violates ADR-028. The whole point of `/medik` is "one diagnostic, runs the right thing".

### Alternative 4 (chosen): Per-check cwd-target-existence detection
- **Pros**: same check ran from harness or consumer cwd produces semantically correct output; consumer projects with a project-local catalog get full audit coverage (Check #8, #14 included); SQLite-filtered checks are already project-scoped via `project_hash`; diagnostic banner clarifies WHY (informational) without gating WHAT (target existence). Mirrors plan-032 doks pattern verbatim.
- **Cons**: per-check existence-detection logic adds ~5 lines per affected check (vs. 1 line for a binary gate); 5 checks now produce profile-independent NOTE messages whose phrasing must be carefully neutral (not implying "consumer ≠ valid").
- **Why chosen**: solves the real classification bug, ships Check #14 fork-aware mode in v1.3 (no v1.4 defer), reuses the proven plan-032 pattern, and respects the deployment model the user clarified 2026-04-26.

## Consequences

### Positive

- `/medik` produces semantically correct output in any cwd. Consumer projects with their own catalog get full audit coverage; harness self-test is byte-identical (regression backstop = output diff).
- Check #14 (capability-alignment) ships fork-aware in v1.3 — original v1.4 defer is canceled.
- `CheckContext` shape stays minimal (no `profile` field added). Existing checks need no edits except per-target existence guards in the 5 affected files.
- Diagnostic banner (`Detected: harness|consumer (source: ...)`) gives operators auditable provenance without coupling provenance to behavior.
- Cohesion: `detectMedikProfile` reuses `detectProjectProfile` — single detection codepath across `/skanner`, `/doks`, `/medik`. Single set of markers. Single env var family.
- Consumer workspaces with no project-local agents/skills get clean PASS/NOTE output; no false-positive FAILs.
- SQLite-filtered checks (#11, #12) are already partitioned by `project_hash`, so harness telemetry never leaks into consumer audits and vice versa. No new isolation work.

### Negative

- 5 checks gain ~5 lines each of cwd-target-existence guard logic — boilerplate proportional to the affected check count. Estimated +25-30 lines vs the binary-gate approach's +40 lines (but spread across check bodies, not a single contract change).
- Diagnostic banner output format adds one line to every `/medik` invocation. User documentation needs a one-line update.
- Inline checks #6, #7 (already language-aware) and #8 (lint-agent-frontmatter) need cwd-existence guards inside the command markdown invocation snippets, not just inside the module files.
- Consumer NOTE messages must be carefully phrased to NOT imply "consumer ≠ valid" — e.g., `"no consumer-local agents in this project — nothing to lint"` is correct; `"requires harness profile — skipped"` is the wrong framing.

### Risks

1. **Misdetection in monorepos** (project nested inside harness clone or vice versa) — same risk as ADR-031, ADR-032. **Mitigation**: env var (`KADMON_MEDIK_PROFILE`) + explicit `/medik harness|consumer` arg always win over markers. The `Detected: <profile> (source: ...)` first-line output is auditable. Identical mitigation to ADR-031, ADR-032.
2. **Harness self-test regression** — the harness IS the canonical harness profile consumer; any regression in harness-mode behavior breaks `/medik` against the harness. **Mitigation**: acceptance test — harness self-`/medik` reports identical 14-check output as today (PASS/NOTE/WARN/FAIL counts and per-check status unchanged). Plan-033 verification step runs `/medik` against the harness pre- and post-refactor and diffs the output.
3. **Consumer-local agent/skill catalog absent at first run** — a fresh consumer project may have no `.claude/agents/` and no `.claude/skills/` directory, producing 2 NOTE entries (#8 + #14). **Mitigation**: phrasing of the NOTE messages — "no consumer-local agents in this project — nothing to lint" reads as informational, not as a defect. Output is still PASS-equivalent (NOTE is non-blocking).
4. **SQLite filter `project_hash` mismatch** — if a consumer cwd has no git remote, `project_hash` derivation may yield a hash that doesn't match any rows in the existing `~/.kadmon/kadmon.db`. **Mitigation**: empty result set → existing PASS message ("No hook health issues in last 24h" / "No instinct decay candidates"), which is the correct semantic for a consumer with no harness telemetry yet. No special-casing needed.
5. **NOTE message phrasing drift between checks** — different check files written by different sessions could produce inconsistent "no consumer-local X" wording. **Mitigation**: plan-033 provides the canonical phrasing template in Phase 2 ("no consumer-local <kind> in this project — nothing to <verb>"); each check file copies it verbatim.
6. **Plan-028 collision (now retired)** — plan-028 Phase 4/5 has shipped (5 module-per-check files exist on disk, capability-alignment was added in plan-029). The original Risk #5 collision concern is therefore retired.
7. **Inline-check cwd-guard placement** — Check #8 (`npx tsx scripts/lint-agent-frontmatter.ts`) and Check #14 invocation are wrapped in inline `npx tsx -e "..."` blocks in `.claude/commands/medik.md`. The cwd-existence guard must execute BEFORE the script invocation to avoid a stack trace on missing dirs. **Mitigation**: wrap the inline invocation in a guard pattern that mirrors `stale-plans.ts` (existence check first, NOTE-or-PASS short-circuit, then heavy lift). Plan-033 Phase 2 specifies the exact wrapper.

## References

- **ADR-031** (project-agnostic /skanner stack) — sister refactor, established the profile detector pattern.
- **ADR-032** (/doks project-agnostic via runtime profile detection) — direct precedent. Same per-target existence detection pattern. Function rename + alias + `KADMON_PROJECT_PROFILE` umbrella env var were shipped here in commit `8484ee2`.
- **ADR-020** (runtime language detection) — reused for generic checks #1–#5, #7. Language routing already works in any project.
- **ADR-010** (plugin distribution model) — referenced. Plugin install path and `KADMON_RUNTIME_ROOT` resolution must continue to work; profile detection is consumer-cwd-based via `process.cwd()`, never `KADMON_RUNTIME_ROOT` (which points at the plugin cache, not the workspace).
- **ADR-019** (canonical root symlinks) — referenced. Canonical root symlinks for `agents/`, `skills/`, `commands/` remain at the harness repo root only.
- **ADR-024** (install-health telemetry) — Check #9 belongs to this ADR's contract; runs in any project that installs the harness.
- **ADR-028** (medik expansion 9→14 + --ALV export) — predecessor. Establishes `medik-checks/` module shape and `CheckContext` / `CheckResult` contract that this ADR extends WITHOUT adding a `profile` field.
- **ADR-029** (capability-alignment audit) — Check #14 contract. This ADR ships fork-aware mode in v1.3, canceling the original Risk #6 v1.4 defer.
- **`.claude/rules/common/agents.md` "Consolidator boundary"** — kody exemption anchor. Same anchor as ADR-031, ADR-032.
- **`scripts/lib/detect-project-language.ts`** — implementation site. `detectProjectProfile` + `detectSkannerProfile` alias + `KADMON_PROJECT_PROFILE` env var already present (commit `8484ee2`).
- **`scripts/lib/medik-checks/types.ts`** — `CheckContext` shape; not extended by this ADR.
- **`scripts/lib/medik-checks/{capability-alignment,hook-health-24h,instinct-decay-candidates,skill-creator-probe,stale-plans}.ts`** — current check shapes; 4 of 5 gain cwd-target-existence guards (skill-creator-probe unchanged).
- **`.claude/commands/medik.md`** — Phase 0 detection banner + Phase 1 inline-check guards added.
- Empirical user clarification 2026-04-26: consumer projects WILL have project-local `.claude/{agents,skills,commands}/` plus project-scoped instincts. Drove the in-place rewrite of plan-032 (commit `24b3932`) and this ADR.

## Plan reference

Implementation plan: `docs/plans/plan-033-medik-project-agnostic.md` (rewritten in same number).
