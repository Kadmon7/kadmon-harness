---
number: 037
title: /release command — idempotent, autonomous-safe release hygiene
date: 2026-07-13
status: accepted
route: A
plan: plan-037-release-command.md
references: [ADR-025, ADR-028, ADR-032, ADR-034, ADR-035]
---

# ADR-037: /release command — idempotent, autonomous-safe release hygiene

**Deciders**: Ych-Kadmon (architect), arkitect (design). Approved 2026-07-13 by the architect with the conservative autonomy default confirmed — D5 status flips stay propose-only (auto-apply limited to the contract-sanctioned BACKLOG prune) and D3 no-push default stands. Status `accepted`; implementation tracked in plan-037.

> **Amendment 2026-07-13 (scope correction)**: The **4AM autonomous-routine** motivation referenced throughout this ADR is **RETIRED**. That scheduled cloud routine was abandoned — the environment pinned the model and could not run Opus (project memory `reference_remote_trigger_env_pins_model`). `/release` is a **normal, human-invoked command** and must not be designed, built, or documented around unattended execution. The idempotency + refusal gates (D4), the no-push default (D3), and the propose-only status flips (D5) all stand on their own merit as **engineering robustness** — the command refuses to cut a broken, empty, or duplicate release, and keeps publishing + semantic status judgment as explicit human steps. Read every "4AM", "unattended", "autonomous", and "burns through the backlog" passage below as "a human wants a clean one-command release." No `WORK.md` auto-append, no scheduled-prompt reconciliation, no autonomous-execution security surface in the build.

> **Amendment 2026-07-15 (D7 — consumer upgrade advisory)**: `/release` gains a final, read-only **upgrade-advisory** phase. The cut already knows `git diff --name-only v<prev>..HEAD`, so it classifies the changed paths into the ADR-010 distribution territories and prints the EXACT commands a consumer runs to pull the release — closing the recurring "what do I run to update?" question and the README gap (the "Updating the harness later" section documented only the clone+install refresh, never the `/plugin update` sequence). **Classification**: `.claude/{agents,skills,commands,hooks}/` + `.claude-plugin/` → **plugin update** (`/plugin marketplace update kadmon-harness` → `/plugin update kadmon-harness@kadmon-harness` → `/reload-plugins`; this works precisely because the D-context version bump moved `plugin.json`, which is what makes `/plugin update` pull the new version rather than skip it); `.claude/rules/` + `.claude/settings.json` + `install.{sh,ps1}` + `scripts/lib/install-apply.ts` → **install re-run** (`install.ps1 -ForcePermissionsSync` / `./install.sh <proj>`); `docs/onboarding/{reference_kadmon_harness.md,CLAUDE.template.md}` → **re-drop onboarding catalog**. Everything else is neutral (no consumer action). Pure read-only (a single `git diff --name-only`), appended to the command output after the tag; **zero new mutation surface** — it only INFORMS. New module `scripts/lib/release/upgrade-advisory.ts` (`classifyPath` + `advisoryFromPaths` + `computeUpgradeAdvisory` + `renderUpgradeAdvisory`), sequenced by `release.md` as the terminal phase. `.kadmon-version` stays an install artifact: an install-territory change implies the consumer re-runs install, which regenerates it.

## Context

The 2026-07-12 full-harness audit (BACKLOG item **AUD-24**, `docs/insights/2026-07-12-full-harness-audit.md`) found **6+ manual release-hygiene commits after v1.3.0 alone**: version bumps, CHANGELOG consolidation, ADR/plan status flips, CLAUDE.md count refreshes, BACKLOG pruning, tags. The audit verdict: a `/release` command is warranted ("needs short plan"). The drift this creates is already visible today — `CLAUDE.md:165` advertises `1158 tests / 90 files` while the CHANGELOG `[Unreleased]` Wave-2 batch records `1224 tests / 92 files`. Release hygiene is being done by hand, inconsistently, across at least four files that carry counts.

There is also a forward-looking use case: the architect wants a **4AM autonomous routine** (triggered on the daily credit reset) that burns through the backlog unattended. A clean, idempotent `/release` is the natural terminal step of such a routine — but only if it is provably safe to run with no human watching. That safety requirement is the crux of this ADR.

### Current-state evidence (read, not assumed)

