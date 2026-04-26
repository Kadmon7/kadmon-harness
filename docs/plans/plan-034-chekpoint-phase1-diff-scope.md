---
number: 34
title: /chekpoint Phase 1 diff-scope optimization
date: 2026-04-26
status: pending
needs_tdd: true
route: B
adr: none
---

## Plan: /chekpoint Phase 1 diff-scope optimization [konstruct]

### Overview
`/chekpoint` Phase 1 currently runs build + typecheck + 1069 tests + lint unconditionally for every tier. For docs-only or config-only commits this wastes ~90s wall time and ~3% of the rate-limit budget on irrelevant work. This plan adds a `getDiffScope(stagedFiles)` helper to `scripts/lib/detect-project-language.ts` that returns four boolean gates plus a human-readable rationale, and rewires Phase 1 to honor those gates while logging a clear "skipped" line per omitted check. Pattern follows plan-031's `detectSkannerProfile` (filesystem-marker → typed result, additive export only).

### Assumptions
- Validated by reading `scripts/lib/detect-project-language.ts`: existing exports (`detectProjectLanguage`, `getToolchain`, `detectSkannerProfile`) are the contract callers depend on; the new function is additive and must not modify them.
- Validated by reading `.claude/commands/chekpoint.md`: Phase 1 currently has 3 explicit steps (Step 1 detect toolchain, Step 2 run 4 checks, Step 3 stop on first failure); the diff-scope check belongs between Step 1 and Step 2 as a new "Step 1.5".
- Validated by `Glob` over `docs/plans/plan-03*.md`: next free plan number is 034 (031, 032, 033 already exist).
- Tier semantics (full/lite/skip) remain unchanged — diff-scope is an *orthogonal* optimization that runs inside Phase 1 of all three tiers. The user-facing `Reviewed: <tier>` footer is unaffected.
- Test files in `tests/` only need typecheck + run + lint; they do not require a fresh `npm run build` because Vitest compiles on demand via `tsx` / `esbuild`. This matches the existing `lite` tier behavior in `development-workflow.md`.
- "Pure config" rule treats `package.json` / `tsconfig.json` / `eslint*` / `pyproject.toml` / `requirements.txt` / `.gitignore` as build-affecting → keep build/typecheck/lint, drop tests. A config change can break the build but cannot change runtime behavior of tests that don't touch it.
- Windows path handling: callers may pass `\` or `/` separators. The helper must normalize before extension/substring matching.

### Phase 0: Research
- [ ] Step 0.1: Confirm current Phase 1 spec wording in `.claude/commands/chekpoint.md` lines 32-53 (read-only). (S)
  - File: `.claude/commands/chekpoint.md`
  - Verify: Phase 1 has exactly 3 steps + a "Missing Python tooling" note; rewrite target is the table at lines 44-49 + Step 2 paragraph at line 42.
- [ ] Step 0.2: Confirm `detect-project-language.ts` public surface and the `detectSkannerProfile` pattern. (S)
  - File: `scripts/lib/detect-project-language.ts`
  - Verify: Identify reusable helpers (`safeExists`, `isProjectLanguage` style of typed whitelist) and the stderr-diagnostic JSON convention (lines 76, 106, 162, etc.) — new function should NOT emit stderr (it is a pure helper, not a detector with env-override path).
- [ ] Step 0.3: Locate plan-031 test pattern as a template. (S)
  - File: `tests/lib/skanner-profile-detection.test.ts` (or whichever file plan-031 created — search `tests/lib/` for `detectSkannerProfile`)
  - Verify: Copy the harness style (Vitest `describe` / `it` / `expect`, no I/O, pure function inputs).

### Phase 1: Detection helper (TDD)
- [ ] Step 1.1: RED — write failing test file `tests/lib/diff-scope-detection.test.ts` covering all 12 cases below. (M)
  - File: `tests/lib/diff-scope-detection.test.ts` (NEW)
  - Verify: `npx vitest run tests/lib/diff-scope-detection.test.ts` fails because `getDiffScope` does not yet exist (import error or undefined).
  - Depends on: Phase 0 complete
  - Risk: Low
- [ ] Step 1.2: GREEN — add `DiffScope` interface and `getDiffScope(stagedFiles: string[]): DiffScope` to `scripts/lib/detect-project-language.ts` (additive only). (M)
  - File: `scripts/lib/detect-project-language.ts`
  - Verify: `npx vitest run tests/lib/diff-scope-detection.test.ts` shows 12/12 green.
  - Depends on: 1.1
  - Risk: Medium — Windows path normalization is the most likely regression source. Use `path.normalize` then `.replace(/\\/g, '/')` before substring/extension checks. Use `path.extname` for extension; do not rely on raw string suffix.
- [ ] Step 1.3: Regression — confirm existing `detectProjectLanguage`, `getToolchain`, `detectSkannerProfile` tests still pass. (S)
  - File: existing test files in `tests/lib/` matching `detect-project-language` and `skanner-profile-detection`
  - Verify: `npx vitest run tests/lib/` shows full suite green; no existing test is touched.
  - Depends on: 1.2
  - Risk: Low — additive change only; if any existing test breaks, the new export accidentally clashed with an existing name.

### Phase 2: Phase 1 spec update
- [ ] Step 2.1: Update `.claude/commands/chekpoint.md` Phase 1 to call `getDiffScope` between Step 1 and Step 2, and add per-step skip logging. (M)
  - File: `.claude/commands/chekpoint.md`
  - Verify: Phase 1 now has 4 steps (detect toolchain → detect diff scope → run 4 checks honoring scope → stop on first failure). The table at lines 44-49 gains a "Skip if" column referencing the scope gates. The text says: "Always emit one line at the start of Phase 1: `Diff scope: <rationale>`. For each of the 4 checks, if the corresponding scope gate is `false`, log `(skipped: <rationale>)` instead of running the command."
  - Depends on: Phase 1 complete
  - Risk: Low — documentation-only change to a command file. /medik Check #8 (agent frontmatter) does not lint command frontmatter.

### Phase 3: Verification
- [ ] Step 3.1: Run full Vitest suite. (S)
  - File: n/a
  - Verify: `npx vitest run` — all tests green (1069 + 12 new = 1081, give or take baseline drift).
  - Depends on: Phase 2 complete
  - Risk: Low
- [ ] Step 3.2: Run TypeScript compilation. (S)
  - File: n/a
  - Verify: `npx tsc --noEmit` — 0 errors.
  - Depends on: 3.1
  - Risk: Low — `DiffScope` interface is exported from a file that compiles cleanly today; only risk is forgetting `export` keyword.
- [ ] Step 3.3: Run ESLint over the touched source file. (S)
  - File: n/a
  - Verify: `npx eslint scripts/lib/detect-project-language.ts tests/lib/diff-scope-detection.test.ts` — clean.
  - Depends on: 3.2
  - Risk: Low
- [ ] Step 3.4: Manual smoke — docs-only diff. (S)
  - File: n/a (manual)
  - Verify: Stage a single `*.md` file, invoke `/chekpoint` (skip tier), confirm Phase 1 output shows `Diff scope: docs-only` and reports `(skipped: docs-only)` for all 4 mechanical steps in <5 seconds.
  - Depends on: 3.3
  - Risk: Medium — first end-to-end exercise of the spec. If `/chekpoint` invocation drives a different code path than the spec describes, this surfaces it.
- [ ] Step 3.5: Manual smoke — TS edit diff (regression). (S)
  - File: n/a (manual)
  - Verify: Stage a tiny `scripts/lib/*.ts` no-op edit, invoke `/chekpoint` (full tier), confirm Phase 1 runs all 4 mechanical steps as before with no "skipped" lines. Wall time should match current baseline.
  - Depends on: 3.4
  - Risk: Low — confirms the safe-default ("any code → all true") branch.

### Test Plan (12 TDD cases)

All cases live in `tests/lib/diff-scope-detection.test.ts` and exercise `getDiffScope(stagedFiles)` as a pure function with no filesystem I/O.

| # | Input | Expected `build` | Expected `typecheck` | Expected `tests` | Expected `lint` | Expected `rationale` substring |
|---|-------|------------------|----------------------|------------------|-----------------|--------------------------------|
| 1 | `[]` | false | false | false | false | "empty diff" |
| 2 | `["docs/plans/plan-034.md", "README.md"]` | false | false | false | false | "docs-only" |
| 3 | `["package.json"]` | true | true | false | true | "config-only" |
| 4 | `["tsconfig.json"]` | true | true | false | true | "config-only" |
| 5 | `["pyproject.toml"]` | true | true | false | true | "config-only" |
| 6 | `[".gitignore"]` | true | true | false | true | "config-only" |
| 7 | `["tests/lib/foo.test.ts"]` | false | true | true | true | "test-only" |
| 8 | `["tests/test_bar.py"]` | false | true | true | true | "test-only" |
| 9 | `["scripts/lib/foo.ts"]` | true | true | true | true | "code present" or similar |
| 10 | `["docs/plans/plan-034.md", "scripts/lib/foo.ts"]` | true | true | true | true | "code present" |
| 11 | `["assets/blob.foo"]` | true | true | true | true | "unknown extension" or "safe default" |
| 12 | `["package.json", "scripts/lib/foo.ts"]` | true | true | true | true | "code present" |

Edge-case sub-tests inside the same file (no extra cases needed):
- Windows-style paths: `["scripts\\lib\\foo.ts"]` → same result as case 9 (path normalization).
- Mixed separators: `["docs/foo.md", "scripts\\lib\\bar.ts"]` → same result as case 10.

### Decision Rules (for getDiffScope implementation reference)

Top wins (matches spec from prompt):
1. `stagedFiles.length === 0` → all false, rationale `"empty diff"`.
2. Every entry ends in `.md` → all false, rationale `"docs-only"`.
3. Every entry is in `CONFIG_FILES = {package.json, tsconfig.json, pyproject.toml, requirements.txt, .gitignore}` OR matches `eslint*` glob → `{build:true, typecheck:true, tests:false, lint:true}`, rationale `"config-only — running build/typecheck/lint, skipping tests"`.
4. Every entry matches `^tests/.+\.(test|spec)\.[jt]sx?$` OR `tests/.*test_.*\.py$` OR `tests/.*_test\.py$` → `{build:false, typecheck:true, tests:true, lint:true}`, rationale `"test-only"`.
5. Any code extension present (`.ts/.tsx/.js/.jsx/.py`) → all true, rationale `"code present"`.
6. Otherwise (unknown extensions only) → all true (safe default), rationale `"unknown extension — running full verification as safe default"`.

Implementation note: rules 2-4 require *all* entries to match the predicate (`every`), not *any*. Rule 5 fires if *any* entry is a code extension.

### Risks & Mitigations

- **Risk: false skip lets through a bad commit.** Example: a commit that "looks like" config (only `package.json`) but actually adds a new dependency that breaks the build. → **Mitigation**: rule 3 keeps `build:true` and `typecheck:true` for config; only `tests` is dropped. Plus the rationale is always logged so the user can see what was skipped and why. Tier override (`"chekpoint full"`) remains available.
- **Risk: edge case — file in `tests/` directory but it's actually production code (e.g. a test helper that exports a fixture used by production).** → **Mitigation**: the rule 4 regex requires the filename itself to match `*.test.ts` / `*_test.py` etc., not merely sit under `tests/`. A `tests/fixtures/foo.ts` file would match rule 5 (code present) and force all true.
- **Risk: Windows path separators break extension/substring matching.** `path.extname` works on both `\` and `/` for the basename, but substring checks like `startsWith("tests/")` will miss `tests\foo.test.ts`. → **Mitigation**: normalize every input path with `p.replace(/\\/g, '/')` before any predicate. Add Windows-path tests as edge-case sub-tests in case 9 / 10.
- **Risk: plan-031/032 regression.** `detectSkannerProfile`, `detectProjectLanguage`, `getToolchain` are heavily depended upon. → **Mitigation**: change is additive — new export only, no modification of existing functions or shared helpers. Phase 3 Step 1.3 explicitly runs the existing test suite to catch any accidental name clash or import-cycle.
- **Risk: spec drift between `chekpoint.md` and rules table in `development-workflow.md`.** The tier matrix at `rules/common/development-workflow.md` already governs `full/lite/skip`; this change adds an orthogonal axis. → **Mitigation**: Phase 2 wording explicitly states diff-scope is *inside* Phase 1 and runs for *all three* tiers. No edit to `development-workflow.md` is needed because tier semantics are unchanged.
- **Risk: rate-limit accounting.** The "saves ~3%" claim assumes `vitest run` is the dominant cost in Phase 1. → **Mitigation**: claim is informational, not a Phase 3 acceptance criterion. Acceptance is "skipped lines appear in <5s for docs-only" which is verifiable and tighter.

### Verification

- `npx vitest run tests/lib/diff-scope-detection.test.ts` → 12/12 green
- `npx vitest run` → 1081/1081 green (or current baseline + 12)
- `npx tsc --noEmit` → 0 errors
- `npx eslint scripts/lib/detect-project-language.ts tests/lib/diff-scope-detection.test.ts` → clean
- `/medik` Check #8 (agent frontmatter) → unaffected (no agent file touched)
- `/medik` Check #14 (capability-alignment) → unaffected (no skill file touched)
- Manual smoke 1: docs-only commit → all 4 mechanical steps log `(skipped: docs-only)` in <5s
- Manual smoke 2: TS edit commit → all 4 mechanical steps run; wall time ≈ current baseline

### Acceptance Criteria

- [ ] `scripts/lib/detect-project-language.ts` exports `DiffScope` interface (build/typecheck/tests/lint/rationale fields) and `getDiffScope(stagedFiles: string[]): DiffScope` function — additive, no existing export modified.
- [ ] `tests/lib/diff-scope-detection.test.ts` exists with all 12 cases passing.
- [ ] `.claude/commands/chekpoint.md` Phase 1 description mentions diff-scope detection and per-step skip logging, with rationale always emitted.
- [ ] All existing tests still pass (no regression in detectProjectLanguage / getToolchain / detectSkannerProfile suites).
- [ ] `npx tsc --noEmit` reports 0 errors.
- [ ] `npx eslint` reports clean on the two touched files.
- [ ] Manual smoke 1: docs-only `/chekpoint` invocation completes Phase 1 in <5s with all-skipped output.
- [ ] Manual smoke 2: TS-edit `/chekpoint` invocation completes Phase 1 with no "skipped" lines (no regression).

### Pipeline Contract

- **Input**: this plan (Route B, no ADR per the plan-031 detect-and-branch precedent).
- **Output (this plan)**: 1 modified file (`scripts/lib/detect-project-language.ts`), 1 modified file (`.claude/commands/chekpoint.md`), 1 new test file (`tests/lib/diff-scope-detection.test.ts`).
- **needs_tdd: true** → feniks should drive the red-green-refactor cycle in Phase 1 (test first, then implementation).
- **Handoff**: feniks for Phase 1 TDD; main session for Phase 2 doc edit; `/chekpoint lite (ts-reviewer)` for the eventual commit (single-purpose multi-file, scope-matched reviewer is sufficient).
