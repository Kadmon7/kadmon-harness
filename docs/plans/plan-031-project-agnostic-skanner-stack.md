---
number: 31
title: Project-agnostic /skanner stack via runtime profile detection
date: 2026-04-25
status: completed
needs_tdd: true
route: A
adr: ADR-031-project-agnostic-skanner-stack.md
---

## Plan: Project-agnostic /skanner stack via runtime profile detection [konstruct]

### Overview

Refactor `kartograf`, `arkonte`, and `/skanner` so they detect the consumer project profile (`harness | web | cli`) at runtime and branch their scenarios/budgets accordingly. Reuses the ADR-020 detection module (`scripts/lib/detect-project-language.ts`) and mirrors the `KADMON_PROJECT_LANGUAGE` env-override pattern as `KADMON_SKANNER_PROFILE`. Kody is explicitly out of scope (it remains the `/chekpoint` Phase 2b consolidator). Distribution constraints (ADR-010 plugin + ADR-019 symlinks) must continue to work after the refactor.

### Assumptions

- ADR-031 already accepted and on disk at `docs/decisions/ADR-031-project-agnostic-skanner-stack.md` — validated by direct read.
- `scripts/lib/detect-project-language.ts` is the single owner of marker-based detection — validated by reading the module and its existing 22 tests at `tests/lib/detect-project-language.test.ts`.
- The `KADMON_*` env-override convention is `trim().toLowerCase()` whitelist + diagnostic stderr JSON — mirror it verbatim for the new `KADMON_SKANNER_PROFILE` variable.
- Vitest fixture pattern: tmp dirs via `fs.mkdtempSync` + `os.tmpdir()` is standard for ad-hoc marker fakes (existing `tests/lib/detect-project-language.test.ts` uses checked-in fixtures under `tests/fixtures/`; this plan uses `mkdtempSync` for profile detection because the marker set is larger and tmp dirs avoid polluting the fixtures tree).
- `_TEMPLATE.md.example` does not need a new section in this plan — kartograf and arkonte are the only two profile-aware agents and the pattern is documented in their bodies. A template addendum can be a follow-up if a third profile-aware agent ever ships.

### Phase 0: Research (read-only, no edits)

- [ ] Step 0.1: Read ADR-031 in full (S)
  - File: `docs/decisions/ADR-031-project-agnostic-skanner-stack.md`
  - Verify: ADR Decision section + Risks #1-#5 internalized; profile precedence understood (`arg > env > harness markers > web markers > cli markers > unknown→web`).
  - Depends on: none
  - Risk: Low

- [ ] Step 0.2: Confirm ECC reference clones exist for diff comparison (S)
  - File: `/tmp/everything-claude-code/agents/e2e-runner.md`, `/tmp/everything-claude-code/agents/performance-optimizer.md`
  - Verify: both readable; flag missing reference and proceed without diff if absent (non-blocking).
  - Depends on: 0.1
  - Risk: Low