| Artifact | Location | How it works today |
|----------|----------|--------------------|
| Version (canonical) | `.claude-plugin/plugin.json:3` = `"1.3.0"` | `install.sh:248-264` extracts version from `plugin.json` (jq, sed fallback) — this is the **source of truth**. |
| Version (mirror) | `package.json:3` = `"1.3.0"` | Kept in lockstep with plugin.json "for consistency" (CHANGELOG format note, line 5). |
| `.kadmon-version` | **Not in the harness repo** | Written **per-consumer** by `install.sh` / `install.ps1` Step 10 (`install.sh:243-265`), derived FROM plugin.json at install time. `Read` of the repo-root path returns "does not exist". |
| CLAUDE.md status line | `CLAUDE.md:164-166` | `v1.3.0 — <counts>` free text, hand-edited. |
| CHANGELOG | `CHANGELOG.md:7` | `## [Unreleased]` with `### Added / Fixed / Docs`; released headings are `## [1.3.0] — 2026-04-24` (em-dash + `YYYY-MM-DD`). Keep-a-Changelog format. |
| Counts contract | `tests/plugin/manifest-schema.test.ts:281-284` | `expectedCounts` is **hardcoded** (`agents: 16, skills: 49, commands: 11`) — a red test on drift (that is exactly how AUD-01 fired). |
| Status flips | ADR/plan frontmatter `status:`, roadmap checkboxes, `BACKLOG.md` `[ ]`→`[x]` | Hand-edited per release. |
| BACKLOG prune contract | `BACKLOG.md:5-6` | "On release, done items move to CHANGELOG and are pruned here." Self-declared contract. |

**Correction to the AUD-24 framing**: `.kadmon-version` is *not* a repo-root file `/release` should edit. Bumping `plugin.json` (and its `package.json` mirror) is sufficient; `.kadmon-version` regenerates at each consumer's next install. This removes one item from the naive edit list and reinforces plugin.json as the single version source.

### Constraints

- **ADR-025 (versioning policy)** makes bump-type a **human narrative judgment** ("can I describe this release in one sentence to a collaborator?"), enforced by human review, *not* mechanically. Release commits are `Reviewed: skip (release metadata — verified mechanically)` (ADR-025 line 102). Any `/release` design must not silently make the narrative call.
- **Windows-first**: date injection must not depend on a shell `date` builtin. Existing `scripts/lib/*` use `new Date().toISOString()` (utils.ts, dashboard.ts, session-manager.ts et al.).
- **Parallel sessions are real** (project memory `feedback_parallel_sessions.md`): an autonomous release must never absorb or clobber an unrelated working-tree change from a concurrent session.
- **Route A** is required: `/release` introduces a new command + a new `scripts/lib/release/` subsystem with a cross-file mutation surface (version + CHANGELOG + BACKLOG + git) and an autonomous-execution security profile.

## Decisions

### D1 — `/release <patch|minor|major> [--dry-run] [--push]`; explicit bump required

`/release` takes an **explicit bump level** as its first argument. It does **not** auto-decide the level, because ADR-025 reserves that as a human narrative judgment. It MAY *advise* (scan `[Unreleased]`: a `### Removed` / breaking marker suggests `major`; only `### Fixed` suggests `patch`; else `minor`) and prints the suggestion, but the caller's explicit arg always wins.

- No bump arg → run as if `--dry-run`: print the computed plan + suggested level, then **abort without writing**. Never guess a version unattended.
- `--dry-run` → compute and print the full plan (next version, CHANGELOG diff, proposed status flips, files touched, tag name) with zero filesystem writes and zero git operations.
- `--push` → opt-in; pushes the release commit and tag. **Off by default and never set in the autonomous path** (see D3).

**Autonomous reconciliation**: the 4AM routine encodes the bump level *once* in the scheduled prompt (e.g. `/release minor`). The narrative judgment is thus made by a human when authoring the schedule, not by the machine at runtime — ADR-025's human-judgment model is preserved while still allowing unattended execution.

**Alternatives rejected**:
- *Pure auto-detect from `[Unreleased]`* — violates ADR-025; a mechanical rule cannot judge "narrative-worthy". Kept only as an advisory hint.
- *Interactive prompt for level* — unusable at 4AM (no human to answer). Explicit arg + abort-on-missing is the autonomous-safe equivalent.

### D2 — Logic lives in `scripts/lib/release/` (module-per-concern) + `release.md` command; no runtime agent

