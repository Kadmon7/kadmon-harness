---
number: 33
title: /medik project-agnostic via runtime profile detection
date: 2026-04-26
status: pending
needs_tdd: true
route: A
adr: ADR-033-medik-project-agnostic.md
---

## Plan: /medik project-agnostic via runtime profile detection [konstruct]

### Overview
Implements ADR-033. Adds runtime profile detection to `/medik` so the command runs cleanly in consumer projects (Kadmon-Sports, ToratNetz, KAIRON), not only inside the harness self-repo. The 5 generic checks (#1–#5) keep working unchanged via ADR-020 language routing; the 8 harness-only checks gate behind a new `profile: 'harness' | 'consumer'` field on `CheckContext` and emit a `NOTE` (not a `FAIL`) when invoked outside the harness. Renames `detectSkannerProfile` → `detectProjectProfile` with a deprecated alias to keep plan-031 callers green.

### Assumptions
- ADR-033 accepted with its 6 risks and the Check #13 re-classification noted in Risk #6 — validated by reading `docs/decisions/ADR-033-medik-project-agnostic.md`.
- Plan directs Check #13 (capability-alignment) to remain **harness-only** in v1.3 per the explicit instruction in the user's task brief, deferring fork-aware mode to v1.4. The ADR Risk #6 mitigation (run when `.claude/skills/` + `.claude/agents/` exist) is acknowledged but explicitly out of scope for v1.3 — validated by user task instruction.
- The `medik-checks` module pattern is established for checks #10–#14 only. Checks #1–#9 are inline in `.claude/commands/medik.md` and run via the language-aware ADR-020 toolchain — validated by reading `.claude/commands/medik.md` and `scripts/lib/medik-checks/*.ts`.
- `CheckContext` lives at `scripts/lib/medik-checks/types.ts` with shape `{ projectHash: string; cwd: string }` — validated by reading the file (lines 10–13).
- Plan-028 Phase 4/5 has merged (5 module-per-check files exist on disk). Risk #5 from ADR-033 (collision) is therefore retired — validated via `Glob scripts/lib/medik-checks/*.ts`.
- `detectSkannerProfile` returns `'harness' | 'web' | 'cli'`. The `/medik` adapter collapses `web | cli` → `consumer` at the call site — validated by reading `scripts/lib/detect-project-language.ts` lines 120–257.
- `process.cwd()` (not `KADMON_RUNTIME_ROOT`) is the correct cwd input for profile detection per ADR-010 (plugin path resolution): `KADMON_RUNTIME_ROOT` points at the plugin cache, not the consumer workspace — validated by reading `CLAUDE.md` "Plugin-Mode Runtime Resolution" rule and ADR-033 reference list.
- `mkdtempSync` fixture pattern works for medik-check tests; this is what the existing `tests/lib/medik-checks/*.test.ts` files already use — validated by listing existing test files and reading the skanner-profile-detection test header (lines 30–60).

### Phase 0: Research (read-only)

- [ ] Step 0.1: Read ADR-033 in full and confirm Risk #6 (capability-alignment re-classification) is acknowledged but **deferred** to v1.4 per user task brief (S)
  - File: `docs/decisions/ADR-033-medik-project-agnostic.md`
  - Verify: ADR text confirms Check #13 should run in any project with `.claude/skills/` and `.claude/agents/`; plan deviates by simpler harness-only gate. Document deviation in Phase 1 Step 1.0 of this plan.
  - Depends on: none
  - Risk: Low

- [ ] Step 0.2: Read `scripts/lib/detect-project-language.ts` to confirm `detectSkannerProfile` signature, marker priority, and stderr diagnostic format (S)
  - File: `scripts/lib/detect-project-language.ts`
  - Verify: function returns `'harness' | 'web' | 'cli'`; explicit arg > env > markers > fallback `web`; stderr diagnostic has shape `{ source, profile, markers }`.
  - Depends on: none
  - Risk: Low

- [ ] Step 0.3: Read `scripts/lib/medik-checks/types.ts` and the 5 module-per-check files to confirm current `runCheck(ctx: CheckContext)` shape (S)
  - File: `scripts/lib/medik-checks/{types.ts, capability-alignment.ts, hook-health-24h.ts, instinct-decay-candidates.ts, skill-creator-probe.ts, stale-plans.ts}`
  - Verify: every `runCheck` consumes `ctx.cwd` and/or `ctx.projectHash`; none reads `ctx.profile` today.
  - Depends on: none
  - Risk: Low

- [ ] Step 0.4: Read `tests/eval/skanner-profile-detection.test.ts` header for `mkdtempSync` fixture pattern + stderr-spy idiom (S)
  - File: `tests/eval/skanner-profile-detection.test.ts`
  - Verify: pattern uses `vi.spyOn(process.stderr, "write")` + per-test `tmpDir` cleanup; reuse verbatim in new test file.
  - Depends on: none
  - Risk: Low

### Phase 1: Detection refactor + rename (TDD-flavored)

- [ ] Step 1.0: Document Check #13 scope decision (S)
  - File: this plan, "Assumptions" section above (already documented)
  - Verify: assumption explicitly states v1.3 keeps Check #13 harness-only; v1.4 fork-aware mode out of scope.
  - Depends on: 0.1
  - Risk: Low

- [ ] Step 1.1: Extend `tests/eval/skanner-profile-detection.test.ts` with 1 new case proving the deprecated alias works (RED) (S)
  - File: `tests/eval/skanner-profile-detection.test.ts`
  - Verify: new test imports `detectSkannerProfile` and asserts it equals `detectProjectProfile` (referential or behavioral equality). Test FAILS until 1.2 lands.
  - Depends on: 0.2, 0.4
  - Risk: Low

- [ ] Step 1.2: Rename `detectSkannerProfile` → `detectProjectProfile`; export deprecated alias (M)
  - File: `scripts/lib/detect-project-language.ts`
  - Implementation:
    - Rename the function declaration to `detectProjectProfile` (signature unchanged).
    - Export `export const detectSkannerProfile = detectProjectProfile;` with JSDoc `@deprecated Use detectProjectProfile. Removed in v1.4.`.
    - Rename `SkannerProfile` type → `ProjectProfile`; export `export type SkannerProfile = ProjectProfile;` deprecated alias.
    - Update file header comment to reflect dual-name export.
  - Verify: `npx tsc --noEmit` clean; Step 1.1 test PASS; existing `tests/eval/skanner-profile-detection.test.ts` cases still PASS.
  - Depends on: 1.1
  - Risk: Medium — touches a hot module; mitigation = aliases preserve public API

- [ ] Step 1.3: Add a `MedikProfile = 'harness' | 'consumer'` adapter in `detect-project-language.ts` (S)
  - File: `scripts/lib/detect-project-language.ts`
  - Implementation: new exported function `detectMedikProfile(cwd?: string, explicitArg?: string): MedikProfile` that calls `detectProjectProfile(cwd, explicitArg)` and collapses `web | cli` → `consumer`. Honors `KADMON_MEDIK_PROFILE` env var (precedence: arg > `KADMON_MEDIK_PROFILE` > underlying `detectProjectProfile`). Emits one stderr diagnostic line `{ source, profile, markers }` matching ADR-031 contract.
  - Verify: returns `'harness'` for harness markers; returns `'consumer'` for any web/cli/fallback case; `KADMON_MEDIK_PROFILE=harness` overrides marker scan.
  - Depends on: 1.2
  - Risk: Low

### Phase 2: CheckContext extension + check guards (TDD-flavored)

- [ ] Step 2.1: Write failing tests in `tests/lib/medik-profile-detection.test.ts` (RED) (M)
  - File: `tests/lib/medik-profile-detection.test.ts` (NEW)
  - Test cases (10):
    1. `detectMedikProfile(harnessTmpDir)` → `'harness'`
    2. `detectMedikProfile(webTmpDir)` → `'consumer'` (collapse from `web`)
    3. `detectMedikProfile(cliTmpDir)` → `'consumer'` (collapse from `cli`)
    4. `KADMON_MEDIK_PROFILE=harness` overrides web markers
    5. `KADMON_MEDIK_PROFILE=consumer` overrides harness markers
    6. Explicit arg `harness` beats env var `consumer`
    7. Each of 8 harness-only checks (`hook-health-24h`, `instinct-decay-candidates`, `skill-creator-probe`, `capability-alignment` + 4 inline guards via integration adapter — see Step 2.4) returns `status: 'NOTE'` with `message` containing `"requires harness profile"` when `ctx.profile === 'consumer'`
    8. Each of those 8 checks runs as before when `ctx.profile === 'harness'` (unchanged status / message)
    9. `stale-plans` runs in `consumer` profile if `docs/plans/` exists; returns existing skip-PASS when `docs/plans/` absent (regardless of profile)
    10. Backward compat: `detectSkannerProfile` import still resolves (re-asserted here for full coverage)
  - Use `mkdtempSync` fixture pattern from `tests/eval/skanner-profile-detection.test.ts` (Phase 0 Step 0.4).
  - Verify: all 10 cases FAIL until 2.2–2.4 land.
  - Depends on: 1.3
  - Risk: Medium — multi-fixture setup; mitigation = small helper functions like the skanner test

- [ ] Step 2.2: Extend `CheckContext` with `profile` field (S)
  - File: `scripts/lib/medik-checks/types.ts`
  - Implementation: add `profile: 'harness' | 'consumer'` after `cwd`. Reuse the `MedikProfile` type via `import type { MedikProfile } from "../detect-project-language.js"` (or inline the union — pick whichever keeps the type file zero-runtime).
  - Verify: `npx tsc --noEmit` clean across the 5 existing checks (they ignore the new field, so they keep compiling).
  - Depends on: 2.1
  - Risk: Low

- [ ] Step 2.3: Add profile guards to the 4 module-per-check files that should be harness-only (M)
  - Files (4):
    - `scripts/lib/medik-checks/hook-health-24h.ts`
    - `scripts/lib/medik-checks/instinct-decay-candidates.ts`
    - `scripts/lib/medik-checks/skill-creator-probe.ts`
    - `scripts/lib/medik-checks/capability-alignment.ts`
  - Implementation: at the top of each `runCheck`, before any DB / fs work:
    ```typescript
    if (ctx.profile !== 'harness') {
      return {
        status: 'NOTE',
        category: '<existing-category>',
        message: '<check-name> requires harness profile — skipped in consumer'
      };
    }
    ```
    Preserve each file's existing `category` value (e.g. `runtime` for hook-health-24h, `knowledge-hygiene` for capability-alignment when no runtime kinds present — defer to existing default).
  - Verify: each file's existing test suite still PASSES when run with `ctx.profile = 'harness'`; new test cases from 2.1 PASS for `ctx.profile = 'consumer'`.
  - Depends on: 2.2
  - Risk: Medium — must not regress existing per-check tests; mitigation = guard added BEFORE existing logic, no other edits

- [ ] Step 2.4: Update `stale-plans.ts` to keep its current docs/plans-existence skip (no profile gate) (S)
  - File: `scripts/lib/medik-checks/stale-plans.ts`
  - Implementation: NO change required — current code already returns `status: 'PASS'` with `message: 'No stale pending plans'` when `docs/plans/` missing. Confirm this is what we want for consumer profile (run in any profile, skip when no plans dir).
  - Verify: read existing stale-plans.ts confirms the existence guard is already in place (lines 35–41). Add a test case (within 2.1's existing 10) confirming consumer profile + missing `docs/plans/` → PASS, harness profile + present `docs/plans/` → existing behavior.
  - Depends on: 2.2
  - Risk: Low

- [ ] Step 2.5: For inline checks #6, #7, #8, #11, #12 in `.claude/commands/medik.md` — these are not module-per-check files. Decide & document gating strategy (M)
  - File: `.claude/commands/medik.md` (read-only here, edit in Step 3.1)
  - Decision: inline checks are gated by the runtime wiring step (3.2) which inspects the detected profile and skips invocation entirely (does NOT add per-check guards inside the command markdown).
  - Verify: this plan documents the inline-vs-module split: 4 modules guarded inside `runCheck`, 5 inline checks gated at the command level by runtime wiring.
  - Depends on: 2.3
  - Risk: Low

### Phase 3: Command + runtime wiring

- [ ] Step 3.1: Update `.claude/commands/medik.md` with profile detection + Arguments section (M)
  - File: `.claude/commands/medik.md`
  - Implementation:
    - Add a new `## Arguments` section between frontmatter and `## Purpose`: documents `harness | consumer` override (or `KADMON_MEDIK_PROFILE` env var) and the precedence rule from ADR-033.
    - Modify Phase 0 to:
      1. Detect `--ALV` (existing behavior preserved).
      2. Detect profile via `detectMedikProfile(process.cwd(), $ARGUMENTS)` and emit `Detected: <profile> (source: markers|env|arg)` as the first runtime output line, matching ADR-031.
    - In Phase 1, add a paragraph above the check table: "When `profile === 'consumer'`, checks #6, #7, #8, #11, #12, #13, #14 are skipped with a NOTE; checks #1–#5, #9, #10 run normally per their language-aware logic."
    - Renumber the post-table notes if needed; keep the example output current.
    - **The 14-check table itself stays identical** — only the surrounding prose + Phase 0 detection change.
  - Verify: `/medik` Check #14 (capability-alignment) still PASSes against the edited command markdown (no frontmatter drift, no ownership drift).
  - Depends on: 2.5
  - Risk: Medium — markdown edits to a hot command; mitigation = run Check #14 immediately after edit

- [ ] Step 3.2: Wire profile detection into runtime CheckContext construction (M)
  - File: `scripts/lib/medik-checks/types.ts` (already extended in 2.2). The actual orchestration of `CheckContext` happens in the inline `npx tsx -e "..."` blocks inside `.claude/commands/medik.md`. Therefore: introduce a thin helper `scripts/lib/medik-checks/run-with-profile.ts` (NEW) that exports `buildCheckContext(cwd: string, explicitArg?: string): CheckContext`. The helper calls `detectMedikProfile`, builds `{ projectHash, cwd, profile }`, and returns it.
  - Update `.claude/commands/medik.md` Phase 1 invocation snippets for checks #11, #12, #13, #14 to use the helper:
    ```bash
    npx tsx -e "
    import('./scripts/lib/medik-checks/run-with-profile.js').then(async (rwp) => {
      const ctx = rwp.buildCheckContext(process.cwd(), process.env.KADMON_MEDIK_PROFILE_ARG);
      const m = await import('./scripts/lib/medik-checks/<check>.js');
      const r = m.runCheck(ctx);
      console.log(JSON.stringify(r, null, 2));
      process.exit(r.status === 'FAIL' ? 1 : 0);
    });
    "
    ```
    For inline checks #6, #7, #8 (no module file), the command runs detection at the top of Phase 1 and conditionally skips the check block when `profile !== 'harness'`, printing the NOTE message inline.
  - Verify: harness self-test → 14 checks invoked; consumer self-test → 5 generic checks + #10 stale-plans + 8 NOTE-skipped.
  - Depends on: 3.1
  - Risk: Medium — orchestration changes; mitigation = manual harness self-test + consumer dogfood are both verification steps in Phase 4

### Phase 4: Verification

- [ ] Step 4.1: Run mechanical verification (S)
  - Verify:
    - `npx vitest run` → all existing 1069 tests + 10 new = 1079 PASS
    - `npx tsc --noEmit` → 0 errors
    - `npx eslint .` → 0 new issues
  - Depends on: 3.2
  - Risk: Low

- [ ] Step 4.2: Run `/medik` Check #14 (capability-alignment) on the edited command markdown + new helper file (S)
  - Verify: Check #14 PASSes — `medik.md` frontmatter clean, `run-with-profile.ts` doesn't introduce orphan-skill or capability-mismatch.
  - Depends on: 4.1
  - Risk: Low

- [ ] Step 4.3: Manual harness self-test (M)
  - Run: `/medik` from `C:\Command-Center\Kadmon-Harness`
  - Verify:
    - First line of output is `Detected: harness (source: markers)`
    - All 14 checks run (no NOTE-skips for profile reason)
    - Pass/fail counts match pre-refactor baseline (capture baseline before Step 1.2 lands; diff after Step 3.2)
  - Depends on: 4.2
  - Risk: Medium — primary acceptance test for ADR-033 Risk #2 (harness self-test breakage); mitigation = pre/post diff

- [ ] Step 4.4: Manual consumer dogfood (M)
  - Setup: create or reuse `/tmp/scratch-web` with `package.json` (no harness markers, has `react` dependency).
  - Run: `cd /tmp/scratch-web && /medik`
  - Verify:
    - First line is `Detected: consumer (source: markers)`
    - Checks #1–#5 run language-aware against the consumer's `npm`/`vitest`/etc.
    - Check #10 stale-plans either runs (if `docs/plans/` present) or skips with the existing "No stale pending plans" PASS.
    - Checks #6, #7, #8, #11, #12, #13, #14 each emit NOTE with `"requires harness profile — skipped"` text.
  - Depends on: 4.3
  - Risk: Medium — first time `/medik` ships into a consumer; mitigation = NOTE not FAIL means worst case is noise, not breakage

- [ ] Step 4.5: Backward-compat sanity check (S)
  - Run: `npx vitest run tests/eval/skanner-profile-detection.test.ts`
  - Verify: pre-existing 12 cases still PASS via the deprecated alias; new alias-equality case from Step 1.1 also PASSes.
  - Depends on: 4.4
  - Risk: Low

- [ ] Step 4.6: `git diff --stat` review (S)
  - Verify: only expected paths changed:
    - `scripts/lib/detect-project-language.ts` (rename + alias + new `detectMedikProfile` + new `MedikProfile` type)
    - `scripts/lib/medik-checks/types.ts` (CheckContext extended)
    - `scripts/lib/medik-checks/{hook-health-24h,instinct-decay-candidates,skill-creator-probe,capability-alignment}.ts` (4 profile guards)
    - `scripts/lib/medik-checks/run-with-profile.ts` (NEW helper)
    - `.claude/commands/medik.md` (Arguments section + Phase 0 detection + Phase 1 invocation snippets)
    - `tests/lib/medik-profile-detection.test.ts` (NEW, 10 cases)
    - `tests/eval/skanner-profile-detection.test.ts` (1 new alias-equality case)
  - No drift into kody, /chekpoint, /doks, agents/, skills/, hooks/.
  - Depends on: 4.5
  - Risk: Low

### Test Plan (TDD targets)

**RED phase first** (test written before implementation, every time):

| Test | When written | Expected RED reason | Resolves at |
|------|--------------|---------------------|-------------|
| `tests/eval/skanner-profile-detection.test.ts` (1 new alias case) | Step 1.1 | `detectSkannerProfile === detectProjectProfile` reference fails — `detectProjectProfile` doesn't exist yet | Step 1.2 |
| `tests/lib/medik-profile-detection.test.ts` (10 cases) | Step 2.1 | `detectMedikProfile` doesn't exist; `ctx.profile` not in `CheckContext`; checks don't honor profile | Steps 1.3, 2.2, 2.3, 2.4 |

**Existing suites stay GREEN throughout**:
- `tests/lib/medik-checks/*.test.ts` (5 files) — verify each still passes after Step 2.3 adds the guard. Existing tests use `ctx.profile` undefined OR add it explicitly to fixtures (fix per-test if needed; preferably keep `profile: 'harness'` in fixtures so the guard never trips during the existing happy path).
- `tests/eval/skanner-profile-detection.test.ts` (12 existing) — verify still passes after Step 1.2 rename via deprecated alias.

**Coverage target**: 100% of new lines in `detect-project-language.ts` (`detectMedikProfile` + `MedikProfile` type), 100% of new guard lines in 4 check modules, 100% of `run-with-profile.ts`.

### Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Harness self-test regression after rename (ADR-033 Risk #2) | High | Step 4.3 captures pre-refactor baseline output, diffs against post-refactor output. Any divergence = blocker. |
| Plan-031 callers (kartograf, arkonte) break on rename | Medium | Deprecated alias `detectSkannerProfile` retained until v1.4 (ADR-033 §Decision). Step 4.5 explicitly tests alias resolution. |
| Misdetection in monorepos (ADR-033 Risk #1) | Medium | `KADMON_MEDIK_PROFILE` env var + explicit arg always beat marker scan. `Detected: <profile> (source: ...)` first-line output is auditable. Same mitigation as ADR-031 → already proven in plan-031. |
| Existing `medik-checks` tests have fixtures missing `profile` field | Medium | Step 2.3 adds the guard at the top, but each file's existing test must pass `profile: 'harness'` in its CheckContext fixture. Step 2.3 sub-task: audit each test file and add `profile: 'harness'` to fixtures if absent (compile-time error after 2.2 makes this self-locating). |
| Inline checks #6, #7, #8 in command markdown can't have a runtime guard | Medium | Step 3.2 gates them at command-orchestration level: detect profile in Phase 0, conditionally skip the inline block in Phase 1, print NOTE text directly. Dogfood verifies (4.4). |
| Check #13 (capability-alignment) gated harness-only diverges from ADR-033 Risk #6 mitigation (which proposes "run in any project with `.claude/skills/` + `.claude/agents/`") | Medium | Documented in Assumptions + Step 1.0. v1.3 ships harness-only; v1.4 fork-aware mode opens a follow-up plan. User explicitly approved this scope reduction in task brief. |
| `process.cwd()` ≠ `KADMON_RUNTIME_ROOT` confusion (ADR-010) | Low | `detectMedikProfile` defaults to `process.cwd()`; never reads `KADMON_RUNTIME_ROOT`. Documented in Assumptions and code comment in Step 1.3. |

### Verification

**Mechanical**:
- `npx vitest run` → 1069 (existing) + 10 (new medik-profile) + 1 (new skanner alias case) = 1080 PASS
- `npx tsc --noEmit` → 0 errors
- `npx eslint .` → no new issues
- `/medik` Check #8 (frontmatter linter) → PASS (no agent files changed)
- `/medik` Check #14 (capability-alignment) → PASS for the refactor itself

**Manual**:
- Harness self-test: `/medik` from harness root → first line `Detected: harness`, 14 checks invoked, output diff vs pre-refactor baseline = empty (or limited to the new `Detected:` first line)
- Consumer dogfood: `/medik` from `/tmp/scratch-web` → first line `Detected: consumer`, ≤ 6 checks run with PASS/WARN/FAIL, 7-8 checks emit NOTE with `"requires harness profile — skipped"`
- Backward compat: `import { detectSkannerProfile } from "scripts/lib/detect-project-language.js"` resolves to the renamed function via alias; `tests/eval/skanner-profile-detection.test.ts` runs unchanged and PASSes

### Acceptance Criteria

- [ ] All file modifications complete (1 rename in `detect-project-language.ts` + 1 type extension in `types.ts` + 4 module-per-check guards + 1 new helper file `run-with-profile.ts` + 1 command-markdown edit + 1 new test file + 1 new assertion in skanner test)
- [ ] `tests/lib/medik-profile-detection.test.ts` PASS 10/10
- [ ] `tests/eval/skanner-profile-detection.test.ts` PASS 13/13 (12 existing + 1 alias case)
- [ ] Pre-existing 1069 harness tests PASS (no regressions)
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `/medik` Check #8 (frontmatter linter) → PASS
- [ ] `/medik` Check #14 (capability-alignment) → PASS
- [ ] Manual harness self-test → 14 checks invoked, output baseline-stable
- [ ] Manual consumer self-test → ≤ 6 checks invoked, others NOTE-skipped with consistent message
- [ ] `detectSkannerProfile` deprecated alias still resolves and works in plan-031 callers
- [ ] `git diff --stat` shows only the 7 expected paths — no kody scope creep, no /doks scope creep (that's plan-034)
