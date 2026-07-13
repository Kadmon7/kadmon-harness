---
number: 38
title: Working-docs status standard + drift-prevention enforcement
date: 2026-07-13
status: completed
needs_tdd: true
route: A
adr: ADR-038-working-docs-status-standard.md
---

## Plan: Working-docs status standard + drift-prevention enforcement [konstruct]

### Overview
Implements ADR-038: canonicalize the plan/ADR frontmatter enums separately, fix the real drift (plan-036 `in-progress` typo + legalize `superseded` on plans), add a new mechanical `/medik` check #15 (`docs-status-lint`) that FAILs on out-of-enum `status:` and WARNs on illegal `BACKLOG.md` markers, wire an advisory `/chekpoint` NOTE, and document all four status surfaces + numbering gaps in `docs/README.md`. This is hygiene/enforcement infrastructure — no new subsystem; it extends the `medik-checks/` registry, the `stale-plans.ts` parsing pattern, and the `/chekpoint` commit step.

### Assumptions
- Check registry next id is **15** — validated: `DEFAULT_REGISTRY` in `scripts/lib/medik-checks-cli.ts` holds 10-14; #10 is already `stale-plans` (ADR-028's "Check #10" reference in AUD-28 was imprecise). Confirmed by reading the file.
- Check #15 needs **no git and no DB** — pure file reads + regex over `docs/plans/*.md`, `docs/decisions/*.md`, `BACKLOG.md`. `needsDb: false`. Comfortably under the 500ms budget.
- On-disk counts at plan-038 landing: **33 ADR files** (incl. ADR-038) and **31 plan files** (incl. plan-038). `docs/README.md` line 9 currently says "30 ADRs", line 10 says "30 implementation plans" — both stale. Verify with a glob count at implementation time; do not hardcode blindly.
- plan-036 is genuinely mid-flight (recent commits add Step 1.8) — the fix is the hyphen typo only (`in-progress` -> `in_progress`), **not** a semantic change to `completed`.
- `BACKLOG.md` / `WORK.md` live at repo root. Check #15 must guard their existence (consumer projects won't have them — same cwd-existence-guard pattern as checks #8/#14).

### Phase 0: Research (DONE — recorded for the implementer)
- [x] Read `docs/decisions/ADR-038-working-docs-status-standard.md` in full — the decision of record.
- [x] Read `scripts/lib/medik-checks-cli.ts` — `DEFAULT_REGISTRY` structure, `CheckModule` interface, `--checks` parsing, next id = 15.
- [x] Read `scripts/lib/medik-checks/stale-plans.ts` + `types.ts` — `runCheck(ctx): CheckResult` contract, `STATUS_RE = /^status:\s*(\w+)/m`, `category: "knowledge-hygiene"`, the R-15 `"utf-8"` read nit.
- [x] Read `tests/lib/medik-checks/stale-plans.test.ts` — the fixture-in-tmpdir test pattern to mirror.
- [x] Read `.claude/commands/abra-kdabra.md` "Artifact Format" (lines 127-155) — documented plan enum is `pending | in_progress | completed` (missing `superseded`).
- [x] Read `.claude/commands/chekpoint.md` Phase 4 (lines 111-116) — commit-step location for the advisory NOTE.
- [x] Read `.claude/commands/medik.md` check table (lines 108-146) — where the #15 row + "14 checks" count-bumps go.
- [x] Read `docs/README.md` — `## Conventions` section (lines 38-43) is the insertion home for the new `### Status conventions` subsection.
- [x] Verified numbering gaps against actual files: skip = **023 only**; Route-B plan-only = **002, 004, 018, 030**; ADR-only = **014, 021, 022, 024, 025, 026**. Matches ADR-038 exactly.

---

