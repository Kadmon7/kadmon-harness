---
number: 34
title: /chekpoint diff-scope-aware optimization (Phase 1 mechanical + Phase 2a reviewer routing)
date: 2026-04-26
status: pending
needs_tdd: true
route: A
adr: ADR-034-chekpoint-diff-scope-aware.md
---

## Plan: /chekpoint diff-scope-aware optimization (Phase 1 mechanical + Phase 2a reviewer routing) [konstruct]

### Overview

`/chekpoint` full tier currently runs build + typecheck + tests + lint unconditionally (Phase 1) AND invokes spektr + orakle in parallel regardless of diff content (Phase 2a). Empirical evidence from plan-032 ship 2026-04-26 shows ~50% of Phase 2a invocations producing pure noise (orakle: "zero database touch", spektr: 0 CRITICAL on non-security diffs) and Phase 1 burning ~90s on docs-only commits. This plan introduces a single content-based detector — `getDiffScope(stagedFiles, fileContents?)` exported from `scripts/lib/detect-project-language.ts` — and wires both consumer sites in `.claude/commands/chekpoint.md` to honor its gates while preserving kody as always-on consolidator and exposing `--force-*` override flags. This is an in-place rewrite of an earlier plan-034 draft that scoped only Phase 1; ADR-034 expanded scope to include Phase 2a reviewer routing because the helper logic is identical and the conceptual unit ("what does this diff need?") has one answer per commit.

### Assumptions

