---
number: 37
title: /release command — idempotent release hygiene (bump + CHANGELOG + BACKLOG prune + tag, composes /doks)
date: 2026-07-13
status: completed
needs_tdd: true
route: A
adr: ADR-037-release-command.md
---

## Plan: /release command — idempotent release hygiene [konstruct]

### Overview
Turn ADR-037 into a buildable TDD plan for `/release <patch|minor|major> [--dry-run] [--push]` — a **normal, human-invoked** command that collapses the 6+ manual release-hygiene commits (version bump, CHANGELOG consolidation, BACKLOG prune, status-flip proposals, count sync, tag) into one invocation. Logic lands as `types.ts` + 7 module-per-concern files in `scripts/lib/release/` (mirroring the ADR-028 `medik-checks/` precedent), plus a Direct no-agent `.claude/commands/release.md`. The command **composes** `/doks` for count sync (D6) rather than recomputing counts, and re-runs the suite so the hardcoded `expectedCounts` contract test gates residual drift.

> **Scope note (ADR-037 Amendment 2026-07-13)**: the "4AM autonomous routine" motivation in the ADR body is **RETIRED**. `/release` is a normal human command. The idempotency + refusal gates (D4), no-push default (D3), and propose-only status flips (D5) all stand as **engineering robustness** — the command refuses to cut a broken / empty / duplicate release and keeps publishing + semantic status judgment as explicit human steps. There is **no** unattended-execution path, **no** `WORK.md` auto-append, and **no** autonomous-execution security surface. Every gate below is justified on its own engineering merit, not on unattended safety.

### needs_tdd: true
The 8 TypeScript files in `scripts/lib/release/` (types + 7 concern modules) are the TDD targets: each is a pure/near-pure function of current repo state returning a typed `StepResult`/`ReleasePlan`, and each gets a co-located test written red-first. The command doc (`release.md`) and the count-integration edits (CLAUDE.md / README / CATALOG / `manifest-schema.test.ts`) are `[config/file]` — verified by the build + the count-contract test going green, not by new red-first tests. Each step below is annotated `[TDD]` (write failing test first) or `[config/file]` (no new test; verified by gate/build/contract).

### ADR grounding (re-read before building)
The ADR is authoritative; do NOT re-decide it. When a step says "per D4 gate N" or "per D6 sequencing", read the corresponding ADR-037 decision. The current-state evidence table (ADR §Context) pins the exact files + line ranges each module touches; the module contracts below are grounded against direct reads of those files (see Phase 0).

---

### Phase 0: Research (read before writing any code)
- [ ] Step 0.1: Read the ADR + grounding files at the pinned line ranges (S) `[config/file]`
  - File (read-only): `docs/decisions/ADR-037-release-command.md` (full, esp. the Amendment note + D1–D6 + Out of Scope); `.claude-plugin/plugin.json:3` (canonical version); `package.json:3` (mirror version); `CHANGELOG.md:5-7` ([Unreleased] structure) + `CHANGELOG.md:56` (`## [1.3.0] — 2026-04-24` released-heading em-dash format); `BACKLOG.md:1-9` (prune contract + state legend `[ ] [~] [x] [-] [d]`); `tests/plugin/manifest-schema.test.ts:275-285` (hardcoded `expectedCounts`); `.claude/commands/forge.md` + `.claude/commands/nexus.md` (Direct no-agent frontmatter pattern); `scripts/lib/medik-checks/types.ts` + `scripts/lib/medik-checks/stale-plans.ts` (module + `execFileSync('git', [...])` + tmp-git test precedent).
  - Verify: reader can state (a) the exact released-heading string format `## [X.Y.Z] — YYYY-MM-DD` (em-dash U+2014, space both sides); (b) that plugin.json is canonical and package.json mirrors; (c) that BACKLOG `[x]` = done and the contract says "done items move to CHANGELOG and are pruned here"; (d) `expectedCounts.commands === 11` is the count that must flip to 12.
  - Depends on: none
  - Risk: Low
- [ ] Step 0.2: Confirm the `scripts/lib/release/` + `tests/lib/release/` directories do not yet exist and reserve them (S) `[config/file]`
  - File: `scripts/lib/release/`, `tests/lib/release/` (both new)
  - Verify: `Glob scripts/lib/release/**` and `tests/lib/release/**` return empty — greenfield, no collision with a concurrent session.
  - Depends on: none
  - Risk: Low

---

### Phase 1: Foundation + leaf modules (types + 5 file-disjoint concern modules)
Goal: land the shared types and the five leaf modules (version-bump, changelog, backlog-prune, status-flips, tag), each with its own test file. Independently mergeable: these are pure/file functions usable and tested in isolation — nothing is wired to a command yet, no runtime behaviour changes, the build stays green. **These five modules only import `types.ts`; they are file-disjoint and can be built by parallel feniks agents (one worktree each).**