### Phase 1: Migration — make the live tree compliant BEFORE any enforcement exists
> Lands first (or in the same commit as Phase 2's registration step, never after). Both edits are independently valid and harmless standalone (a typo fix + documenting an in-use value), so the tree stays green with nothing enforcing them yet.

- [ ] Step 1.1: Fix plan-036 frontmatter `status: in-progress` -> `status: in_progress` (S)
  - File: `docs/plans/plan-036-sentinel-harness-fork.md` (line 5)
  - Verify: `grep -n "^status:" docs/plans/plan-036-sentinel-harness-fork.md` shows `status: in_progress`; no other status line changed.
  - Depends on: none
  - Risk: Low
- [ ] Step 1.2: Expand documented plan enum in the Artifact Format spec to include `superseded` (S)
  - File: `.claude/commands/abra-kdabra.md` (line 135: `status: pending | in_progress | completed` -> `status: pending | in_progress | completed | superseded`)
  - Verify: line 135 lists all four values; ADR enum line 148 left untouched.
  - Depends on: none
  - Risk: Low

### Phase 2: The check (TDD — red-green-refactor via feniks)
> `needs_tdd: true`. The check module and its helper are proven with fixtures, independent of the live tree. The enum const inside the check MUST include `superseded` for plans (matching Step 1.2) so a live-tree run is green the moment #15 is registered.

- [ ] Step 2.1: Extract shared `parseFrontmatterStatus` helper (S)
  - File (new): `scripts/lib/medik-checks/frontmatter.ts` — export `parseFrontmatterStatus(content: string): string | null` (regex `/^status:\s*(\w+)/m`, `.toLowerCase()`, returns `null` when absent). Mirrors stale-plans' current behavior exactly.
  - File (new test): `tests/lib/medik-checks/frontmatter.test.ts` — cases: extracts + lowercases status; returns null when no `status:` line; ignores `superseded_by:` (the `^status:` anchor must not match it).
  - Verify: `npx vitest run tests/lib/medik-checks/frontmatter.test.ts` — new tests written red first, then green.
  - Depends on: none
  - Risk: Low
- [ ] Step 2.2: Refactor `stale-plans.ts` to consume the shared helper + fix the R-15 read nit (S)
  - File: `scripts/lib/medik-checks/stale-plans.ts` — replace inline `STATUS_RE`/`statusMatch` with `parseFrontmatterStatus(content)`; change the `fs.readFileSync(..., "utf-8")` to `"utf8"` in the same touch (R-15).
  - Verify: `npx vitest run tests/lib/medik-checks/stale-plans.test.ts` — all 6 existing tests still pass (behavior-preserving refactor; the existing suite is the regression gate).
  - Depends on: 2.1
  - Risk: Low
- [ ] Step 2.3: Write failing tests for `docs-status-lint` (M)
  - File (new test): `tests/lib/medik-checks/docs-status-lint.test.ts` — fixture-in-tmpdir pattern (mirror `stale-plans.test.ts`). Cases:
    - Plan enum PASS: each of `pending | in_progress | completed | superseded` in `docs/plans/*.md` -> not a FAIL.
    - Plan enum FAIL: `in-progress` (hyphen) and `accepted` (an ADR value on a plan) -> FAIL, message names the file.
    - ADR enum PASS: each of `proposed | accepted | deprecated | superseded` in `docs/decisions/*.md` -> not a FAIL.
    - ADR enum FAIL: `pending` (a plan value on an ADR) -> FAIL.
    - BACKLOG WARN: an illegal marker (e.g. `- [?]`) -> WARN; the legal 5 (`[ ] [~] [x] [-] [d]`) -> not a WARN.
    - Guards: missing `docs/plans/`, missing `docs/decisions/`, missing `BACKLOG.md` -> no crash, PASS/NOTE (no false FAIL in consumer repos).
    - Precedence: any enum violation -> FAIL overrides marker WARN; marker-only violation -> WARN; clean -> PASS.
  - Verify: `npx vitest run tests/lib/medik-checks/docs-status-lint.test.ts` fails (module not yet implemented) — red state confirmed.
  - Depends on: 2.1
  - Risk: Low
- [ ] Step 2.4: Implement `docs-status-lint.ts` (M)
  - File (new): `scripts/lib/medik-checks/docs-status-lint.ts` — `runCheck(ctx: CheckContext): CheckResult`, `category: "knowledge-hygiene"`.
    - Two hardcoded enum consts with a `// spec: abra-kdabra.md "Artifact Format"` comment (same convention other checks use for thresholds — abra-kdabra.md stays authoritative): `PLAN_STATUSES = ["pending","in_progress","completed","superseded"]`, `ADR_STATUSES = ["proposed","accepted","deprecated","superseded"]`.
    - Scan `docs/plans/*.md` + `docs/decisions/*.md` via `parseFrontmatterStatus`; a present-but-non-member status -> FAIL entry (skip files with no `status:` line).
    - Scan `BACKLOG.md` for checkbox markers using a list-item-anchored regex (e.g. `^\s*[-*] \[(.)\]` per line) so prose brackets never false-positive; a marker char outside `{" ", "~", "x", "-", "d"}` -> WARN entry.
    - Combine to ONE `CheckResult` (one-module-one-result): FAIL if any enum violation, else WARN if any illegal marker, else PASS; aggregate offenders in `message` + `details`.
    - Zero git, zero DB. Guard each path with `fs.existsSync`.
  - Verify: `npx vitest run tests/lib/medik-checks/docs-status-lint.test.ts` — all green; `npx tsc --noEmit` clean.
  - Depends on: 2.3
  - Risk: Medium
- [ ] Step 2.5: Register check #15 in the runner (S)
  - File: `scripts/lib/medik-checks-cli.ts` — add `import { runCheck as runDocsStatusLint } from "./medik-checks/docs-status-lint.js";` and `[15, { name: "docs-status-lint", needsDb: false, run: runDocsStatusLint }]` to `DEFAULT_REGISTRY`.
  - Verify: `npx tsx scripts/lib/medik-checks-cli.ts --cwd . --checks 15` on the live tree returns PASS (Phase 1 already fixed plan-036); default run `--checks` list now includes 15. This is the validate-before-ship gate — it must be GREEN.
  - Depends on: 2.4, **Phase 1 complete** (plan-036 fixed, else this FAILs on the live tree)
  - Risk: Medium

### Phase 3: Documentation + advisory wiring (docs-only; independently mergeable after Phase 1)
- [ ] Step 3.1: Add the `/chekpoint` advisory NOTE at the commit step (S)
  - File: `.claude/commands/chekpoint.md` — in `### Phase 4: Commit and Push` (lines 111-116), insert a new step between "Format as conventional commit" and `git commit`: when the commit description/body references an `AUD-\d+` or `R-\d+` id, emit an advisory NOTE reminding to flip that item's `BACKLOG.md` checkbox to `[x]` and add a `WORK.md` entry. Explicitly advisory — never blocks. Tier-agnostic by construction (all tiers execute Phase 4; skip tier reaches it via line 28).
  - Verify: `grep -n "BACKLOG" .claude/commands/chekpoint.md` shows the NOTE in Phase 4; wording says "advisory" / "does not block".
  - Depends on: none
  - Risk: Low
- [ ] Step 3.2: Add `### Status conventions` subsection to `docs/README.md` (M)
  - File: `docs/README.md` — insert a new `### Status conventions` subsection at the END of the existing `## Conventions` section (after line 43, before the blank line preceding `## Cross-references`). Content: (a) a 4-surface table — ADR frontmatter enum + plan frontmatter enum both **pointing to** `.claude/commands/abra-kdabra.md` "Artifact Format" (pointer, not copy — no enum duplicated), roadmap = checkbox+prose (no frontmatter status), BACKLOG.md = the 5-marker legend `[ ] [~] [x] [-] [d]`, WORK.md = timestamped prose (not linted); (b) the numbering-gaps note: shared monotonic counter across ADRs+plans; **023 is the only fully-skipped number**; Route-B plan-only = 002, 004, 018, 030; ADR-only = 014, 021, 022, 024, 025, 026.
  - Verify: subsection renders under `## Conventions`; no enum literal is duplicated (must contain the phrase pointing to abra-kdabra.md); numbering gaps match the ADR.
  - Depends on: none
  - Risk: Low
- [ ] Step 3.3: Correct stale directory counts in `docs/README.md` (S)
  - File: `docs/README.md` — line 9 `30 ADRs` -> **33** (actual `docs/decisions/ADR-*.md` count incl. ADR-038); line 10 `30 implementation plans` -> **31** (actual `docs/plans/plan-*.md` count incl. plan-038). Compute both with a glob count at implementation time rather than trusting these literals — this table is exactly the drift surface the plan fights. (The ADR called out the ADR count; correcting the plan count in the same table edit is an in-spirit extension, not a re-decision.)
  - Verify: counts equal `ls docs/decisions/ADR-*.md | wc -l` and `ls docs/plans/plan-*.md | wc -l` respectively.
  - Depends on: Phase 1 + Phase 2 files exist (plan-038 present)
  - Risk: Low
- [ ] Step 3.4: Add check #15 to the `/medik` check table + bump "14 checks" -> "15 checks" (S)
  - File: `.claude/commands/medik.md` — add a `| 15 | Docs status lint | both | checks runner --checks 15 (see Checks 10-15 note) | ... |` row under the **Knowledge hygiene** group; update the "Checks 10-14" note heading + default `--checks 10,11,12,13,14` reference to include 15; bump every "14 checks" / "All 14 checks" string (lines ~55, 61, 82, 146, 212) to "15 checks".
  - Verify: `grep -c "14 check" .claude/commands/medik.md` returns 0; the #15 row is present; the default runner invocation documents check 15.
  - Depends on: 2.5
  - Risk: Low
- [ ] Step 3.5: Update the harness `CLAUDE.md` check count (S)
  - File: `CLAUDE.md` (project) — Status line `14 /medik checks` -> `15 /medik checks` (and any sibling "14 /medik checks" mention).
  - Verify: `grep -n "medik check" CLAUDE.md` shows 15; no lingering "14 /medik checks".
  - Depends on: 2.5
  - Risk: Low

---

### Resolved follow-ups (arkitect's 4 open items)
1. **`docs/README.md` "Status conventions" insertion point** — new `### Status conventions` subsection nested under the existing `## Conventions` section, inserted after line 43 (the Naming bullet), before `## Cross-references` at line 45. Groups naturally with the naming/immutability conventions already there. (Step 3.2)
2. **`parseFrontmatterStatus` — SHARE, don't inline.** Extract to a new `scripts/lib/medik-checks/frontmatter.ts` consumed by both `stale-plans.ts` (refactored) and the new `docs-status-lint.ts`. Rationale: (a) ADR-038 Alternative 3 explicitly endorses the shared helper as "the right kind of reuse"; (b) inlining a second copy of the `status:` regex would itself be a drift surface — exactly what this ADR fights; (c) the R-15 `utf-8`->`utf8` read nit gets fixed in the same touch. Trade-off (noted): it edits a tested, working module — mitigated because the refactor is behavior-preserving and `stale-plans.test.ts`'s 6 existing cases are the regression gate. (Steps 2.1-2.2)
3. **`/chekpoint` insertion point** — `.claude/commands/chekpoint.md` `### Phase 4: Commit and Push` (lines 111-116), as a new step between "Format as conventional commit" and `git commit` (the id is known from the message, before the commit executes). Phase 4 runs for all tiers (full/lite/skip per line 28), so the reminder is tier-agnostic by construction. (Step 3.1)
4. **Migration bundling (validate-before-ship)** — Phase 1 (fix plan-036 typo + expand the abra-kdabra plan enum) lands **first or in the same commit** as Step 2.5 (registration), **never after**. The check module + tests (Steps 2.1-2.4) are fixture-based and prove out independent of the live tree; the first moment #15 exists on the live tree, plan-036 is already `in_progress` and the check's enum const already includes `superseded`, so `--checks 15 --cwd .` is GREEN. Step 2.5 explicitly depends on "Phase 1 complete". Tree is never left red at any commit boundary.

### Testing Strategy
- **Unit (new):** `tests/lib/medik-checks/docs-status-lint.test.ts` — valid/invalid plan status, valid/invalid ADR status, BACKLOG legal/illegal markers, missing-dir guards, FAIL-over-WARN precedence. `tests/lib/medik-checks/frontmatter.test.ts` — status extraction, lowercasing, null-on-absent, ignores `superseded_by:`.
- **Regression:** `tests/lib/medik-checks/stale-plans.test.ts` (6 existing cases) must stay green after the Step 2.2 refactor. Any existing `medik-checks-cli` test must still pass with #15 in the registry.
- **Integration (manual, validate-before-ship):** `npx tsx scripts/lib/medik-checks-cli.ts --cwd . --checks 15` returns PASS on the live tree after Phase 1.
- **Full gate:** `npx vitest run` all green + `npx tsc --noEmit` clean before commit.

### Risks & Mitigations
- **Risk: check #15 FAILs the live tree on landing (plan-036 `in-progress`; `superseded` unlisted).** -> Mitigation: Phase 1 fixes both before Step 2.5 registers the check; the check's own enum const includes `superseded`; Step 2.5's verify is the go/no-go gate. Step ordering makes "never red" mechanical, not a matter of discipline.
- **Risk: a legitimately new status value added later trips a false FAIL** (the enum is hardcoded in the check). -> Mitigation: the const carries a `// spec: abra-kdabra.md` comment; the workflow is "expand abra-kdabra.md AND the check const together" (same coupling Phase 1 exercises). Documented in the ADR risk section; the check failing loudly is the intended signal, not a bug.
- **Risk: BACKLOG marker regex false-positives on prose brackets.** -> Mitigation: anchor on list-item checkbox syntax (`^\s*[-*] \[(.)\]`), not bare `[x]`; covered by a fixture case in Step 2.3.
- **Risk: `stale-plans` refactor introduces a behavior change.** -> Mitigation: the helper reproduces the exact `/^status:\s*(\w+)/m` + `.toLowerCase()` semantics; the 6-case existing suite gates it.
- **Risk: count-drift — bumping "14->15 checks" and "30->33/31 ADRs/plans" misses an occurrence.** -> Mitigation: `grep -c "14 check"` must return 0 (Step 3.4 verify); counts computed via glob, not hardcoded (Step 3.3).

### Effort Estimate
**M — ~3-4 hours.** 12 steps across 3 phases; one new ~80-line check module + one small shared helper (both TDD), one tested refactor, and 6 doc/wiring edits. No new subsystem, no git/DB surface in the check.

### Success Criteria
- [ ] plan-036 frontmatter reads `status: in_progress`; abra-kdabra.md plan enum lists `superseded`.
- [ ] Check #15 `docs-status-lint` registered in `DEFAULT_REGISTRY`; `--checks 15 --cwd .` returns PASS on the live tree.
- [ ] Check FAILs on any out-of-enum `status:` in `docs/plans/*.md` or `docs/decisions/*.md`; WARNs on any illegal `BACKLOG.md` marker; guards missing dirs without crashing.
- [ ] `parseFrontmatterStatus` shared by `stale-plans.ts` + `docs-status-lint.ts`; stale-plans' 6 tests still green.
- [ ] `/chekpoint` Phase 4 emits the advisory `AUD-xx`/`R-xx` -> BACKLOG/WORK NOTE (non-blocking, tier-agnostic).
- [ ] `docs/README.md` has a `### Status conventions` subsection (4 surfaces, pointer-not-copy, numbering gaps) and corrected directory counts (33 ADRs / 31 plans).
- [ ] `/medik` surfaces 15 checks; no lingering "14 checks" string in medik.md or CLAUDE.md.
- [ ] All tests pass (`npx vitest run`); TypeScript compiles (`npx tsc --noEmit`).