- ADR-034 is on disk and is the authoritative spec — validated by reading `docs/decisions/ADR-034-chekpoint-diff-scope-aware.md` (Decision section enumerates the 8-field `DiffScope` interface, file-pattern primary + content-keyword secondary detection rules, conservative-by-default invariant, and `--force-*` overrides).
- `scripts/lib/detect-project-language.ts` currently exports `detectProjectLanguage`, `getToolchain`, `detectProjectProfile`, `detectSkannerProfile` (deprecated alias) — validated by reading lines 1-5 of the file. New `getDiffScope` is additive; NO rename, NO touching existing exports.
- `.claude/commands/chekpoint.md` Phase 1 lives at lines 32-53 and Phase 2a at lines 55-85 — validated by reading. Both sections are markdown body content; no frontmatter changes required.
- `kody` is always invoked at Phase 2b regardless of `getDiffScope` output — validated by reading lines 65-69 of chekpoint.md ("Phase 2b: Consolidation (sequential — AFTER 2a completes)"). Plan must enforce this invariant.
- Test file pattern from plan-032 is reusable — validated by reading `tests/eval/skanner-profile-detection.test.ts` and `tests/lib/doks-profile-detection.test.ts` (Vitest `describe`/`it`/`expect`, pure-function inputs, no I/O for unit tests).
- `getDiffScope` is a pure function (no filesystem I/O for the detection itself; `fileContents` is an optional caller-provided map for content-keyword detection). Mirrors the pure-function shape of plan-031's `detectSkannerProfile` (pre-rename) and plan-032's `detectProjectProfile`.
- Plan-032's plan rewrite (4 phases: Phase 0 Research → Phase 1 Detection adapter → Phase 2 Per-X guards → Phase 3 Command wiring → Phase 4 Verification) is the structural template — validated by reading `docs/plans/plan-032-doks-project-agnostic.md`.
- Test count baseline assumption: ~1091 PASS post-plan-032 ship. Plan-034 adds 22 new cases in `tests/lib/diff-scope-detection.test.ts` (12 mechanical + 10 reviewer-relevance). Phase 0.5 records the live baseline; Phase 4.1 asserts against `baseline + 22`.
- Windows path handling: `getDiffScope` callers may pass `\` or `/` separators. Helper must normalize before extension/substring matching (path.normalize then `.replace(/\\/g, '/')`).

### Phase 0: Research

- [ ] Step 0.1: Read ADR-034 in full to internalize the 8-field `DiffScope` interface, detection rules, and override semantics. (S)
  - File: `docs/decisions/ADR-034-chekpoint-diff-scope-aware.md`
  - Verify: Decision section enumerates `needsBuild`/`needsTypecheck`/`needsTests`/`needsLint`/`needsTypescriptReviewer`/`needsPythonReviewer`/`needsOrakle`/`needsSpektr` + `rationale: Record<string,string>`. Detection table at line ~69 lists file-pattern + content-keyword signals per gate. "User overrides" section lists `--force-spektr`, `--force-orakle`, `--force-all`. Conservative-by-default invariant present.
  - Depends on: none
  - Risk: Low
- [ ] Step 0.2: Confirm current `chekpoint.md` Phase 1 wording (lines 32-53). (S)
  - File: `.claude/commands/chekpoint.md`
  - Verify: Phase 1 has 3 explicit steps (Step 1 detect toolchain via `getToolchain()`; Step 2 run 4 checks per the toolchain table; Step 3 stop on first failure) + a "Missing Python tooling" note. The diff-scope check belongs between Step 1 and Step 2 as a new "Step 1.5".
  - Depends on: none
  - Risk: Low
- [ ] Step 0.3: Confirm current `chekpoint.md` Phase 2a wording (lines 55-85). (S)
  - File: `.claude/commands/chekpoint.md`
  - Verify: Phase 2a invokes `typescript-reviewer`/`python-reviewer` based on file extensions, then "Always: invoke spektr (opus) in parallel" and "Always: invoke orakle (sonnet) in parallel" (lines 62-63). Phase 2b kody is always-on consolidator (lines 65-69). Phase 3 dual-gate logic (rawBlocks vs kodyBlocks) at lines 71-82.
  - Depends on: none
  - Risk: Low
- [ ] Step 0.4: Confirm `detect-project-language.ts` public surface and existing pattern. (S)
  - File: `scripts/lib/detect-project-language.ts`
  - Verify: Public exports are `detectProjectLanguage`, `getToolchain`, `detectProjectProfile`, `detectSkannerProfile` (alias), `ProjectLanguage`, `Toolchain`, `ProjectProfile`, `SkannerProfile` (alias). Header comment at lines 1-5 documents the contract. The new `getDiffScope` + `DiffScope` interface are additive — no existing export touched.
  - Depends on: none
  - Risk: Low
- [ ] Step 0.5: Locate the most recent test pattern as a template + record baseline. (S)
  - Files: `tests/lib/doks-profile-detection.test.ts` (most recent precedent), `tests/eval/skanner-profile-detection.test.ts` (sibling)
  - Verify: Vitest `describe`/`it`/`expect` style; pure function inputs; no I/O for unit cases. Record live baseline: `npx vitest run 2>&1 | tail -5` → note exact PASS count for Phase 4.1 assertion.
  - Depends on: none
  - Risk: Low
- [ ] Step 0.6: Confirm `.claude/rules/common/development-workflow.md` "/chekpoint Tiers" section structure. (S)
  - File: `.claude/rules/common/development-workflow.md`
  - Verify: Section "/chekpoint Tiers" exists with the trigger/tier/reviewers table; identify insertion point for the "runtime authority" paragraph (Step 3.3).
  - Depends on: none
  - Risk: Low

### Phase 1: Detection helper (TDD)

RED-GREEN-REFACTOR. Failing test first, then ship the helper.

- [ ] Step 1.1: RED — write failing test file `tests/lib/diff-scope-detection.test.ts` covering BOTH gate sets (22 cases total). (M)
  - File: `tests/lib/diff-scope-detection.test.ts` (NEW)
  - Action: Create test file mirroring `tests/lib/doks-profile-detection.test.ts` style. Two `describe` blocks:
    - **Block A — mechanical gates (12 cases)**:
      1. Empty diff → all 4 mechanical gates false; rationale `"empty diff"`.
      2. Docs-only (`["docs/plans/plan-034.md", "README.md"]`) → all 4 false; rationale `"docs-only"`.
      3. Config-only `package.json` → `{build:true, typecheck:true, tests:false, lint:true}`; rationale `"config-only"`.
      4. Config-only `tsconfig.json` → same as case 3.
      5. Config-only `pyproject.toml` → same as case 3.
      6. Config-only `.gitignore` → same as case 3.
      7. Test-only TS (`["tests/lib/foo.test.ts"]`) → `{build:false, typecheck:true, tests:true, lint:true}`; rationale `"test-only"`.
      8. Test-only Python (`["tests/test_bar.py"]`) → same shape as case 7.
      9. Production TS (`["scripts/lib/foo.ts"]`) → all 4 mechanical gates true; rationale contains `"code present"`.
      10. Mixed docs + production TS → all 4 mechanical gates true (any code → all true); rationale `"code present"`.
      11. Unknown extension (`["assets/blob.foo"]`) → all 4 true (safe default); rationale contains `"safe default"` or `"unknown extension"`.
      12. Mixed config + production TS (monorepo edge) → all 4 mechanical gates true.
    - **Block B — reviewer-relevance gates (10 cases)**:
      1. `["scripts/lib/foo.ts"]` no SQL/security keywords → `needsTypescriptReviewer:true, needsPythonReviewer:false, needsOrakle:false, needsSpektr:false`; rationale entries for each.
      2. `["src/handler.py"]` no SQL/security keywords → `needsTypescriptReviewer:false, needsPythonReviewer:true, needsOrakle:false, needsSpektr:false`.
      3. SQL keyword in body — `fileContents = {"src/repo.ts": "supabase.from('users').select()"}` → `needsOrakle:true`; rationale references `"supabase.from"`.
      4. SQL filename — `["migrations/001-init.sql"]` → `needsOrakle:true`; rationale references `"sql migration"` or `"*.sql"`.
      5. Security file path — `["src/auth/jwt.ts"]` → `needsSpektr:true`; rationale references `"auth"` path.
      6. exec/spawn keyword — `fileContents = {"scripts/run.ts": "execSync('npm test')"}` → `needsSpektr:true`; rationale references `"execSync"`.
      7. Mixed TS + .py + SQL + auth path — all four reviewer gates true.
      8. .ts file with no relevance signals — `needsTypescriptReviewer:true`, all others false (no false-positive on plain TS).
      9. SQL keyword in `.md` file — `fileContents = {"docs/x.md": "FROM users JOIN orders"}` → `needsOrakle:false` (file-pattern primary; markdown excluded from content scan).
      10. Conservative-by-default — uncertain extension with no fileContents passed → all reviewer gates default to TRUE (never silent skip).
  - Verify: `npx vitest run tests/lib/diff-scope-detection.test.ts` fails because `getDiffScope` does not yet exist (import error or undefined).
  - Depends on: Phase 0 complete
  - Risk: Low (test-only)
- [ ] Step 1.2: GREEN — add `DiffScope` interface and `getDiffScope(stagedFiles: string[], fileContents?: Record<string, string>): DiffScope` to `scripts/lib/detect-project-language.ts`. (M)
  - File: `scripts/lib/detect-project-language.ts`
  - Action:
    1. Append the `DiffScope` interface after the existing `Toolchain` interface (~line 24). 8 boolean fields per ADR-034 § Decision + `rationale: Record<string, string>`.
    2. Append `getDiffScope` near the bottom of the file alongside `detectProjectProfile`. Pure function: no `fs.readFileSync` for content (caller passes `fileContents` map); only path normalization + extension matching + optional content-keyword scan.
    3. Implement detection rules per ADR-034 detection table (file-pattern primary, content-keyword secondary). Conservative-by-default — uncertain → TRUE.
    4. Populate `rationale` per gate: human-readable string keyed by gate name (e.g., `rationale.needsOrakle = "no SQL/schema/migration files; no orakle invocation"` when false; `"sql migration file: migrations/001-init.sql"` when true).
    5. Update top-of-file comment to mention ADR-034.
    6. **No modification** to `detectProjectLanguage`, `getToolchain`, `detectProjectProfile`, `detectSkannerProfile` exports.
  - Verify: `npx vitest run tests/lib/diff-scope-detection.test.ts` shows 22/22 green. `npx tsc --noEmit` clean.
  - Depends on: 1.1
  - Risk: Medium (Windows path normalization is the most likely regression source — use `path.normalize` then `.replace(/\\/g, '/')` before substring/extension checks; use `path.extname` for extension; do not rely on raw string suffix)
- [ ] Step 1.3: REFACTOR + regression — confirm existing `detectProjectLanguage`, `getToolchain`, `detectProjectProfile`, `detectSkannerProfile` tests still pass; clean up any duplication introduced by helper. (S)
  - Command: `npx vitest run tests/lib/ tests/eval/skanner-profile-detection.test.ts tests/lib/doks-profile-detection.test.ts`
  - Verify: full test suite green; baseline + 22 new cases. No existing test touched. If any existing test breaks, the new export accidentally clashed with an existing name or imported helper was misused.
  - Depends on: 1.2
  - Risk: Low (additive change only)

### Phase 2: Phase 1 mechanical wiring

Insert `getDiffScope` call between toolchain detection and check execution. Per-step skip logging with rationale. Conservative-by-default.

- [ ] Step 2.1: Update `.claude/commands/chekpoint.md` Phase 1 with diff-scope step + per-step skip logging. (M)
  - File: `.claude/commands/chekpoint.md`
  - Action:
    1. After existing "Step 1: Detect toolchain" (line 36-40), insert new "Step 1.5: Detect diff scope":
       ```
       **Step 1.5: Detect diff scope.** Run:
       ```
       npx tsx -e "import('./scripts/lib/detect-project-language.js').then(async m => { const cp = await import('node:child_process'); const files = cp.execSync('git diff --staged --name-only', {encoding:'utf8'}).trim().split('\n').filter(Boolean); console.log(JSON.stringify(m.getDiffScope(files))); })"
       ```
       Or use the equivalent compiled path from `dist/scripts/lib/detect-project-language.js`. Returns the `DiffScope` object with 8 gates + rationale. **Always log the rationale at the start of Phase 1** so the user sees what will run and what will skip.
       ```
    2. Update existing "Step 2: Run the 4 checks" to: "Run the 4 checks using the detected toolchain, gated by `DiffScope`. For each step: if the corresponding `needs*` gate is `false`, log `(skipped: <rationale>)` instead of running. If the toolchain returns `null` (e.g., `build` for Python), still skip with the existing `(skipped: no X step for <language>)` message. Conservative-by-default: ambiguous → run."
    3. Add a "Skip if" column to the table at lines 44-49:

       | # | Step | TypeScript toolchain | Python toolchain | Skip if |
       |---|------|---------------------|------------------|---------|
       | 1 | Build | `npm run build` | (skipped — null) | `!needsBuild` |
       | 2 | Typecheck | `npx tsc --noEmit` | `mypy .` | `!needsTypecheck` |
       | 3 | Test | `npx vitest run` | `pytest` | `!needsTests` |
       | 4 | Lint | `npx eslint . --ext .ts,.js` | `ruff check . && black --check .` | `!needsLint` |

  - Verify: `grep -n "Step 1.5\|getDiffScope\|Skip if" .claude/commands/chekpoint.md` — at least 3 hits. Phase 1 now has 4 explicit steps (1, 1.5, 2, 3) + Missing Python tooling note.
  - Depends on: Phase 1 complete
  - Risk: Low (markdown-body documentation change to a command file; `/medik` Check #8 lints agent frontmatter, not command body)
- [ ] Step 2.2: Verify `/medik` Check #8 (agent frontmatter linter) still PASS. (S)
  - Command: locate via `grep -rn "Check #8\|lint-agent-frontmatter" scripts/` — invoke the underlying script directly.
  - Verify: PASS — no agent file touched, only command body markdown edited.
  - Depends on: 2.1
  - Risk: Low

### Phase 3: Phase 2a reviewer-conditional wiring

Replace "Always invoke spektr + orakle" with conditional invocation rules per `DiffScope` reviewer gates. Document override flags. Update Phase 2a output format. Update rules table to mark itself descriptive.

- [ ] Step 3.1: Update `.claude/commands/chekpoint.md` Phase 2a with conditional invocation + override flags. (M)
  - File: `.claude/commands/chekpoint.md`
  - Action:
    1. Replace lines 55-64 (Phase 2a body) with the conditional version:
       ```
       ### Phase 2a: Specialist Review (parallel, conditional per DiffScope)

       1. Reuse the `DiffScope` object from Phase 1 Step 1.5 (no second computation).
       2. Get diff: `git diff --staged` or `git diff HEAD~1`
       3. Launch specialist reviewers **in parallel** (single message, multiple Agent calls), each gated on the corresponding `needs*` flag:
          - `needsTypescriptReviewer` → invoke **typescript-reviewer** (sonnet)
          - `needsPythonReviewer` → invoke **python-reviewer** (sonnet)
          - `needsSpektr` → invoke **spektr** (opus)
          - `needsOrakle` → invoke **orakle** (sonnet)
       4. **Conservative-by-default**: any gate ambiguity (uncertain → TRUE) means the specialist runs.
       5. **kody (Phase 2b) ALWAYS runs as consolidator** regardless of which specialists fired. Never gated by `DiffScope`.

       **User override flags** (always available, restore mandatory invocation):
       - `/chekpoint full --force-spektr` — invoke spektr regardless of `needsSpektr`
       - `/chekpoint full --force-orakle` — invoke orakle regardless of `needsOrakle`
       - `/chekpoint full --force-ts-reviewer` — invoke typescript-reviewer regardless
       - `/chekpoint full --force-python-reviewer` — invoke python-reviewer regardless
       - `/chekpoint full --force-all` — restore current always-on behavior (all 4 specialists)
       ```
  - Verify: `grep -n "needsSpektr\|needsOrakle\|--force-spektr\|--force-orakle\|--force-all" .claude/commands/chekpoint.md` — at least 5 hits. The phrase "Always: invoke spektr" no longer appears.
  - Depends on: 2.2
  - Risk: Medium (Phase 2a is the heart of the review pipeline; mis-wiring could silently skip a needed reviewer — Phase 4 self-tests are the backstop)
- [ ] Step 3.2: Update Phase 2a output format to log invoked vs skipped specialists with rationale. (S)
  - File: `.claude/commands/chekpoke.md` — typo? **`.claude/commands/chekpoint.md`**
  - Action: Append to the existing Phase 2a section (after the user-override flags block):
    ```
    **Output**: Phase 2a logs which specialists were invoked vs skipped, mirroring the Phase 1 skip-logging pattern. Example:
    ```
    Phase 2a specialists:
      typescript-reviewer: INVOKED (needsTypescriptReviewer: true — .ts files in diff)
      python-reviewer:     SKIPPED (needsPythonReviewer: false — no .py files in diff)
      spektr:              SKIPPED (needsSpektr: false — no auth/exec/path/SQL keywords)
      orakle:              SKIPPED (needsOrakle: false — no SQL/schema/migration/Supabase touch)
    Override flags applied: none
    ```
    ```
  - Verify: `grep -n "INVOKED\|SKIPPED.*needsSpektr" .claude/commands/chekpoint.md` — at least 2 hits.
  - Depends on: 3.1
  - Risk: Low
- [ ] Step 3.3: Update `.claude/rules/common/development-workflow.md` "/chekpoint Tiers" section — mark table descriptive. (S)
  - File: `.claude/rules/common/development-workflow.md`
  - Action: Insert a paragraph immediately after the trigger/tier/reviewers table:
    ```
    > **Runtime authority**: As of ADR-034, `getDiffScope()` (in `scripts/lib/detect-project-language.ts`) is the runtime authority for Phase 2a reviewer routing within the `full` tier. The table above is **descriptive** (matches typical behavior) but the helper's gates are the source of truth. Drift between the table and the helper resolves via an ADR amendment, not in-line table edits. Override flags (`--force-spektr`, `--force-orakle`, `--force-ts-reviewer`, `--force-python-reviewer`, `--force-all`) restore mandatory invocation when needed.
    ```
  - Verify: `grep -n "Runtime authority\|getDiffScope.*runtime authority\|--force-all" .claude/rules/common/development-workflow.md` — at least 2 hits.
  - Depends on: 3.2
  - Risk: Low (rule clarification, no behavior change at the rule level)
- [ ] Step 3.4: Verify the Phase 3 dual-gate logic still works when specialists are skipped. (S)
  - File: `.claude/commands/chekpoint.md` (Phase 3, lines 71-82)
  - Action: Re-read Phase 3 lines 71-82. Confirm `rawBlocks` is computed as the union of BLOCKs from any Phase 2a specialist *that actually ran*, not from a hardcoded list. If the spec text implies a hardcoded list, append a clarifying line: "If a specialist was skipped per `DiffScope`, it contributes 0 BLOCKs to `rawBlocks`. The dual-gate logic is unaffected — `rawBlocks` is the union of BLOCKs from *invoked* specialists."
  - Verify: Phase 3 spec is internally consistent with conditional Phase 2a invocation. `grep -n "rawBlocks\|invoked specialist\|specialist was skipped" .claude/commands/chekpoint.md` — covers the new clarification.
  - Depends on: 3.3
  - Risk: Low

### Phase 4: Verification

- [ ] Step 4.1: Mechanical — full vitest, tsc, eslint. (S)
  - Commands: `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`
  - Verify: Phase 0.5 baseline + 22 new cases (12 mechanical + 10 reviewer-relevance) PASS. Zero `tsc` errors. Zero new eslint errors on `scripts/lib/detect-project-language.ts` and `tests/lib/diff-scope-detection.test.ts`.
  - Depends on: Phase 3 complete
  - Risk: Low
- [ ] Step 4.2: Self-test — docs-only synthetic diff. (M)
  - Action: On a clean working tree, stage a single docs-only edit (e.g., `echo "test" >> docs/plans/plan-034-chekpoint-phase1-diff-scope.md && git add docs/plans/plan-034-chekpoint-phase1-diff-scope.md`). Invoke `/chekpoint full`.
  - Verify:
    - Phase 1 Step 1.5 emits `Diff scope: docs-only` (or equivalent rationale).
    - Phase 1 build/typecheck/test/lint all log `(skipped: docs-only)` in <5 seconds total.
    - Phase 2a logs all 4 specialists as SKIPPED (no .ts/.py/SQL/security surface).
    - Phase 2b kody runs anyway as consolidator (always-on invariant).
    - Phase 3 gate: rawBlocks = empty, kodyBlocks = empty → proceeds to commit.
  - Cleanup: `git reset HEAD docs/plans/plan-034-chekpoint-phase1-diff-scope.md` to discard the stage; do NOT commit the synthetic edit.
  - Depends on: 4.1
  - Risk: Medium (first end-to-end exercise of the spec across both consumer sites)
- [ ] Step 4.3: Self-test — `.ts` production diff with no SQL/security signals. (M)
  - Action: Stage a tiny no-op edit to a non-security `scripts/lib/*.ts` file (e.g., add a JSDoc comment to an existing function). Invoke `/chekpoint full`.
  - Verify:
    - Phase 1 runs all 4 mechanical steps (no skips).
    - Phase 2a logs typescript-reviewer INVOKED, python-reviewer/spektr/orakle SKIPPED with rationale.
    - Phase 2b kody runs.
    - Wall time approximately matches `typescript-reviewer + kody` invocation only (no spektr or orakle latency).
  - Cleanup: `git reset` the stage.
  - Depends on: 4.2
  - Risk: Medium (validates the most common production-edit case)
- [ ] Step 4.4: Self-test — SQL migration diff. (M)
  - Action: Create a stub `migrations/test-001.sql` with `CREATE TABLE foo (id INT);` and stage it. Invoke `/chekpoint full`.
  - Verify:
    - Phase 2a logs orakle INVOKED (needsOrakle: true — migration file pattern), typescript-reviewer/python-reviewer/spektr SKIPPED.
    - Phase 2b kody runs.
  - Cleanup: `git reset` and `rm migrations/test-001.sql`.
  - Depends on: 4.3
  - Risk: Medium
- [ ] Step 4.5: Backward-compat — re-run new logic against last 5 real commits, verify no false-skip of a reviewer that previously found a real issue. (M)
  - Action: For each of the last 5 commits on the current branch (`git log --oneline -5`), reconstruct the staged file list and run `getDiffScope(files)` programmatically. Cross-reference the gate output with the actual reviewer findings recorded in those commits' `Reviewed:` footer + git body.
  - Verify: For each commit, the gates that fired in production (e.g., `Reviewed: full` with all 4 specialists) align with `getDiffScope` recommending invocation OR the user-override flags would have been applied. Zero cases where `getDiffScope` recommends skipping a specialist that found a real BLOCK in the historical commit.
  - Depends on: 4.4
  - Risk: High (regression backstop — if any historical BLOCK would have been missed by the new routing, the helper's heuristics need revision before merge)
- [ ] Step 4.6: `git diff --stat` hygiene check. (S)
  - Expected paths (and ONLY these):
    - `scripts/lib/detect-project-language.ts` (additive: `DiffScope` interface + `getDiffScope` function)
    - `tests/lib/diff-scope-detection.test.ts` (NEW — 22 cases)
    - `.claude/commands/chekpoint.md` (Phase 1 Step 1.5 + Phase 2a conditional + override flags + output format)
    - `.claude/rules/common/development-workflow.md` (runtime authority paragraph after tier table)
    - `docs/decisions/ADR-034-chekpoint-diff-scope-aware.md` (already on disk)
    - `docs/plans/plan-034-chekpoint-phase1-diff-scope.md` (this file)
  - Verify: `git diff --stat main...HEAD` shows exactly the above; no scope creep into agent files, no skill edits, no kody.md edits (preservation rule lives there but is unchanged by this plan).
  - Depends on: 4.5
  - Risk: Low

### Test Plan (TDD targets)

| Phase | Test file | TDD step | Cases | Notes |
|------|-----------|----------|-------|-------|
| 1 | `tests/lib/diff-scope-detection.test.ts` (NEW) | RED 1.1 → GREEN 1.2 → REFACTOR 1.3 | 22 (12 mechanical + 10 reviewer-relevance) | Pure function; Vitest unit tests; reuses doks-profile-detection helper style; no I/O |
| 4 | Self-test: docs-only synthetic diff | E2E behavioral | 1 (Phase 1 + Phase 2a all-skip) | Manual; transcript in PR body |
| 4 | Self-test: `.ts` production diff | E2E behavioral | 1 (typescript-reviewer-only routing) | Manual |
| 4 | Self-test: SQL migration diff | E2E behavioral | 1 (orakle-only routing) | Manual |
| 4 | Backward-compat: last 5 commits replay | Regression backstop | 5 (no false-skip of a historical BLOCK) | Programmatic — run `getDiffScope` against historical staged sets |

Total NEW unit cases: **22** in `tests/lib/diff-scope-detection.test.ts`.

### Invariants (enforce throughout plan body)

1. **kody ALWAYS runs at Phase 2b** as consolidator — never gated by `getDiffScope`. Phase 2b body in `chekpoint.md` lines 65-69 is unchanged.
2. **User overrides always available** — `--force-spektr`, `--force-orakle`, `--force-ts-reviewer`, `--force-python-reviewer`, `--force-all` restore mandatory invocation. Documented at Phase 2a in chekpoint.md (Step 3.1) AND in development-workflow.md "Runtime authority" paragraph (Step 3.3).
3. **Conservative-by-default** — any uncertainty in `getDiffScope` resolves to TRUE (run the gate). Asserted by Block B case 10 in Step 1.1.
4. **Plan-034's original Phase 1 design ships UNCHANGED** — Phase 2a wiring is added on top. Phase 1 mechanical gates (`needsBuild`/`needsTypecheck`/`needsTests`/`needsLint`) and the 12 mechanical test cases preserve the original design.
5. **`getDiffScope()` is pure** — no filesystem I/O for the detection itself. Caller passes `fileContents` map for content-keyword scan. Additive export only; follows established `detectProjectProfile`/`detectSkannerProfile` pattern in the same module.
6. **No rename, no touching existing exports** — `detectProjectLanguage`, `getToolchain`, `detectProjectProfile`, `detectSkannerProfile`, `ProjectLanguage`, `Toolchain`, `ProjectProfile`, `SkannerProfile` all unchanged.

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `getDiffScope` heuristic misses a real concern (e.g., `.ts` file imports SQL builder library; orakle would have caught the resulting query but the diff has no direct SQL string) | Layered detection: file-pattern primary + content-keyword secondary (`supabase.from`, `sql\``, `FROM `, `JOIN `, `INSERT INTO`). User override (`--force-orakle`) as escape hatch. Conservative-by-default invariant. Phase 4.5 backward-compat replay against last 5 commits as regression gate. |
| Phase 2a conditional silently skips a specialist that catches a regression on a future commit | Conservative-by-default + `--force-all` flag + Phase 4.5 historical replay + the `rationale` field is always logged so the user can see what was skipped and why. |
| `kody` accidentally gated by `DiffScope` (invariant violation) | Explicit invariant #1 above + Phase 4.2/4.3/4.4 self-tests all assert "Phase 2b kody runs anyway". |
| Two consumer sites change in one ship — bisecting a regression requires reading both phases | Mitigated by ADR-034 Decision rationale (single helper, single TDD surface, single mental model). `--force-all` flag restores current behavior as immediate escape hatch without rolling back the ADR. |
| Spec drift between `chekpoint.md` Phase 2a + `development-workflow.md` tier table | Step 3.3 explicitly marks the table descriptive; `getDiffScope()` is runtime authority. Drift resolves via ADR amendment, not in-line table edits. |
| Windows path separators break extension/substring matching | Step 1.2 normalizes every input path with `path.normalize` then `.replace(/\\/g, '/')` before predicates; Block A test cases include Windows-style sub-tests (mirrors plan-034 original Phase 1 design). |
| `getDiffScope` grows over time and becomes a maintenance hotspot | Pure function with full unit-test coverage; additive-only changes (new patterns appended, never reshuffled); new patterns require ADR amendment so rationale is captured. |
| Plan-031/032 regression via shared module edit | Strictly additive change — no modification of `detectProjectLanguage`, `getToolchain`, `detectProjectProfile`, `detectSkannerProfile`. Step 1.3 regression sweep + Phase 4.1 full vitest run are double gates. |

### Verification

**Mechanical**:
- `npx vitest run` → baseline + 22 PASS.
- `npx tsc --noEmit` → 0 errors.
- `npx eslint scripts/lib/detect-project-language.ts tests/lib/diff-scope-detection.test.ts` → 0 errors.
- `/medik` Check #8 (agent frontmatter linter) → unaffected (no agent file touched).
- `/medik` Check #14 (capability-alignment) → unaffected (no skill file touched).

**Behavioral**:
- Self-test 1 (docs-only): Phase 1 emits `Diff scope: docs-only` and skips all 4 mechanical checks in <5s; Phase 2a skips all 4 specialists; Phase 2b kody runs anyway; Phase 3 proceeds to commit.
- Self-test 2 (.ts production, no SQL/security): Phase 1 runs all 4; Phase 2a invokes ts-reviewer + skips python-reviewer/spektr/orakle; Phase 2b kody runs.
- Self-test 3 (SQL migration): Phase 2a invokes orakle + skips ts-reviewer/python-reviewer/spektr; Phase 2b kody runs.
- Backward-compat: last 5 historical commits replay against `getDiffScope` shows zero false-skips of a specialist that previously found a real BLOCK.

**Diff hygiene**:
- `git diff --stat main...HEAD` matches the expected 6 paths in Step 4.6.
- Conventional commit message includes `Reviewed: full` footer (per `git-workflow.md`).

### Acceptance Criteria

- [ ] All 6 file modifications complete:
  - [ ] `scripts/lib/detect-project-language.ts` — additive `DiffScope` interface + `getDiffScope` function (no existing export touched)
  - [ ] `tests/lib/diff-scope-detection.test.ts` — NEW, 22/22 PASS (12 mechanical + 10 reviewer-relevance)
  - [ ] `.claude/commands/chekpoint.md` — Phase 1 Step 1.5 + per-step skip logging + Phase 2a conditional invocation + override flags + output format
  - [ ] `.claude/rules/common/development-workflow.md` — "Runtime authority" paragraph after tier table
  - [ ] `docs/decisions/ADR-034-chekpoint-diff-scope-aware.md` — already on disk
  - [ ] `docs/plans/plan-034-chekpoint-phase1-diff-scope.md` — this file
- [ ] New test file passes: 22/22.
- [ ] Existing baseline tests still pass: full vitest run = baseline + 22.
- [ ] `npx tsc --noEmit` → 0 errors.
- [ ] `npx eslint .` → 0 new errors.
- [ ] `/medik` Check #8 frontmatter linter unaffected (clean).
- [ ] `/medik` Check #14 capability-alignment unaffected (clean).
- [ ] Self-test 1 (docs-only): Phase 1 + Phase 2a all-skip in <5s; kody still runs; commit proceeds.
- [ ] Self-test 2 (.ts production): typescript-reviewer-only routing in Phase 2a; kody runs.
- [ ] Self-test 3 (SQL migration): orakle-only routing in Phase 2a; kody runs.
- [ ] Backward-compat: zero false-skips against last 5 historical commits.
- [ ] Invariant #1 (kody always runs) preserved.
- [ ] Invariant #2 (user override flags always available) documented in both `chekpoint.md` and `development-workflow.md`.
- [ ] Invariant #3 (conservative-by-default) asserted in test Block B case 10.
- [ ] Invariant #4 (original Phase 1 design unchanged) preserved — 12 mechanical cases identical to pre-rewrite plan.
- [ ] Invariant #5 (`getDiffScope` is pure) — no `fs.readFileSync` for content; caller passes `fileContents` map.
- [ ] Invariant #6 (no rename, no touching existing exports) — `git diff` on `detect-project-language.ts` shows additive lines only below the existing export block.
- [ ] `git diff --stat` shows only the expected 6 paths (no scope creep).
- [ ] Conventional commit message includes `Reviewed: full` footer.

### Pipeline Contract

- **Input**: ADR-034 (Route A — architecture-touching decision affecting 2 phases of `/chekpoint`).
- **Output (this plan)**: 4 modified files (`scripts/lib/detect-project-language.ts`, `.claude/commands/chekpoint.md`, `.claude/rules/common/development-workflow.md`, this plan), 1 new test file (`tests/lib/diff-scope-detection.test.ts`), 0 new agent/skill files. ADR-034 already on disk.
- **needs_tdd: true** → feniks should drive the red-green-refactor cycle in Phase 1 (test first, then implementation, then regression sweep).
- **Handoff**: feniks for Phase 1 TDD; main session for Phase 2 + Phase 3 doc/spec edits; `/chekpoint full` for the eventual commit (production-source-tree TS file edited → typescript-reviewer + kody at minimum; `getDiffScope` itself will determine the final routing if dogfooded post-merge).