- [ ] Step 1.1: `types.ts` — shared interfaces (S) `[config/file]` **(Wave 0 — blocks all others)**
  - File: `scripts/lib/release/types.ts`
  - Contract (infer from ADR D1/D4/D5; model on `medik-checks/types.ts`):
    ```typescript
    export type BumpLevel = "patch" | "minor" | "major";

    export interface ReleaseOptions {
      readonly level: BumpLevel;
      readonly dryRun: boolean;   // compute + print plan, zero writes / zero git ops
      readonly push: boolean;     // opt-in publish (git push --follow-tags) — human step (D3)
    }

    // Injected dependencies — keep the heavy toolchain + clock out of the pure modules
    export type VerifyResult = { readonly ok: boolean; readonly failures: readonly string[] };
    export type VerifyRunner = (cwd: string) => VerifyResult; // real impl spawns build+typecheck+test+lint
    export interface ReleaseDeps {
      readonly runVerify: VerifyRunner;
      readonly now: () => Date;   // real impl () => new Date(); tests inject a fixed clock
    }

    export interface ReleaseContext {
      readonly cwd: string;               // repo root
      readonly options: ReleaseOptions;
      readonly currentVersion: string;    // read from plugin.json at construction
    }

    export type StepStatus = "applied" | "skipped" | "blocked" | "proposed" | "failed";
    export interface StepResult {
      readonly step: string;              // e.g. "version-bump"
      readonly status: StepStatus;
      readonly message: string;
      readonly filesTouched: readonly string[];
      readonly details?: unknown;
    }

    export type ReleaseErrorCode =
      | "DIRTY_TREE" | "VERIFY_RED" | "EMPTY_UNRELEASED"
      | "NOT_ON_MAIN" | "TAG_EXISTS" | "IO" | "GIT" | "BAD_VERSION";
    export interface ReleaseError {
      readonly code: ReleaseErrorCode;
      readonly message: string;           // what failed, why, which input (patterns.md)
    }
    export type PreflightResult =
      | { readonly ok: true }
      | { readonly ok: false; readonly blockers: readonly ReleaseError[] };

    export interface StatusFlipProposal {
      readonly file: string;              // ADR/plan/roadmap path
      readonly current: string;           // "proposed" | "pending" | "in-progress" | "[ ]"
      readonly proposed: string;          // "accepted" | "completed" | "[x]"
      readonly reason: string;            // which [Unreleased] entry references it
    }

    export interface ReleasePlan {
      readonly currentVersion: string;
      readonly nextVersion: string;
      readonly bumpLevel: BumpLevel;
      readonly suggestedLevel: BumpLevel; // advisory from [Unreleased] scan (D1)
      readonly tagName: string;           // vX.Y.Z
      readonly releaseDate: string;       // YYYY-MM-DD (UTC, deps.now())
      readonly changelogPreview: string;  // consolidated section text
      readonly filesToTouch: readonly string[];
      readonly backlogPrune: readonly string[];      // [x] lines to move+prune
      readonly statusFlipProposals: readonly StatusFlipProposal[];
      readonly blocked: readonly string[];           // preflight blocker messages, empty if clear
    }
    ```
  - Verify: `npx tsc --noEmit` compiles; no runtime code (type-only file, no test needed — matches `medik-checks/types.ts` which has no test file).
  - Depends on: 0.1
  - Risk: Low