- [ ] Step 0.3: Confirm /medik Check #8 + Check #14 entry points (S)
  - File: `scripts/lib/lint-agent-frontmatter.ts` + `scripts/lib/medik-checks.ts` (or wherever Check #14 lives — grep for `capability-alignment`)
  - Verify: both checks identified; running them produces clean output today against kartograf and arkonte.
  - Depends on: 0.1
  - Risk: Low

### Phase 1: Detection Infrastructure (TDD foundation)

- [ ] Step 1.1: **TDD RED** — Write profile-detection contract test (M)
  - File: `tests/eval/skanner-profile-detection.test.ts` (NEW)
  - Verify: test file imports `detectSkannerProfile` from `../../scripts/lib/detect-project-language.js` (or sibling module if separation chosen in 1.2); `npx vitest run tests/eval/skanner-profile-detection.test.ts` reports `Cannot find module` or `is not a function` (expected RED).
  - Test cases (minimum 12):
    1. `harness` profile when `scripts/lib/state-store.ts` present
    2. `harness` profile when `hooks/observe-pre.ts` present
    3. `harness` profile when `data/observations.jsonl` present
    4. `web` profile when `package.json` contains `"react"`
    5. `web` profile when `package.json` contains `"next"`
    6. `web` profile when `package.json` contains `"vite"`
    7. `web` profile when `pyproject.toml` contains `fastapi` or `django`
    8. `cli` profile when `package.json` has `bin` field and no UI deps
    9. Unknown → fallback `web` (per ADR-031 precedence)
    10. Override: `KADMON_SKANNER_PROFILE=cli` beats harness markers
    11. Override: explicit arg `harness` beats env `web` (function takes optional explicit override param)
    12. Monorepo conflict: harness markers + web markers → harness wins (precedence per ADR-031 Risk #4)
  - Each case fakes markers via `fs.mkdtempSync(path.join(os.tmpdir(), 'skanner-profile-'))` + `fs.writeFileSync` for marker files; `afterEach` cleans up via `fs.rmSync(dir, { recursive: true, force: true })`.
  - Detection emits stderr JSON `{ source: 'arg'|'env'|'markers', profile, markers: [...] }` — assert via `vi.spyOn(process.stderr, 'write')` mirroring the existing test pattern.
  - Depends on: Phase 0 complete
  - Risk: Medium (test design is the contract — get it wrong here and the implementation drifts)
  - **TDD target: this is the test the GREEN step must satisfy**

- [ ] Step 1.2: **TDD GREEN** — Extend `detect-project-language.ts` with `detectSkannerProfile` (M)
  - File: `scripts/lib/detect-project-language.ts`
  - Verify: `npx vitest run tests/eval/skanner-profile-detection.test.ts` passes 12/12. `npx tsc --noEmit` clean.
  - Implementation contract:
    - New exported type: `export type SkannerProfile = 'harness' | 'web' | 'cli';`
    - New function: `export function detectSkannerProfile(cwd?: string, explicitArg?: string): SkannerProfile`
    - Precedence: explicit arg (validated against whitelist) > `KADMON_SKANNER_PROFILE` env (trim+lowercase+whitelist, mirrors existing `detectProjectLanguage` env handling) > harness markers > web markers > cli markers > fallback `'web'`
    - Harness markers: `safeExists(path.join(cwd, 'scripts/lib/state-store.ts'))` OR `safeExists(path.join(cwd, 'hooks/observe-pre.ts'))` OR `safeExists(path.join(cwd, 'data/observations.jsonl'))` (any one match wins)
    - Web markers: read `package.json` deps (parse safely, ignore on JSON error) and check for `react|next|vite`; OR read `pyproject.toml` text and grep for `fastapi|django`
    - CLI markers: `package.json` has `bin` field, AND none of the web markers matched
    - Stderr diagnostic: `process.stderr.write(JSON.stringify({ source, profile, markers }) + "\n")` exactly mirroring the existing pattern at line 105-107 of the file
  - Cohesion choice: extend `detect-project-language.ts` (do NOT create a sibling module). Rationale: shared `safeExists` + same env-override pattern + same stderr diagnostic shape. ADR-031 left this decision to the implementer; cohesion wins.
  - Depends on: 1.1
  - Risk: Medium (env override validation must reject invalid values silently like existing pattern does for `rust`)

- [ ] Step 1.3: Verify existing `detectProjectLanguage` tests still pass (S)
  - File: `tests/lib/detect-project-language.test.ts` (no changes)
  - Verify: `npx vitest run tests/lib/detect-project-language.test.ts` reports the same 22 tests pass.
  - Depends on: 1.2
  - Risk: Low

### Phase 2: Agent + Command Refactor

- [ ] Step 2.1: Refactor `arkonte.md` description + Expertise (M)
  - File: `.claude/agents/arkonte.md`
  - Verify: line 3 description no longer claims `hook latency` as primary scope; Expertise list (lines 15-22) drops the harness-specific hook latency bullet; description still mentions performance scope generically (Node.js, React, DB).
  - Specific edits:
    - Description: change `"...Covers Node.js, React, DB, and hook latency."` → `"...Covers Node.js, React, DB. Activates harness-mode hook latency budgets when the Kadmon Harness profile is detected."`
    - Expertise bullet line 22: remove `- Claude Code hook latency optimization (observe < 50ms, guard < 100ms, all < 500ms)` from the unconditional list (it moves into a new conditional section in 2.2)
  - Depends on: 1.2 (detection module exists so the agent can reference it)
  - Risk: Low

- [ ] Step 2.2: Add `## Project Detection` + `## Kadmon Harness Mode` sections to arkonte (M)
  - File: `.claude/agents/arkonte.md`
  - Verify: agent body now contains: a `## Project Detection` section near the top (after Expertise) explaining `Detected: <profile>` first-line emit + override mechanics; a new `## Kadmon Harness Mode` heading wrapping the existing Hook Latency Budget table (lines 127-135) AND the sql.js subsection (lines 92-98); both sections are introduced with "Activate ONLY when `Detected: harness`."
  - Specific edits:
    1. Insert new `## Project Detection` section between `## Expertise` and `## Diagnostic Commands` with body:
       ```
       Before any work, emit `Detected: <profile> (source: arg|env|markers)` as the first line of every run. The profile is one of `harness | web | cli`, derived from `scripts/lib/detect-project-language.ts#detectSkannerProfile`. Override precedence: explicit `/skanner` argument > `KADMON_SKANNER_PROFILE` env > marker scan. The remainder of the agent body branches on this value: only the matching profile's section runs.
       ```
    2. Wrap the existing Hook Latency Budget table (lines 127-135) under a new `## Kadmon Harness Mode` heading. Prefix the section with: "Activate ONLY when `Detected: harness`. The budgets and sql.js patterns below are tied to the Kadmon Harness hook taxonomy and SQLite persistence model — do not apply them to web or cli profiles."
    3. Move the sql.js subsection (lines 92-98 under `### sql.js`) into the same `## Kadmon Harness Mode` block (it is harness-specific). The Supabase/PostgreSQL and N+1 subsections remain under unconditional `## Database Performance`.
    4. Replace the line 40 reference `npx tsx scripts/dashboard.ts` with conditional wording: `"In harness profile only: \`npx tsx scripts/dashboard.ts\` for hook health and latency."`
  - Verify: line count increases by ~30-40 lines (220→260 estimate, well under the 400 soft cap).
  - Depends on: 2.1
  - Risk: Medium (large structural edit; section ordering matters for /medik Check #8 frontmatter linter — the linter only inspects frontmatter, but kody review during /chekpoint will scrutinize structure)

- [ ] Step 2.3: Refactor `kartograf.md` description + add `## Project Detection` (M)
  - File: `.claude/agents/kartograf.md`
  - Verify: description line 3 explicitly mentions profile-aware behavior; new `## Project Detection` section appears before `## Test Modes`.
  - Specific edits:
    1. Description: change line 3 to `"Invoked via /skanner command for full workflow tests. Not auto-triggered — E2E tests are expensive and run on demand. Profile-aware: harness (Vitest/pytest), web (Playwright), cli (subprocess + exit-code contracts)."`
    2. Insert new `## Project Detection` section between the opening identity paragraph (line 11) and `## Expertise` (line 13):
       ```
       Before any work, emit `Detected: <profile> (source: arg|env|markers)` as the first line of every run. The profile is one of `harness | web | cli`, derived from `scripts/lib/detect-project-language.ts#detectSkannerProfile`. Override precedence: explicit `/skanner` argument > `KADMON_SKANNER_PROFILE` env > marker scan. Each Test Modes block below activates only when its profile matches.
       ```
  - Depends on: 1.2
  - Risk: Low

- [ ] Step 2.4: Relabel kartograf scenario blocks as conditional + add CLI/Library scenarios (M)
  - File: `.claude/agents/kartograf.md`
  - Verify: existing `## Harness Test Scenarios` (lines 102-107) and `## Web App Test Scenarios` (lines 109-113) are renamed and prefixed with profile activation lines; new `## CLI/Library Test Scenarios` block exists.
  - Specific edits:
    1. Line 102 heading: `## Harness Test Scenarios` → `## Harness Profile Scenarios` and prepend `Activate ONLY when \`Detected: harness\`.` as the first line.
    2. Line 109 heading: `## Web App Test Scenarios` → `## Web Profile Scenarios` and prepend `Activate ONLY when \`Detected: web\`.` as the first line.
    3. Insert new section after Web Profile Scenarios:
       ```markdown
       ## CLI/Library Profile Scenarios
       Activate ONLY when `Detected: cli`.
       1. CLI invocation: `<bin> --help` exits 0; `<bin>` with no args prints usage and exits non-zero
       2. Config load: malformed config file → process exits with documented non-zero code (not a stack trace)
       3. IO contract: stdin → stdout transformation matches documented schema (snapshot test)
       4. Subprocess wrapper: when invoked from a parent harness, exit code propagates correctly
       ```
    4. Add a `### 0. Detect` step at the top of `## Workflow` (before `### 1. Plan`):
       ```
       ### 0. Detect
       Run `detectSkannerProfile()` (or accept the explicit profile from `/skanner <profile>`). Emit `Detected: <profile> (source: ...)` as the first line of output. Skip scenario blocks not matching the detected profile.
       ```
  - Depends on: 2.3
  - Risk: Low

- [ ] Step 2.5: Refactor `/skanner` command — Arguments, Phase 1b, example (M)
  - File: `.claude/commands/skanner.md`
  - Verify: Arguments section (lines 10-15) lists three profile arguments (`harness|web|cli`); Phase 1b body (lines 29-37) replaces hardcoded scenarios with profile-aware delegation to kartograf; example block (lines 62-79) prefixed with `Detected: harness (source: markers)` line.
  - Specific edits:
    1. Arguments section — add new bullets ABOVE the existing arg list:
       ```
       - `harness` — force harness profile (skips marker detection)
       - `web` — force web profile (skips marker detection)
       - `cli` — force cli profile (skips marker detection)
       ```
       Existing args (`perf`, `e2e`, `hooks`, `<agent-name>`) remain. Document precedence: profile arg combines with mode arg (e.g. `/skanner web e2e` = web profile, e2e-only mode).
    2. Phase 1b body (lines 29-37) — replace hardcoded scenario list with:
       ```
       **1b. E2E Workflow Tests (kartograf — sonnet)**
       - Detect profile: `harness | web | cli` (per ADR-031). Emit `Detected: <profile> (source: ...)` as first line.
       - Run profile-matched scenarios from `kartograf.md`:
         - **harness**: session/instinct/hook/no-context-guard/cost-tracking lifecycle (5 scenarios)
         - **web**: auth/search/CRUD/realtime (4 scenarios)
         - **cli**: CLI invocation/config load/IO contract/subprocess wrapper (4 scenarios)
       - Report pass/fail per scenario with timing.
       ```
    3. Phase 1a body (line 26): change `"Benchmark hook latency against budgets..."` to `"In harness profile only: benchmark hook latency against budgets (observe: 50ms, no-context-guard: 100ms, others: 500ms)."`
    4. Example block (line 62): prefix with a new line `Detected: harness (source: markers — state-store.ts, observe-pre.ts found)` so consumers see the contract is honored even in the canonical example.
  - Depends on: 2.2, 2.4
  - Risk: Medium (skanner.md is a command spec — wording must not break existing consumers who run `/skanner perf` or `/skanner kody`)

- [ ] Step 2.6: Update agents catalog rows for kartograf and arkonte (S)
  - File: `.claude/rules/common/agents.md`
  - Verify: catalog table (line 73+) Trigger column for kartograf and arkonte mentions profile awareness; Skills column unchanged (no skill→tool drift).
  - Specific edits:
    - kartograf row Trigger: `/skanner (E2E component)` → `/skanner (E2E component, profile-aware: harness|web|cli)`
    - arkonte row Trigger: `Auto on O(n^2)/slow queries/memory, /skanner` → `Auto on O(n^2)/slow queries/memory, /skanner (profile-aware: harness|web|cli)`
  - Depends on: 2.2, 2.4
  - Risk: Low

### Phase 3: Verification

- [ ] Step 3.1: Run profile-detection contract test (S)
  - Verify: `npx vitest run tests/eval/skanner-profile-detection.test.ts` → 12/12 pass.
  - Depends on: Phase 1 + Phase 2 complete
  - Risk: Low

- [ ] Step 3.2: Run full harness test suite (S)
  - Verify: `npx vitest run` → all 1053 existing tests still pass; new test brings count to 1065 (1053 + 12).
  - Depends on: 3.1
  - Risk: Medium (refactoring `detect-project-language.ts` could regress its 22 existing tests if env-handling is touched carelessly)

- [ ] Step 3.3: TypeScript compile check (S)
  - Verify: `npx tsc --noEmit` → 0 errors.
  - Depends on: 3.1
  - Risk: Low

- [ ] Step 3.4: Run /medik Check #8 (frontmatter linter) on edited agents (S)
  - Verify: `npx tsx scripts/lib/lint-agent-frontmatter.ts` → kartograf.md and arkonte.md pass; no comma-separated `skills:` introduced; no flat-file skill paths.
  - Depends on: 3.1
  - Risk: Low (edits are body-only, no frontmatter touched)

- [ ] Step 3.5: Run /medik Check #14 (capability-alignment) (S)
  - Verify: capability-alignment audit passes. Skills owned by kartograf (`e2e-testing`) and arkonte (`context-budget`, `token-budget-advisor`, `benchmark`) have unchanged `requires_tools:` declarations; agent `tools:` frontmatter unchanged. No drift.
  - Depends on: 3.1
  - Risk: Low

- [ ] Step 3.6: Harness self-test — run /skanner from harness root (M)
  - Verify: `/skanner` from `C:\Command-Center\Kadmon-Harness` → first kartograf line reports `Detected: harness (source: markers)`; runs the 5 lifecycle scenarios; arkonte includes Hook Latency Budget table; no web/cli scenarios attempted.
  - Depends on: 3.2
  - Risk: Medium (this is the canonical regression target — if this breaks, the harness loses its primary E2E surface)

- [ ] Step 3.7: Consumer self-test — scratch web project (M)
  - Setup: `mkdir /tmp/scratch-web && cd /tmp/scratch-web && npm init -y && npm pkg set dependencies.react=^18.0.0`
  - Verify: invoke kartograf manually (or `/skanner` if harness installed via plugin) → first line reports `Detected: web (source: markers — package.json: react)`; attempts auth/search/CRUD/realtime scenarios (will fail because no app, but the scenario set proves correctness); arkonte does NOT print Hook Latency Budget table; sql.js subsection absent.
  - Depends on: 3.6
  - Risk: Medium (proves the agnostic claim; failure here means the plan didn't actually deliver)

- [ ] Step 3.8: Override path test — force harness from web project (S)
  - Verify: in `/tmp/scratch-web`, run `KADMON_SKANNER_PROFILE=harness` invocation → `Detected: harness (source: env)`; runs harness scenarios; emits a warning that harness markers were not found (kartograf/arkonte should surface this — add to the agent body if missing in 2.2/2.4).
  - Depends on: 3.7
  - Risk: Low

- [ ] Step 3.9: Plugin install verification — install harness as plugin in scratch consumer (M)
  - Setup: `cd /tmp/scratch-web && powershell C:\Command-Center\Kadmon-Harness\install.ps1` (or `bash install.sh` if WSL/Git Bash available)
  - Verify: install completes without error; `.claude/` symlinks to harness `agents/`, `skills/`, `commands/` exist; running `/skanner` from `/tmp/scratch-web` still reports `Detected: web` (proves `KADMON_RUNTIME_ROOT` resolution doesn't poison cwd-based marker scan per ADR-031 Risk #3).
  - Depends on: 3.7
  - Risk: High (touches plugin distribution path; mitigation: skip if install scripts unavailable in this environment, but document the manual test for v1.4 release)

### Testing Strategy

- **Unit**:
  - `tests/lib/detect-project-language.test.ts` — existing 22 tests (regression guard for ADR-020 baseline)
  - `tests/eval/skanner-profile-detection.test.ts` — NEW 12 tests covering markers, env override, arg override, monorepo precedence
- **Integration**:
  - Harness self-test (Step 3.6) — `/skanner` from harness root produces correct profile + scenarios
  - Consumer self-test (Step 3.7) — scratch web project produces `web` profile, no harness leakage
  - Override test (Step 3.8) — env var forces profile, agent warns when markers missing
- **E2E**:
  - Plugin install (Step 3.9) — full ADR-010 plugin distribution still functional after refactor
- **TDD targets**: Step 1.1 writes the failing contract test; Step 1.2 implements until green. All 12 cases must pass before any agent body edit (Phase 2) begins.

### Risks & Mitigations

- **Risk: `detect-project-language.ts` regression breaks 22 existing tests** -> Mitigation: extend the file additively (new function `detectSkannerProfile`, new type `SkannerProfile`, new constants) without modifying existing exports. Step 1.3 is a dedicated regression check.
- **Risk: Monorepo with both harness + web markers misdetects (ADR-031 Risk #1)** -> Mitigation: precedence order documented in `detectSkannerProfile` JSDoc; covered by test case #12; env override always wins.
- **Risk: Plugin-mode `KADMON_RUNTIME_ROOT` confuses cwd-based marker scan (ADR-031 Risk #3)** -> Mitigation: `detectSkannerProfile` takes explicit `cwd` param defaulting to `process.cwd()` (NOT `KADMON_RUNTIME_ROOT`). Step 3.9 verifies in plugin install.
- **Risk: Agent body edit drops a section the linter expects** -> Mitigation: Step 3.4 runs Check #8 explicitly; mandatory sections (frontmatter, Output Format, Memory) untouched per the diff scope.
- **Risk: Skanner command argument parsing collision (`harness` vs `<agent-name>`)** -> Mitigation: profile args (`harness|web|cli`) are reserved; if a future agent is named `web`, /skanner `<agent-name>` is the existing fallback for ANY non-profile string. Document precedence in command Arguments section: `/skanner harness|web|cli` is profile force; `/skanner perf|e2e|hooks` is mode; `/skanner <other>` is agent-eval.
- **Risk: Kody refactor temptation creep** -> Mitigation: ADR-031 explicitly excludes kody; this plan touches 6 files only — kody.md is NOT one of them. Verification: `git diff --stat` after Phase 2 must show 6 paths max.

### Verification

- Harness self-test: `/skanner` from harness root → `Detected: harness`, runs 5 lifecycle scenarios, existing `tests/eval/*.test.ts` still pass (Step 3.6)
- Consumer self-test: scratch dir with `package.json` `"react": "^18"` → `Detected: web`, attempts Playwright scenarios, no hook-latency table (Step 3.7)
- Override path: `KADMON_SKANNER_PROFILE=harness` in web project → forces harness scenarios + warns markers missing (Step 3.8)
- Plugin install verification: install via `install.ps1` in scratch consumer dir, confirm 3 components ship (Step 3.9)
- Mechanical: `npx vitest run` (1065 tests pass), `npx tsc --noEmit` (0 errors), `/medik` Check #8 + Check #14 clean

### Acceptance Criteria

- [ ] All 6 file modifications complete:
  1. `.claude/commands/skanner.md` (Arguments + Phase 1b + example)
  2. `.claude/agents/kartograf.md` (description + Project Detection + scenario blocks + Workflow Step 0 + CLI scenarios)
  3. `.claude/agents/arkonte.md` (description + Expertise + Project Detection + Kadmon Harness Mode wrapping)
  4. `.claude/rules/common/agents.md` (catalog Trigger column for kartograf + arkonte)
  5. `scripts/lib/detect-project-language.ts` (extended with `detectSkannerProfile` + `SkannerProfile` type)
  6. `tests/eval/skanner-profile-detection.test.ts` (NEW)
- [ ] New test passes: `npx vitest run tests/eval/skanner-profile-detection.test.ts` → 12/12 PASS
- [ ] Existing 1053 harness tests still pass: `npx vitest run` → 1065/1065 PASS (1053 baseline + 12 new)
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `/medik` Check #8 (frontmatter linter) passes for kartograf + arkonte
- [ ] `/medik` Check #14 (capability-alignment) still passes — no skill→tool drift
- [ ] Manual harness self-test (Step 3.6) shows `Detected: harness` + 5 lifecycle scenarios
- [ ] Manual consumer self-test (Step 3.7) in `/tmp/scratch-web` shows `Detected: web` + no harness leakage
- [ ] Manual override test (Step 3.8) shows env var beats markers
- [ ] Plugin install verification (Step 3.9) confirms ADR-010 distribution still works (skip-with-justification acceptable if install scripts not runnable in this environment)
- [ ] `git diff --stat` after Phase 2 shows exactly 6 paths changed (no kody scope creep)
- [ ] ADR-031 status flipped from `proposed` to `accepted` in a final commit on this plan