Mirror the ADR-028 `scripts/lib/medik-checks/` precedent: a directory of small, single-purpose, independently testable modules, each a pure function of current repo state returning a typed `Result`.

```
scripts/lib/release/
  types.ts             # ReleaseContext, ReleasePlan, StepResult, ReleaseError
  preflight.ts         # safety gates (D4) — returns Ok | Blocked(reasons[])
  version-bump.ts      # compute next semver from level; write plugin.json + package.json
  changelog.ts         # consolidate [Unreleased] -> [x.y.z] — YYYY-MM-DD (UTC via toISOString)
  backlog-prune.ts     # move [x] items to CHANGELOG + prune BACKLOG (per its own contract)
  status-flips.ts      # PROPOSE ADR/plan/roadmap flips (D5) — does not auto-apply
  tag.ts               # idempotent annotated tag (D4)
  orchestrate.ts       # sequence the steps; each step is state-checked before acting
```

`.claude/commands/release.md` holds the operator-facing contract (args, phase narration, the compose calls to `/doks`). Like `/forge` and `/nexus`, `/release` is a **Direct, no-agent** command — the mechanical steps are deterministic, so routing through a sub-agent adds indirection with no reasoning value (consistent with `.claude/rules/common/agents.md` "Direct no-agent" mode). It **composes** other commands (D6), it does not own an agent chain of its own. arkitect + konstruct + feniks build `/release`; they are not invoked when it runs.

**Alternatives rejected**:
- *A shell script (`release.sh` + `release.ps1`)* — forces cross-platform duplication, cannot compose `/doks` or reuse the TS lib, and is not unit-testable against a `:memory:`/tmp-git fixture the way the rest of the harness is. Rejected — every other command is markdown + TS lib for exactly these reasons.
- *A single `release.ts` god-module* — would blow the <200-line file preference the moment all seven concerns land, and blocks parallel TDD. Rejected per the same reasoning as ADR-028 §D1.

### D3 — No push by default; push is a human, post-review action

`/release` (including the autonomous path) stops at a **local commit + local annotated tag**. Publishing (`git push --follow-tags`) is gated behind the explicit `--push` flag, which the 4AM routine never sets.

**Rationale**: a pushed tag is the point of no return for collaborators. Even though tags are not strictly load-bearing here (ADR-025 notes the 4-collaborator universe and "uninstall + reinstall is the documented refresh path", CHANGELOG line 95), autonomous publishing crosses a trust boundary that ADR-025's human-review enforcement model deliberately keeps. The morning-after human runs `git push --follow-tags` after reading the release commit — the same gate ADR-025 already assumes.

### D4 — Idempotency and safety model (autonomous-critical)

`/release` is safe to run unattended at 4AM. The guarantees:

**Refusal gates (preflight aborts before any write)**:
1. **Dirty working tree** → abort. Prevents folding an unrelated concurrent-session change into the release commit (project memory: parallel sessions are real). Hard block, no override in autonomous mode.
2. **Mechanical verification red** → abort. Preflight runs `/chekpoint` Phase-1 equivalent (`npm run build && npm run typecheck && npx vitest run && npm run lint`). A red release is forbidden (`development-workflow.md`: "NEVER commit failing tests").
3. **Empty `[Unreleased]`** → abort. Nothing to release; ADR-025 forbids releases with no narrative.
4. **Not on `main`** (or an explicit release branch) → abort.
5. **Tag `vX.Y.Z` already exists** (`git tag -l vX.Y.Z` non-empty) → abort with "already released"; the run is a no-op. This is the no-double-tag guarantee.

**Idempotency via state-checked steps**: every step first asks "is this already done?" against current repo state before acting, so a re-run after a partial or complete release converges rather than duplicating:
- version-bump: if `plugin.json` already equals the target, skip (no-op).
- changelog: if a `## [x.y.z]` heading already exists, skip consolidation.
- backlog-prune: only moves items still present as `[x]`.
- tag: only tags if the tag is absent.

**Ordering + rollback**: writes happen **before** the commit; the commit happens **before** the tag (the tag is the final durable act).
- Failure *before commit* (any file-write or verification step) → working tree has only uncommitted `/release` edits → `git restore .` reverts cleanly; nothing durable was created.
- Failure *after commit, before tag* → re-running `/release <same-level>` detects the version already bumped and `[Unreleased]` already consolidated, recognizes "this version is committed but untagged", and just creates the missing tag. Idempotent recovery, no manual surgery.
- The autonomous routine treats any preflight abort as a clean, expected outcome (exit 0, message logged) — an aborted release is not an error.