- [ ] Step 1.2: `version-bump.ts` — compute + write semver (S) `[TDD]` **(Wave 1, parallel)**
  - File: `scripts/lib/release/version-bump.ts` + `tests/lib/release/version-bump.test.ts`
  - Contract:
    ```typescript
    export function computeNextVersion(current: string, level: BumpLevel): string; // pure
    export function applyVersionBump(ctx: ReleaseContext, target: string): StepResult; // writes plugin.json + package.json
    ```
    - `computeNextVersion`: plain `X.Y.Z` split (no pre-release/build metadata — out of scope, matches repo's plain versions). patch→`X.Y.(Z+1)`, minor→`X.(Y+1).0`, major→`(X+1).0.0`. Throws `ReleaseError{code:"BAD_VERSION"}` on malformed input.
    - `applyVersionBump`: writes `.claude-plugin/plugin.json` (canonical) + `package.json` (mirror), preserving JSON formatting (2-space indent, trailing newline). **Idempotent**: if plugin.json already `=== target` → `{status:"skipped"}`, no write.
  - Tests (tmp-file fixture with copies of plugin.json + package.json): (a) `computeNextVersion("1.3.0", …)` parametrized → `1.3.1` / `1.4.0` / `2.0.0`; (b) malformed `"1.3"` → throws BAD_VERSION; (c) `applyVersionBump` writes both files → both show target; (d) idempotent: second call same target → `skipped`, file mtime/content unchanged; (e) mirror stays in lockstep (both files equal after write).
  - Verify: `npx vitest run tests/lib/release/version-bump.test.ts` green.
  - Depends on: 1.1
  - Risk: Low

- [ ] Step 1.3: `changelog.ts` — consolidate [Unreleased] → dated heading (M) `[TDD]` **(Wave 1, parallel)**
  - File: `scripts/lib/release/changelog.ts` + `tests/lib/release/changelog.test.ts`
  - Contract:
    ```typescript
    export function isUnreleasedEmpty(cwd: string): boolean;                       // used by preflight gate 3
    export function previewChangelog(cwd: string, target: string, date: string): string; // dry-run, no write
    export function consolidateChangelog(ctx: ReleaseContext, target: string, date: string): StepResult;
    ```
    - `consolidateChangelog`: rename `## [Unreleased]` → `## [target] — date` (em-dash U+2014, exact format `## [X.Y.Z] — YYYY-MM-DD` matching `CHANGELOG.md:56`), then insert a **fresh empty `## [Unreleased]`** above it. Preserve the moved block's `### Added / ### Fixed / ### Docs` sub-sections verbatim. **Idempotent**: if a `## [target]` heading already exists → `{status:"skipped"}`.
    - `isUnreleasedEmpty`: true when the region between `## [Unreleased]` and the next `## [` heading contains no non-whitespace, non-heading content (only blank lines and/or bare `### x` sub-headings).
    - `date` is passed in (orchestrate derives it once via `deps.now().toISOString().slice(0,10)` — UTC, no shell `date`, per D4).
  - Tests (tmp-file fixture with a sample CHANGELOG): (a) consolidates → dated heading with exact em-dash format + correct target/date; (b) inserts a fresh empty `## [Unreleased]` above the dated section; (c) preserves `### Added/Fixed/Docs` sub-sections verbatim in the moved block; (d) idempotent: re-run when `## [target]` exists → `skipped`; (e) `previewChangelog` returns the section text and leaves the file byte-identical on disk; (f) `isUnreleasedEmpty` → true for whitespace/heading-only region, false when a bullet is present.
  - Verify: `npx vitest run tests/lib/release/changelog.test.ts` green.
  - Depends on: 1.1
  - Risk: Medium — string-surgery on a curated file; the em-dash char and the "fresh empty [Unreleased]" insertion are the two easy-to-miss details.

- [ ] Step 1.4: `backlog-prune.ts` — move `[x]` items to CHANGELOG + prune BACKLOG (M) `[TDD]` **(Wave 1, parallel)**
  - File: `scripts/lib/release/backlog-prune.ts` + `tests/lib/release/backlog-prune.test.ts`
  - Contract:
    ```typescript
    export function collectDoneItems(cwd: string): readonly string[];             // pure scan of [x] lines
    export function pruneBacklog(ctx: ReleaseContext, target: string): StepResult; // prune + archival copy into [target] section
    ```
    - `collectDoneItems`: returns only `- [x] …` lines from `BACKLOG.md` (NOT `[ ]`, `[~]`, `[-]`, `[d]`), verbatim (preserving the `AUD-xx`/`R-xx` id + text).
    - `pruneBacklog`: (1) removes the collected `[x]` lines from `BACKLOG.md`; (2) appends them verbatim into the just-created `## [target]` CHANGELOG section under a demarcated machine sub-heading (see **AMBIGUITY-1** resolution below) so they satisfy the BACKLOG "move to CHANGELOG" contract without polluting the hand-curated narrative. Preserve `## P0/P1/P2` section headers + all non-`[x]` items untouched. **Idempotent**: if no `[x]` items remain → `{status:"skipped"}`.
  - Tests (tmp-file fixture: BACKLOG.md + a CHANGELOG.md already containing the `## [target]` section from Step 1.3): (a) `collectDoneItems` returns only `[x]` lines, excludes `[ ]/[~]/[-]/[d]`; (b) `pruneBacklog` removes `[x]` lines from BACKLOG; (c) pruned lines appear verbatim under the demarcated sub-heading in the `## [target]` CHANGELOG section; (d) `## P0/P1/P2` headers + open `[ ]` items preserved; (e) idempotent: re-run with no `[x]` left → `skipped`; (f) empty BACKLOG done-set → `skipped`, CHANGELOG untouched.
  - Verify: `npx vitest run tests/lib/release/backlog-prune.test.ts` green.
  - Depends on: 1.1 (runtime: assumes Step 1.3 created the `## [target]` section; test fixture pre-creates it, so no build-time import of changelog.ts — file-disjoint)
  - Risk: Medium — see AMBIGUITY-1; the "move to CHANGELOG" semantics are the one under-specified spot.

- [ ] Step 1.5: `status-flips.ts` — PROPOSE ADR/plan/roadmap flips (M) `[TDD]` **(Wave 1, parallel)**
  - File: `scripts/lib/release/status-flips.ts` + `tests/lib/release/status-flips.test.ts`
  - Contract:
    ```typescript
    export function proposeStatusFlips(ctx: ReleaseContext): readonly StatusFlipProposal[];
    ```
    - Scans the `## [Unreleased]` CHANGELOG entries for referenced `ADR-NNN` / `plan-NNN` / roadmap files, reads each referenced doc's current `status:` frontmatter (or roadmap `[ ]` checkbox), and emits a proposal only when a flip is warranted: ADR `proposed→accepted`, plan `pending|in-progress→completed`, roadmap `[ ]→[x]`. **Never writes** — output only (D5). A doc already at the target status yields no proposal.
  - Tests (tmp-file fixture: a CHANGELOG [Unreleased] referencing `ADR-037`/`plan-037` + stub ADR/plan files with frontmatter): (a) referenced ADR `status: proposed` → proposes `accepted`; (b) referenced plan `status: in-progress` → proposes `completed`; (c) ADR already `accepted` → no proposal; (d) referenced roadmap open `[ ]` → proposes `[x]`; (e) no referenced docs → returns `[]`; (f) **writes nothing** — assert every referenced file is byte-identical after the call.
  - Verify: `npx vitest run tests/lib/release/status-flips.test.ts` green.
  - Depends on: 1.1
  - Risk: Medium — the "which ADR actually shipped" call stays with the human (D5); this module only surfaces candidates, never decides.

- [ ] Step 1.6: `tag.ts` — idempotent annotated tag (S) `[TDD]` **(Wave 1, parallel)**
  - File: `scripts/lib/release/tag.ts` + `tests/lib/release/tag.test.ts`
  - Contract:
    ```typescript
    export function tagExists(cwd: string, tagName: string): boolean;                // git tag -l vX.Y.Z
    export function createReleaseTag(ctx: ReleaseContext, tagName: string, message: string): StepResult; // git tag -a
    ```
    - Uses `execFileSync("git", [...], { cwd, timeout: 3000, stdio: ["ignore","pipe","pipe"] })` — arg-array, no shell interpolation (security rule), 3s timeout + stdin ignore (matches `medik-checks/stale-plans.ts` + `medik-alv.ts`). **Idempotent**: if `tagExists` → `{status:"skipped"}` (the no-double-tag guarantee, D4 gate 5). Otherwise annotated `git tag -a vX.Y.Z -m <message>`.
  - Tests (**real tmp-git fixture**: `git init` in `mkdtempSync`, one commit): (a) `createReleaseTag` on absent tag → tag present in `git tag -l`; (b) idempotent: tag already exists → `skipped`, no error; (c) tag message includes the version; (d) `tagExists` returns true/false correctly; (e) `git` unavailable / error path → surfaces `ReleaseError{code:"GIT"}` (or `skipped` with a clear message), never throws uncaught.
  - Verify: `npx vitest run tests/lib/release/tag.test.ts` green.
  - Depends on: 1.1
  - Risk: Low

---

### Phase 2: Gates + orchestration (preflight + orchestrate)
Goal: land the refusal gates and the sequencer that ties the leaf modules together with writes→commit→tag ordering and idempotent re-run. Independently mergeable: the full mechanical release logic works via TS (callable/testable) even before the command doc exists.

- [ ] Step 2.1: `preflight.ts` — D4 refusal gates (M) `[TDD]` **(Wave 2 — after 1.2 + 1.3)**
  - File: `scripts/lib/release/preflight.ts` + `tests/lib/release/preflight.test.ts`
  - Contract:
    ```typescript
    export function runPreflight(
      ctx: ReleaseContext,
      targetVersion: string,      // computed by version-bump.computeNextVersion (see AMBIGUITY-2)
      deps: ReleaseDeps,          // deps.runVerify for gate 2 (injected green stub in tests)
    ): PreflightResult;
    ```
    - Runs the five D4 gates in order, aborting with a typed `ReleaseError` on the first failure (or collecting all — collect-all preferred so `--dry-run` shows every blocker):
      1. **Dirty working tree** — `git status --porcelain` non-empty → `DIRTY_TREE` (engineering robustness: never fold an unrelated in-flight edit into the release commit; parallel sessions are real).
      2. **Mechanical verify red** — `deps.runVerify(cwd)` not ok → `VERIFY_RED` (never cut a broken release; `development-workflow.md` "NEVER commit failing tests").
      3. **Empty `[Unreleased]`** — `changelog.isUnreleasedEmpty(cwd)` → `EMPTY_UNRELEASED` (nothing to release).
      4. **Not on `main`** — `git rev-parse --abbrev-ref HEAD !== "main"` → `NOT_ON_MAIN`.
      5. **Tag already exists** — `tag.tagExists(cwd, "v"+targetVersion)` → `TAG_EXISTS` ("already released", the run is a no-op).
    - Imports `isUnreleasedEmpty` from `changelog.ts` and `tagExists` from `tag.ts` (pure read predicates — no cycle; neither imports preflight).
  - Tests (**real tmp-git fixture** + injected `runVerify`): (a) clean tree + green verify + non-empty [Unreleased] + on main + no tag → `{ok:true}`; (b) uncommitted file → `DIRTY_TREE`; (c) `runVerify` returns `{ok:false}` → `VERIFY_RED`; (d) empty [Unreleased] fixture → `EMPTY_UNRELEASED`; (e) branch `feature/x` → `NOT_ON_MAIN`; (f) pre-existing `vX.Y.Z` tag → `TAG_EXISTS`; (g) collect-all: two simultaneous failures both surface in `blockers`.
  - Verify: `npx vitest run tests/lib/release/preflight.test.ts` green.
  - Depends on: 1.2 (`computeNextVersion`), 1.3 (`isUnreleasedEmpty`), 1.6 (`tagExists`)
  - Risk: Medium — gate 2 must inject the verify runner so the unit test does not recursively spawn the toolchain.

- [ ] Step 2.2: `orchestrate.ts` — sequence the phases (L) `[TDD]` **(Wave 3 — after all)**
  - File: `scripts/lib/release/orchestrate.ts` + `tests/lib/release/orchestrate.test.ts`
  - Contract (split into phase functions so the command doc can slot the `/doks` slash-command call between the TS writes and the commit — see AMBIGUITY-3):
    ```typescript
    export function planRelease(ctx: ReleaseContext, deps: ReleaseDeps): ReleasePlan;
    export function applyReleaseWrites(ctx: ReleaseContext, plan: ReleasePlan, deps: ReleaseDeps): readonly StepResult[];
    export function commitAndTag(ctx: ReleaseContext, plan: ReleasePlan, deps: ReleaseDeps): readonly StepResult[];
    ```
    - `planRelease`: derive `releaseDate = deps.now().toISOString().slice(0,10)`; `nextVersion = computeNextVersion(ctx.currentVersion, level)`; run `runPreflight` → if blocked, return a `ReleasePlan` with `blocked[]` populated (and `--dry-run` prints it). Assemble `changelogPreview` (via `previewChangelog`), `backlogPrune` (via `collectDoneItems`), `statusFlipProposals` (via `proposeStatusFlips`), `suggestedLevel` (advisory scan of [Unreleased]: `### Removed`/breaking → major, only `### Fixed` → patch, else minor — the explicit arg always wins, D1). **No writes.**
    - `applyReleaseWrites`: refuse if `plan.blocked` non-empty. Otherwise, in order, call `applyVersionBump` → `consolidateChangelog` → `pruneBacklog`. Status-flip proposals are **output only** — returned in the results, NOT written anywhere (no WORK.md, no auto-flip). Returns per-step `StepResult[]` (each `applied` or `skipped` for idempotency). **Does not commit or tag.**
    - `commitAndTag`: `git add -A` → `git commit -m "chore(release): vX.Y.Z" -m "<body>"` (body carries the `Reviewed: skip (release metadata — verified mechanically)` footer, D3/ADR-025) → `createReleaseTag`. Writes→commit→tag ordering (D4). **Idempotent recovery**: if version already bumped + changelog already consolidated but tag missing (committed-but-untagged state), the write phase steps all report `skipped` and this phase creates only the missing tag.
  - Tests (**real tmp-git fixture** + injected green `runVerify` + fixed `now`): (a) happy path — `planRelease` on clean fixture with non-empty [Unreleased] → correct `nextVersion`/`tagName`/`releaseDate`, `blocked` empty; (b) `applyReleaseWrites` writes files but leaves them **uncommitted** (no commit, no tag — phase separation); (c) `commitAndTag` produces exactly one commit + one annotated tag; (d) commit body contains the `Reviewed: skip (release metadata …)` footer; (e) **idempotent recovery** — pre-seed a committed-but-untagged state, re-run → write steps `skipped`, only the tag is created; (f) blocked plan (dirty tree) → `applyReleaseWrites` refuses, no writes; (g) `TAG_EXISTS` → `planRelease.blocked` = "already released", full no-op; (h) status-flip proposals are returned in results and **written to no file** (assert repo tree has no WORK.md mutation).
  - Verify: `npx vitest run tests/lib/release/orchestrate.test.ts` green; full `npx vitest run` still green (no regressions).
  - Depends on: 1.2, 1.3, 1.4, 1.5, 1.6, 2.1
  - Risk: Medium — the phase split (writes vs commit-and-tag) is what lets `/doks` + re-verify slot in between at the command level; getting the idempotent-recovery branch right is the subtle part.

---

### Phase 3: Command doc + count integration (makes /release invokable)
Goal: wire the TS lib to a Direct no-agent command and flip the command count 11→12 across the four count-bearing files, gated by the contract test. Independently mergeable capstone — this is the slice that gives the user `/release`.

- [ ] Step 3.1: `.claude/commands/release.md` — Direct no-agent command doc (M) `[config/file]`
  - File: `.claude/commands/release.md`
  - Structure (model on `forge.md` / `nexus.md` — **no `agent:` field**; Direct mode per `agents.md`):
    - **Frontmatter**: `description:` only (composes `/doks`, owns no agent chain). No `skills:` (no owning skill).
    - **Arguments**: `<patch|minor|major>` required; `--dry-run`; `--push`. **Missing bump arg → run as `--dry-run` + abort without writing** (fat-finger guard, D1 — never guess a version). Advisory: scan `[Unreleased]`, print suggested level, but the explicit arg always wins.
    - **Phase narration** (D6 sequence): preflight → version-bump → changelog → backlog-prune → status-flip **proposals (output checklist)** → `/doks` (count sync) → re-verify → commit → tag. Each phase narrated with its `StepResult`.
    - **The `/doks` compose call**: after `applyReleaseWrites` (TS) and before `commitAndTag` (TS), the session runs `/doks` to reconcile Layer-1 counts (CLAUDE.md + README), then **re-verifies** with `npm run build && npx vitest run` so the hardcoded `expectedCounts` contract test catches any residual drift *before* the commit captures the doc edits.
    - **`--dry-run` handling**: call `planRelease`, print the plan (next version, CHANGELOG diff preview, BACKLOG prune list, **status-flip proposal checklist**, files touched, tag name, any preflight blockers), make zero writes / zero git ops.
    - **`--push` handling**: after `commitAndTag`, only if `--push` set → run `git push --follow-tags` as an **explicit human publish step** (D3). Off by default; the human reviews the release commit first.
    - **Status-flip proposals**: rendered as a checklist in the command **OUTPUT** for the human to act on (D5). **No file is auto-appended** (no WORK.md) and no ADR/plan/roadmap status is auto-flipped.
    - **Commit footer**: `Reviewed: skip (release metadata — verified mechanically)` (D3/ADR-025).
    - **Implementation** section: the TS calls (`planRelease` / `applyReleaseWrites` / `commitAndTag` from `scripts/lib/release/orchestrate.js`) with the `/doks` + re-verify session steps sequenced between the writes and the commit.
  - Verify: frontmatter parses (agent frontmatter linter via `/medik`); reading the doc, a human can run `/release minor --dry-run` and know exactly what would happen; no `agent:` field present (Direct mode).
  - Depends on: 2.2
  - Risk: Low — prose contract, but must exactly mirror the TS phase split + the `/doks` slot.

- [ ] Step 3.2: Flip command count 11 → 12 across count-bearing files + register in CATALOG (M) `[config/file]`
  - File: `tests/plugin/manifest-schema.test.ts` (`expectedCounts.commands: 11 → 12`, + the `commands=11` comment on ~line 275); `CLAUDE.md:47` (`# 11 slash commands` → 12) + `CLAUDE.md:165` (status-line `11 commands` → 12); `README.md:61` + `README.md:192` + `README.md:644` (`11 commands` → 12); `.claude/commands/CATALOG.md:3` + `:10` (`11 commands`/`Command Reference (11)` → 12) + **add a new `### Release Phase (1)` section** with the `/release` row + Purpose + `—` (no agent).
  - Verify: `npx vitest run tests/plugin/manifest-schema.test.ts` — the `expectedCounts` symlink test goes green (it was RED the moment `release.md` landed until the count flipped to 12); `grep -rn "11 commands\|11 slash" .` returns no stale hits in CLAUDE.md/README/CATALOG.
  - Depends on: 3.1 (release.md must exist for the count to actually be 12)
  - Risk: Low — enumerable, mechanical. **Do this as ONE agent (not parallel)** — these files are shared count surfaces; concurrent edits would conflict.
  - **Note (phase count)**: CATALOG frontmatter says "11 commands grouped by **7 phases**". Adding a "Release Phase" makes it "12 commands grouped by **8 phases**" — update the `7 phases` references in `CATALOG.md:3` + `commands-catalog` description accordingly. See AMBIGUITY-4 (new phase vs fold into existing).

- [ ] Step 3.3: CHANGELOG `[Unreleased]` entry for the /release command (S) `[config/file]`
  - File: `CHANGELOG.md` (`## [Unreleased]` → `### Added`)
  - Verify: a bullet under `### Added` documents `/release` (command 11 → 12), linking ADR-037 + plan-037, noting the `scripts/lib/release/` subsystem (7 modules) and the `/doks` composition. Note counts (tests/files) refresh happens when `/release` itself is next cut — this entry does not need to pre-sync counts.
  - Depends on: 3.1
  - Risk: Low

---

### Phase 4: Hardening + docs polish (light)
Goal: a single end-to-end dry-run smoke on the real repo + secondary doc touchpoints. Not a blocker for Phase 3 merge; folds the ADR's edge cases (already covered as first-class module tests) into one integration proof.

- [ ] Step 4.1: E2E dry-run smoke against the live repo (S) `[TDD]`
  - File: `tests/lib/release/orchestrate.e2e.test.ts` (or a scripted `npx tsx` smoke — negotiate scope: **one** `planRelease` invocation against the real repo root, read-only)
  - Verify: `planRelease({cwd: repoRoot, level:"minor", dryRun:true})` returns a coherent plan (next version `1.4.0`, tag `v1.4.0`, non-empty changelog preview, the current `[x]` BACKLOG items in `backlogPrune`, ADR-037/plan-037 in `statusFlipProposals`) and makes **zero** filesystem/git mutations (assert `git status --porcelain` unchanged before/after). Smoke-before-merge per project memory; scope = 1 invocation, not existence-optional.
  - Depends on: 3.1
  - Risk: Low
- [ ] Step 4.2: Secondary doc touchpoints (S) `[config/file]`
  - File: `docs/onboarding/reference_kadmon_harness.md` (`11 slash commands` → 12, frontmatter + `## 11 slash commands` heading); `docs/README.md:10` (`29 implementation plans` → 30 for plan-037).
  - Verify: `grep -rn "11 slash commands" docs/` returns no stale hits; docs/README plan count matches disk.
  - Depends on: 3.1
  - Risk: Low

---

### TDD build order + parallelizability (build waves)
File-disjoint modules can be built by **parallel feniks agents**; cross-module importers are sequential. Per project memory (`feedback_parallel_sessions`), give each parallel feniks its **own `git worktree`** so concurrent edits never share a working tree.

| Wave | Modules (feniks agents) | Parallel? | Depends on | Notes |
|------|-------------------------|-----------|------------|-------|
| **0** | `types.ts` | — (single) | Phase 0 | Type-only, no test. Blocks everything. |
| **1** | `version-bump.ts`, `changelog.ts`, `backlog-prune.ts`, `status-flips.ts`, `tag.ts` | **Yes — up to 5** | Wave 0 | Each imports only `types.ts`; own `.ts` + own test file; fully file-disjoint. Mix of tmp-file fixtures (bump/changelog/backlog/status) + real tmp-git fixture (tag). |
| **2** | `preflight.ts` | — (single) | Wave 1 (needs `computeNextVersion` + `isUnreleasedEmpty` + `tagExists`) | Real tmp-git fixture + injected `runVerify`. |
| **3** | `orchestrate.ts` | — (single) | Waves 1 + 2 (imports all) | Real tmp-git fixture + injected `runVerify` + fixed `now`. Idempotent-recovery is the hard test. |
| **4** | `release.md` + count flips (3.1/3.2/3.3) + hardening (Phase 4) | — (single agent for the count files; they are shared surfaces) | Wave 3 | `[config/file]`; the `expectedCounts` contract test is the gate. |

**Critical-path length**: 5 waves (0 → 1 → 2 → 3 → 4). With 5 parallel feniks in Wave 1, the wall-clock is `types` + `max(5 leaf modules)` + `preflight` + `orchestrate` + `command/integration`.

### Testing strategy
- **Unit (TDD, 7 test files)**: one co-located test per concern module in `tests/lib/release/` (`types.ts` has none — type-only, matches `medik-checks/types.ts`). Every exported function gets ≥1 test (happy + refusal/edge), 80%+ on new code.
- **tmp-file fixtures** (no git) for `version-bump`, `changelog`, `backlog-prune`, `status-flips`: `fs.mkdtempSync(path.join(os.tmpdir(), "release-<mod>-"))`, seed copies of the real `plugin.json` / `package.json` / `CHANGELOG.md` / `BACKLOG.md` / stub ADR+plan files, `rmSync(..., {recursive:true, force:true})` in `finally`. Never touch the real repo files.
- **Real tmp-git fixtures** for `tag`, `preflight`, `orchestrate`: `git init` in a `mkdtempSync` dir, set `user.email`/`user.name` locally, seed an initial commit, then exercise real `git status`/`branch`/`tag`/`commit` against `ctx.cwd`. This is more faithful than mocking `child_process` (the task's chosen isolation) and mirrors how the harness isolates (`KADMON_TEST_DB=:memory:` for DB, tmp dirs for fs). `execFileSync('git', [...])` runs against the fixture cwd — arg-array, 3s timeout, `stdin: ignore`.
- **Injected heavy deps**: `runVerify` (build+typecheck+test+lint) and `now` are injected (`ReleaseDeps`) — unit tests pass a green stub + a fixed clock so they never recursively spawn the toolchain and the UTC date is deterministic (covers the near-midnight-UTC edge). `/doks` is **not** a TS dependency — it is a slash command sequenced by `release.md` at the session level.
- **Integration**: the `expectedCounts` symlink test (`manifest-schema.test.ts`) is the mechanical gate for the 11→12 flip — RED after `release.md` lands, GREEN after the count files update. Phase 4.1 E2E dry-run smoke proves `planRelease` against the live repo is read-only.
- **Regression**: full `npx vitest run` green after each wave; the leaf modules add no runtime behaviour, so Phase 1/2 merges cannot regress existing flows.

### Build /chekpoint tier
- **Tier: full.** The diff adds production `.ts` under `scripts/lib/` (full tier) AND the command runs **git operations + writes files from computed input** (autonomous-execution security profile is retired, but the *write-and-commit-from-computed-input* surface remains).
- **spektr — MANDATORY** (unchanged from ADR §Consequences): git commit/tag + file writes from computed values = command-injection / path-traversal / unintended-write surface. Use `--force-spektr` if `getDiffScope()` under-routes.
- **orakle — NOT needed**: no schema/SQL/migration touch anywhere in `scripts/lib/release/`.
- **typescript-reviewer** (all `.ts`) + **kody** consolidation as usual.

### Design ambiguities resolved (surface to architect for sanity-check)
- **AMBIGUITY-1 — "move `[x]` items to CHANGELOG" (D5)**: the ADR says the BACKLOG prune "moves items into the CHANGELOG entry", but the `[Unreleased]` narrative is hand-curated (ADR-025) and the `AUD-xx` items are *already* narrated there by hand — a verbatim line-copy would duplicate. **Resolved**: `pruneBacklog` (a) auto-**prunes** the `[x]` lines from BACKLOG.md (the deterministic, contract-authorized action), and (b) appends them verbatim into the new `## [target]` CHANGELOG section under a **demarcated machine sub-heading** (e.g. `#### Backlog items closed this release (auto-pruned)`) — clearly fenced from the hand-written narrative, deterministic, git-revertible. **Alternative for the architect to pick**: prune-only (drop step b, rely on the hand-written narrative as the sole CHANGELOG record). Flagging because this is the single place the ADR is under-specified.
- **AMBIGUITY-2 — preflight needs the tag name, but runs before version-bump**: gate 5 (`TAG_EXISTS`) needs `vX.Y.Z`, yet preflight is the first phase. **Resolved**: `computeNextVersion(current, level)` is a **pure** export of `version-bump.ts`; `orchestrate.planRelease` computes the target first and passes it into `runPreflight(ctx, targetVersion, deps)`. No write happens before preflight; only a pure computation.
- **AMBIGUITY-3 — TS cannot call the `/doks` slash command**: `/doks` is a Claude command (markdown/agent), not a TS function, so `orchestrate.ts` cannot `import` it. **Resolved**: orchestrate is split into `planRelease` / `applyReleaseWrites` / `commitAndTag`; `release.md` sequences the `/doks` slash-command call **between** `applyReleaseWrites` and `commitAndTag` at the session level, then re-verifies before the commit captures `/doks`'s edits. Composition happens at the command layer, exactly as D6 intends.
- **AMBIGUITY-4 — new "Release Phase" vs fold into an existing phase**: `/release` fits no existing phase (Observe/Plan/Build/Scan/Research/Remember/Evolve). **Resolved**: add a new `### Release Phase (1)` to CATALOG and bump "7 phases → 8 phases" in the two references. Cheaper and clearer than mis-filing it under Remember/Evolve. Architect may override if a fold is preferred.
- **AMBIGUITY-5 — `now` injection**: ADR mandates `new Date().toISOString().slice(0,10)`. **Resolved**: `deps.now: () => Date` injected via `ReleaseDeps`; orchestrate derives `releaseDate` once and threads it to `changelog`/`tag`. Real impl `() => new Date()`; tests inject a fixed clock (deterministic UTC + near-midnight edge coverage). Consistent with the harness injectable-runner pattern.

### Risks & mitigations
- Risk: em-dash / "fresh [Unreleased]" surgery corrupts the curated CHANGELOG → Mitigation: `changelog.ts` idempotent + `previewChangelog` (dry-run) asserts byte-identical file in tests; format pinned against `CHANGELOG.md:56`.
- Risk: release commit folds an unrelated concurrent-session edit → Mitigation: D4 gate 1 (dirty-tree abort) + parallel feniks each in their own `git worktree` during the build.
- Risk: double-tag on re-run → Mitigation: D4 gate 5 (`tagExists`) + `tag.ts` idempotency + orchestrate idempotent-recovery test.
- Risk: BACKLOG prune pollutes the hand-written narrative → Mitigation: AMBIGUITY-1 demarcated sub-heading; architect confirms prune-only vs archival-copy before build.
- Risk: count flip (11→12) missed in one file → Mitigation: `manifest-schema.test.ts` `expectedCounts` is the mechanical gate; RED until every count file updates; `grep` sweep in 3.2/4.2.
- Risk: unit test recursively spawns the toolchain via preflight gate 2 → Mitigation: `runVerify` injected; unit tests pass a green stub, only the real `release.md` session run invokes the toolchain.

### Success criteria
- [ ] `scripts/lib/release/`: `types.ts` + 7 concern modules, each ≤200 lines, module-per-concern (ADR-028 SRP).
- [ ] 7 co-located test files in `tests/lib/release/` (~40–45 test cases total), happy + refusal/edge per module; `npx vitest run` green.
- [ ] D4 gates enforced: dirty-tree / red-verify / empty-[Unreleased] / not-on-main / existing-tag all abort with typed `ReleaseError`; writes→commit→tag ordering; idempotent re-run converges (committed-but-untagged → tag-only).
- [ ] D3 respected: no push by default; `--push` is an explicit human publish step; **no unattended/scheduled path anywhere**.
- [ ] D5 respected: only the BACKLOG `[x]` prune auto-applies; ADR/plan/roadmap flips are an **output checklist** — **no WORK.md auto-append, no auto-flip**.
- [ ] D6 respected: `/release` composes `/doks` (never recomputes counts) then re-runs the suite; `expectedCounts.commands === 12` gates residual drift.
- [ ] `.claude/commands/release.md` is a Direct no-agent command (no `agent:` field) mirroring `forge.md`/`nexus.md`.
- [ ] Command count 11 → 12 synced across CLAUDE.md, README, CATALOG (+ new Release Phase), `manifest-schema.test.ts`; CHANGELOG `[Unreleased]` entry added.
- [ ] Out of scope (ADR §Out of Scope) — NOT built: `gh release create`, push-by-default, auto-applied status flips, count recomputation in `/release`, changelog-from-commits, npm publish, monorepo version coordination, `/release rollback`.
- [ ] Build `/chekpoint` full tier with spektr MANDATORY (orakle not needed); TypeScript compiles (`npx tsc --noEmit`); full suite green.
