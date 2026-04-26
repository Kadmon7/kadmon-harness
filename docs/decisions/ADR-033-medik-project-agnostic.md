---
number: 33
title: /medik project-agnostic via runtime profile detection
date: 2026-04-26
status: proposed
route: A
plan: plan-033-medik-project-agnostic.md
---

# ADR-033: /medik project-agnostic via runtime profile detection

**Deciders**: Ych-Kadmon (architect), arkitect (proposer)

## Context

`/medik` is the Kadmon Harness diagnostic command — 14 health checks, shipped 2026-04-24 in v1.3.0. The harness identity per `CLAUDE.md` "Project Overview" is unambiguous: it is "operative layer ... encode how Claude should work on **any project** ... carried to **every new project** via bootstrap." Therefore harness commands MUST work in consumer projects (Kadmon-Sports, ToratNetz, KAIRON), not only inside the harness self-repo.

Drift detected via 2026-04-26 14-check decomposition:

| Check # | Name | Generic? | Notes |
|---|---|---|---|
| 1 | build | YES | language-aware ADR-020 |
| 2 | typecheck | YES | language-aware ADR-020 |
| 3 | tests | YES | language-aware ADR-020 |
| 4 | lint | YES | language-aware ADR-020 |
| 5 | audit | YES | language-aware ADR-020 |
| 6 | schema | NO | reads SQLite `~/.kadmon/kadmon.db` schema |
| 7 | frontmatter linter | NO | scans `.claude/agents/*.md` (harness pattern) |
| 8 | install-health | NO | reads `install-diagnostic.log` (ADR-024, harness install) |
| 9 | stale-plans | SEMI | scans `docs/plans/*.md` — applies to any project that uses this convention |
| 10 | hook-health-24h | NO | reads `hook_events` table (harness telemetry) |
| 11 | instinct-decay | NO | reads `instincts` table (harness learning) |
| 12 | skill-creator-probe | NO | probes `skill-creator` plugin install (harness ecosystem) |
| 13 | capability-alignment | NO | scans `.claude/skills/*/SKILL.md` (harness skill catalog, ADR-029) |
| 14 | (reserved/internal numbering) | NO | per `CLAUDE.md` "14 /medik checks" |

Net effect: 5 generic + 1 semi-generic + 8 harness-only = 9 of 14 checks fail or "do not apply" in consumer projects. Dropping the harness into Kadmon-Sports and running `/medik` today produces a wall of FAILs against telemetry tables and SQLite schemas that simply do not exist in that workspace. The command advertises itself as "harness diagnostic" but is invoked through plugin distribution (ADR-010) into projects that have no harness internals.

Existing infrastructure to reuse:

- `scripts/lib/detect-project-language.ts#detectSkannerProfile(cwd, explicitArg)` — shipped in plan-031 (commit `a3b3d75`), returns `'harness' | 'web' | 'cli'`. The harness markers (`state-store.ts`, `observe-pre.ts`, `observations.jsonl`) are the same markers `/medik` needs to gate its harness-only checks.
- `KADMON_SKANNER_PROFILE` env var pattern from ADR-031 — extends naturally to `KADMON_MEDIK_PROFILE`.

A naming question surfaces: `detectSkannerProfile` is misleading once 3+ commands (`/skanner`, `/medik`, eventually `/doks`) call it. The function is no longer skanner-specific; it is project-profile detection. This ADR includes the rename.

A separate concern — **kody exemption** — mirrors ADR-031 verbatim. Kody is the `/chekpoint` Phase 2b consolidator (per `.claude/rules/common/agents.md` "Consolidator boundary" section), not a `/medik` participant. `/medik` Phase 2 invokes `mekanik` and `kurator`, both of which are diagnostic agents and are project-agnostic at the agent level. Kody is therefore not in scope for this ADR.

## Decision

Adopt **runtime profile detection** for `/medik` mirroring ADR-031. Two profiles are sufficient — `/medik`'s consumer-side checks do not need the `web | cli` granularity that `/skanner` requires for scenario selection.

**Profiles**:

1. **Harness profile** detected → run all 14 checks (current behavior unchanged for harness self-test).
2. **Consumer profile** (web | cli — collapsed for `/medik`'s purposes) detected → run only generic checks: #1–#5 (always) plus #9 stale-plans (gated on `docs/plans/` directory existence). The remaining 8 harness-only checks (#6, #7, #8, #10, #11, #12, #13, plus the reserved #14 slot) skip with a NOTE: `"<check> requires harness profile — skipped"`. NOTE severity per the established `medik-checks` contract (`status: 'PASS' | 'NOTE' | 'WARN' | 'FAIL'`).

**Detection contract**:
- Each `/medik` run emits `Detected: <profile> (source: markers|env|arg)` as the first line of output, matching ADR-031's contract.
- Override precedence: explicit `/medik harness|consumer` arg > `KADMON_MEDIK_PROFILE` env var > marker scan > default (consumer). Markers are reused from `detectProjectProfile` (renamed below).

**Function rename**:
- `detectSkannerProfile` → `detectProjectProfile` (additive — keep `detectSkannerProfile` as a deprecated alias re-exporting the new function for one minor cycle, then drop in v1.4). Rationale: 3 commands now consume this detection; the name should be neutral. The deprecated alias preserves plan-031 callers and unblocks plan-033 without a coordinated rename.
- For `/medik`'s two-profile model, the underlying function still returns `'harness' | 'web' | 'cli'`; the `/medik` adapter collapses `web | cli` into `consumer` at the call site. This keeps `detectProjectProfile` single-source-of-truth across `/skanner` (3 profiles) and `/medik` (2 profiles via collapse).

**`CheckContext` extension**:
- The `medik-checks` shared context type (`scripts/lib/medik-checks/types.ts` per plan-028 Phase 4) gains a `profile: 'harness' | 'consumer'` field. Each of the 8 harness-only checks adds a profile guard at the top: `if (ctx.profile !== 'harness') return { status: 'NOTE', message: '<check> requires harness profile — skipped' }`. Generic checks ignore the field.

**Kody exemption**: same as ADR-031. Kody is `/chekpoint` Phase 2b consolidator, not a `/medik` participant. No change to `/chekpoint` orchestration.

## Alternatives Considered

### Alternative 1: Skip-with-error in consumer (FAIL on harness checks)
- **Pros**: loud signal that harness checks didn't run; users know what's missing.
- **Cons**: turns `/medik` from a helper into a nag in consumer workspaces; 8 false-positive FAILs scare users; encourages disabling the command entirely; conflates "check could not apply" with "check ran and failed".
- **Why not**: rejected for UX. Consumer profile users would see a wall of red on first invocation and never trust the command again. NOTE severity is the correct signal — "the check is not applicable here".

### Alternative 2: Two separate commands (`/medik` for harness, `/medik-consumer` for consumer)
- **Pros**: zero conditional logic per check; each command is single-purpose.
- **Cons**: command sprawl; users in mixed workflows would forget which to call; the harness must work both ways from the same entry point per `CLAUDE.md` Project Overview; doubles documentation surface and `rules/common/development-workflow.md` Command Reference table; doubles the `/abra-kdabra` plan-mode command catalog.
- **Why not**: violates the single-entry-point contract that motivated `/medik` in the first place (ADR-028, plan-028). The whole point of `/medik` is "one diagnostic, runs the right thing".

### Alternative 3: Per-check opt-out flags (`--skip-instinct-decay`, `--skip-hook-health`, ...)
- **Pros**: maximum user control; no implicit detection.
- **Cons**: 8 flags is unmanageable; users would need to know which checks to skip per project type; profile abstraction collapses all 8 flags into one decision; violates the ADR-031 precedent of declarative profile detection.
- **Why not**: rejected for ergonomics. Forces the user to learn the harness internals to use `/medik` in a consumer project. The profile abstraction is exactly the right level of indirection.

### Alternative 4: Keep current behavior, document `/medik` as harness-only
- **Pros**: zero implementation cost; clearest mental model for harness contributors.
- **Cons**: contradicts `CLAUDE.md` Project Overview ("any project ... every new project"); leaves consumer projects with no diagnostic command at all; user feedback 2026-04-26 explicitly rejects "harness-only commands" as an anti-pattern.
- **Why not**: rejected by user feedback 2026-04-26. The harness identity is portable infrastructure; carving out commands as harness-only erodes that identity slice by slice.

## Consequences

### Positive
- `/medik` deployable to any consumer project via existing plugin distribution (ADR-010) without per-consumer edits or skip flags.
- Generic checks #1–#5 already work in consumer projects (no migration needed for the language-aware portion of ADR-020).
- Cohesion: `detectProjectProfile` shared across `/skanner`, `/medik`, and (future) `/doks`. Single detection codepath, single set of markers, single env var family.
- Plan-031 set the template — this ADR follows verbatim, low cognitive load for reviewers and implementers.
- Consumer profile is faster than harness profile (5–6 checks vs 14), so consumers get a snappier diagnostic, not a slower one.

### Negative
- Naming churn: `detectSkannerProfile` → `detectProjectProfile`. Mitigated by deprecated alias for one minor cycle, but plan-031 callers still get a deprecation warning footprint until v1.4.
- Each of 8 harness-only checks adds a profile-guard line at the top — boilerplate proportional to the number of checks. Estimated: ~5 lines per check × 8 checks = ~40 lines of new code, mostly identical.
- `CheckContext` type gains a `profile` field — minor API surface change to `scripts/lib/medik-checks/types.ts`. Existing checks that ignore the field need no edits.
- `/medik`'s output format changes (new `Detected: <profile>` first line; new NOTE entries in consumer mode). User documentation in `rules/common/development-workflow.md` Command Reference table needs a one-line update.
- Plan-028 Phase 4/5 are still landing per memory note; this plan must sequence after those merges to avoid collision with the parallel session populating `medik-checks/`.

### Risks
1. **Misdetection in monorepos**: same risk as ADR-031 Risk #1. A workspace with both a consumer project and a harness clone could match harness markers spuriously. **Mitigation**: env var override (`KADMON_MEDIK_PROFILE`) and explicit command argument always win over marker scan. The `Detected: <profile> (source: markers|env|arg)` first-line output makes detection auditable. Identical to ADR-031 mitigation.
2. **Harness self-test breakage**: the harness itself is the canonical harness profile consumer; any regression in harness-mode detection breaks `/medik` against the harness. **Mitigation**: acceptance test — harness self-`/medik` reports identical 14-check output as today (PASS/NOTE/WARN/FAIL counts and per-check status unchanged). Plan-033 verification step runs `/medik` against the harness pre- and post-refactor and diffs the output.
3. **Function rename breaks plan-031 callers**: `/skanner`, kartograf, arkonte may import `detectSkannerProfile` directly. **Mitigation**: `export const detectSkannerProfile = detectProjectProfile` deprecated alias retained until v1.4; deprecation warning added via JSDoc `@deprecated` tag rather than runtime warning to avoid log spam. Planned removal entry in `docs/plans/v1.3.1-backlog.md` (or v1.4 backlog).
4. **`/medik` latency budget**: `/medik` has no documented latency budget per `rules/common/hooks.md`, but plan-028 Phase 5 implicitly assumes "reasonable time". **Mitigation**: consumer profile is FASTER (5–6 checks vs 14), so this refactor reduces consumer-side latency, no regression risk. Harness profile latency is unchanged (same 14 checks, same code).
5. **Plan-028 collision**: plan-028 Phase 4/5 are populating `scripts/lib/medik-checks/` in a parallel session per memory note. Adding `profile` to `CheckContext` and 8 profile guards could collide with concurrent edits. **Mitigation**: plan-033 sequences strictly after plan-028 Phase 5 merges to main. Implementation begins only after `git log main` shows plan-028 Phase 5 commits. Pre-implementation step: read `scripts/lib/medik-checks/types.ts` from main and confirm `CheckContext` shape before extending.
6. **Capability-alignment audit (ADR-029) regression**: `/medik` Check #13 itself is a harness-only check that will now be gated by the `consumer` profile. If Check #13 is the mechanism enforcing capability-alignment in consumer projects too, gating it removes that enforcement. **Mitigation**: Check #13 scans `.claude/skills/*/SKILL.md` against `.claude/agents/*.md` `tools:` fields — both inputs exist in any project that installs the harness plugin. Re-classify Check #13 as **generic with semi-harness markers**: run in both profiles when `.claude/skills/` and `.claude/agents/` directories exist (which they do via plugin install). Update the table in plan-033 Phase 1 to reflect this re-classification before implementation.

## References

- **ADR-031** (project-agnostic /skanner stack) — sister refactor, same pattern, same risk template. This ADR follows ADR-031's structure verbatim. Naming, env var convention, override precedence, and `Detected:` output line are all inherited.
- **ADR-020** (runtime language detection) — reused for generic checks #1–#5. Language routing already works in consumer projects; no new language-detection work required.
- **ADR-010** (plugin distribution model) — referenced, not superseded. Plugin install path and `KADMON_RUNTIME_ROOT` resolution must continue to work; profile detection is consumer-cwd-based via the renamed `detectProjectProfile(cwd)`.
- **ADR-019** (install loader symlinks) — referenced, not superseded. Canonical root symlinks for `agents/`, `skills/`, `commands/` remain unchanged.
- **ADR-024** (install-health telemetry) — Check #8 belongs to harness profile only. The `install-diagnostic.log` file is written by the harness installer; consumer projects that install via the plugin do not have this log in their workspace.
- **ADR-029** (capability-alignment audit) — Check #13 re-classification per Risk #6. The audit must continue to apply to consumer projects when `.claude/skills/` and `.claude/agents/` directories are present (which is the plugin install state).
- **ADR-028** (medik expansion 9→14 + --ALV export) — predecessor. Establishes the `medik-checks/` module shape and the `CheckContext` / `CheckResult` contract that this ADR extends.
- **`.claude/rules/common/agents.md` "Consolidator boundary"** — kody exemption anchor. Same anchor as ADR-031.

## Plan reference

Implementation plan: `plan-033-medik-project-agnostic.md`.
