---
number: 025
title: Versioning Policy — Narrative MINORs, PATCH Only for Post-Release Hotfixes
date: 2026-04-23
status: accepted
route: A
plan: ya-quedo-entonces-los-ancient-eagle.md
references: [ADR-010, ADR-024]
---

# ADR-025: Versioning Policy — Narrative MINORs, PATCH Only for Post-Release Hotfixes

**Deciders**: Ych-Kadmon (architect).

## Context

Between 2026-04-21 and 2026-04-22 the harness shipped three releases — `v1.2.0` (runtime language detection, ADR-020), `v1.2.1` (hook_events dedup + orphan staleness), `v1.2.2` (kompact cross-platform + commit-format-guard fix) — each with its own `chore(release):` commit and tag annotation. Two of the three were single-issue PATCHes on in-progress work that had not actually shipped to collaborators under the previous tag; they were effectively "commit-sized bumps" dressed up as releases.

When the architect surveyed this cadence on 2026-04-23 the reaction was direct: **"v1.0 plugin listo, v1.1 alguna mejora, v1.2 todo lo de hoy"** — meaning, releases should be narrative moments (things worth telling a collaborator about), not "one per merged PR". The symptom was release noise; the root cause was an unwritten policy that bumped PATCH per commit.

The retroactive-rename path (re-tag, force-push, update 155 cross-references in docs) was evaluated and rejected: git tags are history, and collaborators (core 3 plus two new installs) had already pinned those tags or installed the plugin under them. Rewriting SHAs breaks trust without fixing the underlying cadence problem.

This ADR captures the forward-facing policy so the next release reflects the architect's intent without relitigating the past.

## Decision

