---
description: Cut a release — version bump + CHANGELOG consolidation + BACKLOG prune + status-flip proposals + tag, composing /doks for count sync. Human-invoked, no-push default.
---

## Purpose

Collapse the 6+ manual release-hygiene steps (version bump, CHANGELOG consolidation, BACKLOG prune, ADR/plan/roadmap status-flip proposals, count sync, annotated tag) into one invocation. `/release` is a **normal, human-invoked** command — there is no scheduled or unattended path. It refuses to cut a broken, empty, or duplicate release, and keeps publishing (`git push`) and the semantic "which ADR actually shipped" judgment as explicit human steps.

Logic lives in `scripts/lib/release/` (`types.ts` + 7 concern modules, module-per-concern per ADR-028). The command **composes** `/doks` for count reconciliation rather than recomputing counts, and re-runs the suite so the hardcoded `expectedCounts` contract test (`tests/plugin/manifest-schema.test.ts`) gates any residual drift. See ADR-037 for the full design (esp. the 2026-07-13 Amendment retiring the earlier autonomous framing).

## Arguments

- `<patch|minor|major>` — **required** bump level. Missing bump arg → run as `--dry-run` and **abort without writing** (fat-finger guard, D1 — never guess a version).
- `--dry-run` — compute and print the full plan, make **zero** writes / zero git ops.
- `--push` — after commit + tag, run `git push --follow-tags` as an **explicit human publish step** (D3). **Off by default** — the human reviews the release commit first.

No other flags. The bump level is a positional argument. The command scans `[Unreleased]` and prints a **suggested** level (advisory: `### Removed`/breaking → major, only `### Fixed` → patch, else minor), but the explicit arg **always wins**.

## Phases

`/release` runs the following phases in order. Nothing is committed or tagged until every write phase and the `/doks` re-verify pass. Each phase is narrated with its `StepResult` (`applied` / `skipped` / `blocked` / `proposed`).

1. **Preflight** — run the five D4 refusal gates (collect-all, so a dry-run shows every blocker):
   1. Dirty working tree (`git status --porcelain` non-empty) → `DIRTY_TREE` (never fold an unrelated in-flight edit into the release commit; parallel sessions are real).
   2. Mechanical verify red (`npm run build && npx vitest run && lint`) → `VERIFY_RED` (never cut a broken release).
   3. Empty `## [Unreleased]` → `EMPTY_UNRELEASED` (nothing to release).
   4. Not on `main` → `NOT_ON_MAIN`.
   5. Tag `vX.Y.Z` already exists → `TAG_EXISTS` (already released — the run is a no-op).
   Any blocker aborts before a single write. (Idempotent-recovery exception: a committed-but-untagged state filters only the false-positive `EMPTY_UNRELEASED` gate — all other gates stay enforced.)
2. **Version bump** — write `.claude-plugin/plugin.json` (canonical) + `package.json` (mirror) to the computed next version. Idempotent: already at target → `skipped`.
3. **Changelog** — rename `## [Unreleased]` → `## [X.Y.Z] — YYYY-MM-DD` (em-dash U+2014, UTC date from injected `now`), insert a fresh empty `## [Unreleased]` above it, preserve the moved `### Added/Fixed/Docs` sub-sections verbatim. Idempotent: `## [target]` already present → `skipped`.
4. **Backlog prune** — remove the closed `- [x] …` items from `BACKLOG.md` (prune-only + warn, AMBIGUITY-1 resolution). Does **not** rewrite CHANGELOG — the `[Unreleased]` narrative is hand-curated. Warns (`UnnarratedPruneWarning`) if a pruned id is not narrated in the CHANGELOG so nothing closes silently.
5. **Status-flip proposals** — scan `[Unreleased]` for referenced `ADR-NNN` / `plan-NNN` / roadmap files and emit proposals (ADR `proposed→accepted`, plan `pending|in-progress→completed`, roadmap `[ ]→[x]`). Rendered as an **output checklist** for the human to act on (D5). **No file is auto-appended** (no WORK.md) and **no** status is auto-flipped.
6. **`/doks` (count sync)** — after the TS writes and before the commit, run `/doks` to reconcile Layer-1 counts (CLAUDE.md + README) against the filesystem. `/release` never recomputes counts itself.
7. **Re-verify** — run `npm run build && npx vitest run` so the hardcoded `expectedCounts` contract test catches any residual drift **before** the commit captures the doc edits.
8. **Commit** — stage the release allowlist **only** (`git add -- <plugin.json/package.json/CHANGELOG.md/BACKLOG.md + the `/doks`-synced CLAUDE.md/README.md>`, never `-A`) so a concurrent-session or user edit made during the write→`/doks`→re-verify window can't fold into the release commit → `git commit -m "chore(release): vX.Y.Z"` with body footer `Reviewed: skip (release metadata — verified mechanically)` (D3/ADR-025).
9. **Tag** — annotated `git tag -a vX.Y.Z -m <message>`. Idempotent: tag exists → `skipped`.
10. **Push (opt-in)** — only if `--push` → `git push --follow-tags`. Off by default.