**Date injection**: `new Date().toISOString().slice(0, 10)` → UTC `YYYY-MM-DD`. Cross-platform, no shell `date` dependency. Documented that the date is UTC (a 4AM-local run may straddle a UTC day boundary — acceptable and explicit).

### D5 — Status flips: auto-apply only the contract-authorized prune; propose the rest

Two tiers of status change, split by how much judgment they require:

- **Auto-applied** (deterministic, reversible, contract-authorized): moving `BACKLOG.md` `[x]` items into the CHANGELOG entry and pruning them from BACKLOG. This is explicitly sanctioned by BACKLOG's own contract (`BACKLOG.md:5-6`).
- **Proposed only** (semantic judgment): ADR `proposed→accepted`, plan `pending→completed`, roadmap checkbox closes. `/release` scans which ADRs/plans are referenced in the `[Unreleased]` entries and emits a **proposal checklist** in its output (and, in autonomous mode, appends it to `WORK.md` for morning review). It does **not** auto-flip them. Reason: "did ADR-NNN actually *ship* in this release, or is it partially landed?" is exactly the narrative judgment ADR-025 reserves for a human; auto-accepting a partially-shipped ADR is a silent correctness error.

**Alternative rejected**: *fully-automated status flips* — a plausible "burn the backlog" convenience, but it would let a 4AM run mark a half-shipped ADR `accepted` with no reviewer. The propose-only split keeps autonomy for the safe 90% while fencing the judgment-laden 10%.

### D6 — Counts are `/doks`' job; `/release` composes it, does not recompute

`/release` does **not** recompute the tests/agents/skills/commands/hooks/rules counts. `/doks` owns doc-sync (Layer 1 = CLAUDE.md + README) per ADR-032, and the count contract is already enforced mechanically by `manifest-schema.test.ts`. After the mechanical version/CHANGELOG/BACKLOG writes, `/release` **invokes `/doks`** to reconcile Layer-1 counts, then re-runs the test suite so the hardcoded `expectedCounts` (`manifest-schema.test.ts:281`) gates any residual drift.

Duplicating count logic inside `/release` would create a second source of truth competing with `/doks` and the contract test — the precise anti-pattern ADR-035 exists to prevent. Composition, not duplication.

**Sequencing**: preflight → version-bump → changelog → backlog-prune → status-flip proposals → `/doks` (count sync) → re-verify (build+test) → commit → tag. `/doks` runs *before* the commit so its doc edits are captured in the single release commit.

## Alternatives Considered (command-level)

### Alternative A: keep it manual (status quo)
- **Pros**: zero new code; full human control every time.
- **Cons**: the audit already priced this — 6+ inconsistent hygiene commits per release and live count drift. No path to a 4AM autonomous routine.
- **Why not**: the recurring, mechanical, error-prone nature is the whole reason AUD-24 exists.

### Alternative B: `/release` + separate `/release-notes`
- **Pros**: separation of "cut the version" from "write the notes".
- **Cons**: the CHANGELOG `[Unreleased]` section *is* the release notes; a second command re-reads the same section for no new capability. Two commands to keep in sync.
- **Why not**: `--dry-run` already prints the notes preview. A split adds surface without adding function.

### Alternative C: a Husky/CI release pipeline
- **Pros**: runs off-machine; conventional.
- **Cons**: the harness has no CI release infra; the whole model is local-first CLI (`~/.kadmon/`, sql.js, plugin distribution). A CI pipeline can't participate in the interactive `/abra-kdabra → /chekpoint` loop or the 4AM Claude-driven routine.
- **Why not**: wrong runtime. The 4AM use case is a *Claude Code session*, not a CI job.

## Consequences

### Positive
- The 6+ manual hygiene commits collapse into one `/release <level>` invocation with a `Reviewed: skip (release metadata — verified mechanically)` footer (already the ADR-025-sanctioned tier for release commits).
- Live count drift (CLAUDE.md 1158/90 vs CHANGELOG 1224/92) closes automatically because `/release` composes `/doks` and re-runs the count contract test before committing.
- The 4AM autonomous routine gains a provably safe terminal step: deterministic hygiene runs unattended; judgment-laden flips and publishing wait for morning review.
- `plugin.json` is cemented as the single version source; the `.kadmon-version` confusion in the AUD-24 framing is retired.