Keep [SemVer](https://semver.org/) (`MAJOR.MINOR.PATCH`). Tighten the criteria for each level.

### MAJOR (`vX.0.0`) — breaking changes to public contract

Reserved for changes that break something a collaborator has integrated against:

- `.claude-plugin/plugin.json` manifest schema change (fields renamed, shape altered).
- `install.sh` / `install.ps1` CLI flags removed or semantics changed.
- Environment variable contract broken (removed, renamed, repurposed). Current public env vars: `KADMON_TEST_DB`, `KADMON_DISABLED_HOOKS`, `KADMON_NO_CONTEXT_GUARD`, `KADMON_EVOLVE_WINDOW_DAYS`, `KADMON_RESEARCH_AUTOWRITE`, `KADMON_RUNTIME_ROOT`, `KADMON_USER_SETTINGS_PATH`, `KADMON_PROJECT_LANGUAGE`, `KADMON_ORPHAN_STALE_MS`.
- Removal or renaming of a harness-exposed agent, command, skill, or hook.
- Upward bump of Node engine floor (`engines.node`).

MAJOR bumps require a migration note in the CHANGELOG entry pointing at concrete steps.

### MINOR (`v1.X.0`) — narrative feature ready for collaborators

A MINOR release corresponds to **one feature worth telling a collaborator about**. Examples that have already shipped at this grain:

- `v1.1.0` — hybrid distribution + canonical symlinks (plugin became installable).
- `v1.2.0` — runtime language detection (TypeScript + Python).
- `v1.2.3` — install health telemetry (this release, under the new policy).

Criteria for a MINOR:

1. **One narrative scope** — the entry fits in a single headline. If the CHANGELOG needs two unrelated sections of "Added", it probably should have been two separate MINORs spaced out.
2. **An ADR exists** for the scope (or a plan file, when the change is purely operational and does not require a recorded decision).
3. **Collaborators can notice it** — it is something a user would describe verbally ("install health"), not an invisible refactor.
4. **Tests pass** (`npm run build && npx vitest run`), `/chekpoint full tier` approved on any production-code diff.

Housekeeping fixes, doc edits, and small quality-of-life improvements made during the same working window as a MINOR feature roll up into that MINOR's CHANGELOG entry — they do not each trigger their own PATCH.

### PATCH (`v1.X.Y`, Y > 0) — post-release hotfix only

A PATCH is bumped **only after a MINOR has shipped to at least one collaborator** and a CRITICAL or HIGH bug is discovered in that released version. Concretely:

- The commit being fixed must be in a tag that an external user could have installed.
- The fix must be surgical and unambiguous — no scope creep, no "while we're at it".
- `Reviewed: full` or `Reviewed: lite` is required on the fix commit (no `skip`).
- A CHANGELOG entry is mandatory, referencing the specific tag that was broken.

Nothing else qualifies for PATCH. Bugs discovered in the development window of an upcoming MINOR are rolled into that MINOR's entry before the tag, never after.

### Anti-patterns explicitly rejected

These were the "one commit = one release" behaviors that prompted this ADR. They are now prohibited by policy:

- `chore(release): v1.X.Y — <single commit scope>` written on the same day as the previous release, with no collaborator having installed it in between.
- CHANGELOG entries that read like individual commit messages (`Fixed: orphan recovery staleness guard`) rather than grouped narrative changes.
- Tag annotations that paraphrase one commit's subject line rather than summarizing a scope.

The anti-patterns are not enforced mechanically today — they are a convention the architect and future reviewers uphold manually. `/chekpoint` footer (`Reviewed: full | lite | skip`) plus a visible tag with a 1-paragraph annotation are the surface where the discipline lands.

## Consequences

**Positive**

- Release noise drops from "1 per commit" to "1 per narrative". The public log of tags + CHANGELOG entries becomes a readable product history instead of a log of fixes.
- Collaborators see version bumps that mean something. "Kadmon-Harness v1.3.0 ships event sourcing" is legible; "v1.2.7 fixes the typo in log message" is not.
- ADRs become a natural release anchor. If an ADR is being written, a MINOR is in motion. If no ADR is in flight, no release should be forthcoming.
- The CHANGELOG becomes the canonical bridge between git history and user-visible change — git log has SHAs, the CHANGELOG has stories.

**Negative**

- Individual fixes sit longer in `main` before reaching a tagged release. Collaborators on the bleeding edge (pulling `main` directly) get the fix immediately; collaborators following tags wait for the next MINOR. Acceptable because the harness is not a production library with external consumers relying on tagged releases for reproducibility — it is an internal tool shared with a handful of trusted collaborators.
- Judgment call ambiguity: "is this narrative-worthy?" occasionally needs a coin-flip. Default when unclear: hold the bump, let more work land, ship when the scope fits one headline. The plan file + arkitect review during `/abra-kdabra` is the place to test the hypothesis before committing to a release.

**Neutral**

- Past tags (`v1.0.0`, `v1.1.0`, `v1.2.0`, `v1.2.1`, `v1.2.2`) are unchanged and remain valid install targets. The CHANGELOG retains historical entries for them. This ADR is forward-looking; it does not rewrite.

## Enforcement

Human review, not mechanical. The enforcement surfaces are:

1. **Pre-release gate**: before `git tag`, the architect (or reviewer) asks *"can I describe this release in one sentence to a collaborator?"* — if no, the release is premature.
2. **`/chekpoint` footer**: release commits use `Reviewed: skip (release metadata only — verified mechanically)` — release work is docs-only (version bumps + CHANGELOG + ADR when applicable) and contains no runtime change.
3. **`/chekpoint` tier rules** (`rules/common/development-workflow.md`) already classify version metadata bumps as `skip` tier — this ADR does not require edits to that table.
4. **CHANGELOG review**: the architect reads the top entry before tagging and rejects it if it reads like a commit message.

If the policy drifts (one-commit PATCHes re-appear), this ADR is the reference for the conversation. No `/medik` check or lint rule is introduced — adding automation to enforce a judgment call creates more noise than it prevents.

## Review

- Next review: **2026-10-23** (6 months). Evidence to evaluate: have the new v1.X.0 MINORs each been "one narrative"? Have any PATCH bumps happened that did not follow the post-release-hotfix rule? Is the CHANGELOG readable as a product story?
- Superseding conditions: if the harness gains external consumers who pin specific tags for reproducibility (libraries, not just collaborators), re-evaluate whether PATCH cadence should loosen to support quicker hotfixes.