## Idempotent re-run

Re-running `/release` after a partial failure converges instead of double-applying: version-bump / changelog / backlog-prune each report `skipped` when their target state already holds, and a **committed-but-untagged** state (bump + changelog committed, tag missing) creates only the missing tag — no second release commit.

## `--dry-run` handling

Call `planRelease`, print the plan (next version, CHANGELOG diff preview, BACKLOG prune list, **status-flip proposal checklist**, files touched, tag name, any preflight blockers), and make zero writes / zero git ops. Missing bump arg falls through to this path.

## Implementation

Invoked via the TypeScript pipeline in `scripts/lib/release/orchestrate.ts`, with the `/doks` slash-command call and re-verify sequenced by this command **between** the writes and the commit (a TS module cannot call a slash command — AMBIGUITY-3):

```typescript
import {
  planRelease,
  applyReleaseWrites,
  commitAndTag,
} from "./scripts/lib/release/orchestrate.js";

const deps = { runVerify, now: () => new Date() };
const ctx = { cwd: repoRoot, options, currentVersion }; // currentVersion from plugin.json

// 1. Plan (no writes). Print it. If --dry-run OR missing bump arg, stop here.
const plan = planRelease(ctx, deps);
if (plan.blocked.length > 0) { /* print blockers, abort */ }

// 2. Apply the mechanical writes (no commit, no tag yet).
const writeResults = applyReleaseWrites(ctx, plan, deps);

// 3. SESSION STEP: run /doks to reconcile Layer-1 counts, then re-verify
//    (`npm run build && npx vitest run`) so expectedCounts gates residual drift.

// 4. Commit + tag (writes→commit→tag ordering, D4).
const commitResults = commitAndTag(ctx, plan, deps);

// 5. If --push: git push --follow-tags (explicit human publish step, D3).
```

The three-way split (`planRelease` / `applyReleaseWrites` / `commitAndTag`) is what lets the `/doks` compose call + re-verify slot in at the session layer between the writes and the commit, so the commit captures `/doks`'s edits and the contract test has already gone green.

## Example

```
> /release minor --dry-run
## /release plan (dry-run) — minor

Next version: 1.3.0 → 1.4.0    Tag: v1.4.0    Date: 2026-07-13
Suggested level: minor (matches)

CHANGELOG preview:
  ## [1.4.0] — 2026-07-13
  ### Added
  - /release command (command 11 → 12) …

BACKLOG prune (3 [x] items): AUD-24, AUD-27, AUD-29
Status-flip proposals (act manually — nothing auto-written):
  [ ] ADR-037  proposed → accepted   (referenced by [Unreleased])
  [ ] plan-037 in-progress → completed

Files to touch: .claude-plugin/plugin.json, package.json, CHANGELOG.md, BACKLOG.md
Preflight: OK (5/5 gates clear)

(dry-run — zero writes)

> /release minor
… phases 1-9 narrated, commit + tag created, no push …
Reminder: run `git push --follow-tags` (or re-run with --push) to publish.
```

## See also

- ADR-037: `docs/decisions/ADR-037-release-command.md` (D1–D6 + 2026-07-13 Amendment)
- Plan: `docs/plans/plan-037-release-command.md`
- Implementation: `scripts/lib/release/` (`types.ts` + version-bump, changelog, backlog-prune, status-flips, tag, preflight, orchestrate)
- Count contract: `tests/plugin/manifest-schema.test.ts` (`expectedCounts`)
- Composes: `/doks` (Layer-1 count sync)