### Negative
- New subsystem to maintain: `scripts/lib/release/` (7 modules) + tests (`tests/lib/release/`). File-count growth is the price of module-per-concern SRP.
- `/release` must track every version-bearing file. If a future file starts carrying the version or a count, `/release` (or `/doks`) must learn it. Mitigation: keep the version-bearing set minimal (plugin.json canonical + package.json mirror) and delegate all count surfaces to `/doks`.
- A new autonomous-execution surface exists (writes + git commit + git tag unattended). Mitigation: the D4 refusal gates + no-push default + `spektr` review MANDATORY during the build `/chekpoint` (this command runs git operations and writes files from computed input).

### Risks
| Risk | Mitigation |
|------|------------|
| Autonomous run absorbs a parallel session's uncommitted change | Hard abort on dirty working tree (D4 gate 1); no override in autonomous mode. |
| Double-tag on re-run | `git tag -l vX.Y.Z` check (D4 gate 5) + tag-step idempotency. |
| Auto-flipping a partially-shipped ADR to `accepted` | Status flips beyond BACKLOG prune are propose-only (D5). |
| Wrong bump level chosen by machine | Explicit arg required; missing arg → dry-run + abort (D1). |
| Date lands on wrong day near UTC midnight | UTC date via `toISOString().slice(0,10)`, documented; acceptable for a changelog heading. |
| Count logic drifts from `/doks` | `/release` never recomputes counts; composes `/doks` + re-runs `manifest-schema.test.ts` (D6). |
| Mid-release failure leaves repo half-cut | Writes-before-commit-before-tag ordering + state-checked idempotent re-run (D4). |

## Out of Scope (NOT in v1)

- **`gh release create`** / GitHub Releases — tag only in v1; GitHub Release generation is a later increment.
- **Push by default** — behind `--push`, never autonomous (D3).
- **Auto-applied ADR/plan/roadmap status flips** — propose-only in v1 (D5).
- **Count recomputation inside `/release`** — delegated to `/doks` (D6).
- **Changelog generation *from commits*** — v1 relies on the hand-maintained `[Unreleased]` section, per ADR-025's narrative discipline; no `conventional-changelog`-style auto-generation.
- **npm publish** — the harness is not published to npm.
- **Monorepo / multi-package version coordination** — the harness is single-package.
- **A `/release rollback` command** — manual `git revert <release-commit>` + `git tag -d vX.Y.Z` is the documented undo; automating it is a later increment.

## Rollback (of this decision / the feature)

- The command is additive: delete `.claude/commands/release.md`, `scripts/lib/release/`, and `tests/lib/release/`; remove the command from CATALOG + counts. No persistent state to migrate — `/release` only ever writes files already under version control, so any release it cut is undone with ordinary `git revert` + `git tag -d`.

## Review

- **Next review**: 2027-01-13 (6 months). Evidence to evaluate: has `/release` actually run in the 4AM routine? How many manual hygiene commits happened *despite* it (a sign of scope gaps)? Did the propose-only status-flip boundary (D5) prove too conservative (every release needing morning flip cleanup) — and if so, should a narrow class of flips graduate to auto-apply?
- **Superseding conditions**: if the harness gains CI or external tag-pinning consumers, revisit D3 (push policy) and Alternative C (CI pipeline).

## no_context Application

Grounded in direct reads: `package.json:3` and `.claude-plugin/plugin.json:3` (version sources), `install.sh:243-265` (`.kadmon-version` is an install artifact, not a repo file — confirmed by a failed `Read` of the repo-root path), `CHANGELOG.md:5-7,43,95` (Unreleased structure, released-heading format, monotonicity-relaxation note), `BACKLOG.md:5-6,48` (prune contract + AUD-24 text), `tests/plugin/manifest-schema.test.ts:281-284` (hardcoded count contract), `CLAUDE.md:164-166` (status line, showing live count drift vs CHANGELOG), `.claude/commands/{abra-kdabra,doks,chekpoint,medik}.md` frontmatter (agent-chain declaration patterns), and ADR-025/028/032/034/035 for versioning policy, the module-per-concern precedent, doc-sync ownership, `/chekpoint` phase model, and the single-source-of-truth principle. The bump-level-as-human-judgment constraint is taken verbatim from ADR-025, not invented.
