---
number: 33
title: /medik project-agnostic via cwd-target-existence detection
date: 2026-04-26
status: completed
needs_tdd: true
route: A
adr: ADR-033-medik-project-agnostic.md
---

## Plan: /medik project-agnostic via cwd-target-existence detection [konstruct]

### Overview

Implements ADR-033. Makes `/medik` semantically correct in any cwd by adding (1) a thin `detectMedikProfile()` adapter for the diagnostic banner ONLY (no skip gate), and (2) per-check cwd-target-existence guards inside the 5 checks (#8, #11, #12, #13, #14) that the original ADR-033 draft mis-classified as "harness-only". `CheckContext` shape is unchanged — no `profile` field. Consumer NOTE messages use the symmetric phrasing "no consumer-local <kind> in this project — nothing to <verb>". The `detectSkannerProfile` → `detectProjectProfile` rename + `KADMON_PROJECT_PROFILE` umbrella env var ALREADY shipped in plan-032 commit `8484ee2`; plan-033 inherits via the existing alias and adds only the `detectMedikProfile` adapter.

### Assumptions

- ADR-033 (rewritten) is on disk and is the authoritative spec — validated by reading `docs/decisions/ADR-033-medik-project-agnostic.md`. Decision section enumerates per-check cwd-target-existence detection (NOT a binary profile gate); CheckContext is unchanged; Check #14 v1.4 defer is canceled.
- `detectProjectProfile` rename + `detectSkannerProfile` deprecated alias + `KADMON_PROJECT_PROFILE` env var support already shipped in plan-032 commit `8484ee2` — validated by reading `scripts/lib/detect-project-language.ts` lines 113–280. No rename work in plan-033.
- `CheckContext` lives at `scripts/lib/medik-checks/types.ts` with shape `{ projectHash: string; cwd: string }` (no profile field) — validated by reading the file. **Plan-033 keeps this shape unchanged.**
- 5 module-per-check files exist on disk: `capability-alignment.ts`, `hook-health-24h.ts`, `instinct-decay-candidates.ts`, `skill-creator-probe.ts`, `stale-plans.ts` — validated by directory listing.
- `stale-plans.ts` already uses the cwd-target-existence pattern (returns PASS when `<cwd>/docs/plans/` absent at lines 35–41) — this is the canonical reference for the new guards.
- `skill-creator-probe.ts` already probes 3 candidate paths and is meaningful in any project (lines 13–17) — no change needed.
- Inline checks #1–#7, #9, #10 are in `.claude/commands/medik.md` and run via the language-aware ADR-020 toolchain — already project-agnostic.
- Inline Check #8 (`npx tsx scripts/lint-agent-frontmatter.ts`) is wrapped in the command markdown — needs a cwd-existence guard wrapper added at the command level.
- Consumer projects WILL have project-local `.claude/{agents,skills,commands}/` and project-scoped instincts — per ADR-033 §Empirical correction. The cwd-existence pattern serves both consumers WITH local catalogs (full audit) and consumers WITHOUT local catalogs (informational NOTE).
- `process.cwd()` (not `KADMON_RUNTIME_ROOT`) is the correct cwd input — `KADMON_RUNTIME_ROOT` points at the plugin cache, not the workspace.
- Test count baseline: 1069 + plan-031's 12 alias parity cases that landed with plan-032 = 1081 + plan-032's 8 doks-profile cases = 1091. Plan-033 adds 1 alias parity case + 11 medik-profile cases (10 in tests/lib/medik-profile-detection.test.ts + 1 alias case in tests/eval/skanner-profile-detection.test.ts) = 1103 target. Phase 0 records the live baseline; Phase 4 asserts against it.

### Phase 0: Research (read-only)

- [ ] Step 0.1: Read ADR-033 in full. (S)
  - File: `docs/decisions/ADR-033-medik-project-agnostic.md`
  - Verify: Decision section confirms per-check cwd-target-existence detection (NO `profile` field on CheckContext); the v1.4 defer of Check #14 is canceled; canonical NOTE phrasing template ("no consumer-local <kind> in this project — nothing to <verb>") is documented.
  - Depends on: none
  - Risk: Low

- [ ] Step 0.2: Confirm `detectProjectProfile` rename already shipped. (S)
  - File: `scripts/lib/detect-project-language.ts`
  - Verify: `detectProjectProfile` exported at line ~161; `detectSkannerProfile` alias at line ~280; `KADMON_PROJECT_PROFILE` umbrella env var honored at lines 179–186; `KADMON_SKANNER_PROFILE` back-compat at lines 188–195. **NO rename work needed in plan-033** — only `detectMedikProfile` adapter to be added.
  - Depends on: none
  - Risk: Low (premise-critical; if rename absent, plan-032 is broken upstream — pause and escalate)

- [ ] Step 0.3: Read `scripts/lib/medik-checks/types.ts`. (S)
  - File: `scripts/lib/medik-checks/types.ts`
  - Verify: `CheckContext = { projectHash: string; cwd: string }`. **Plan-033 keeps this shape unchanged** — no `profile` field is added.
  - Depends on: none
  - Risk: Low

- [ ] Step 0.4: Read each affected check file to confirm current shape and target. (S)
  - Files:
    - `scripts/lib/medik-checks/capability-alignment.ts` — calls `buildCapabilityMatrix({ cwd: ctx.cwd })`; needs guard for `<cwd>/.claude/agents/` AND `<cwd>/.claude/skills/`.
    - `scripts/lib/medik-checks/hook-health-24h.ts` — SQLite query filtered by `ctx.projectHash`; ALREADY project-aware. Needs ZERO existence guard — empty result already yields PASS message at lines 50–56. Confirm by reading.
    - `scripts/lib/medik-checks/instinct-decay-candidates.ts` — SQLite query filtered by `ctx.projectHash`; ALREADY project-aware. Needs ZERO existence guard — empty result already yields PASS message at lines 40–46. Confirm by reading.
    - `scripts/lib/medik-checks/skill-creator-probe.ts` — already probes 3 paths in any project. Needs ZERO change.
    - `scripts/lib/medik-checks/stale-plans.ts` — canonical reference for the cwd-target-existence pattern (lines 35–41).
  - Verify: only checks #8 (inline) and #14 (capability-alignment.ts) need new guards. Checks #11, #12, #13 are already correctly project-scoped.
  - Depends on: 0.3
  - Risk: Low

- [ ] Step 0.5: Read `.claude/commands/medik.md` Phase 0 + Phase 1 to identify inline-check edit sites. (S)
  - File: `.claude/commands/medik.md`
  - Verify: Phase 0 currently handles `--ALV` only (lines 14–38); Phase 1 has the 14-check table (lines 40–74); Check #8 is inline (line 64) referencing `npx tsx scripts/lint-agent-frontmatter.ts`. Plan-033 inserts profile-detection banner in Phase 0 + cwd-existence guard wrapper around Check #8.
  - Depends on: none
  - Risk: Low

- [ ] Step 0.6: Read `tests/eval/skanner-profile-detection.test.ts` for fixture patterns. (S)
  - File: `tests/eval/skanner-profile-detection.test.ts`
  - Verify: pattern uses `mkdtempSync` + per-test cleanup + `vi.spyOn(process.stderr, "write")`. Reuse verbatim in `tests/lib/medik-profile-detection.test.ts`.
  - Depends on: none
  - Risk: Low

- [ ] Step 0.7: Confirm baseline test count. (S)
  - Command: `npx vitest run 2>&1 | tail -5`
  - Verify: record actual baseline (target: 1091 after plan-032 ships). If divergent, adjust Phase 4 targets.
  - Depends on: 0.1–0.6
  - Risk: Low

### Phase 1: Detection adapter — `detectMedikProfile` + `MedikProfile` type (TDD)

RED-GREEN-REFACTOR. The rename is already shipped (plan-032). Plan-033 adds only the `MedikProfile` two-value type and the `detectMedikProfile` adapter that collapses `web | cli` → `consumer`.

- [ ] Step 1.1: Append 1 alias parity case to plan-031's existing test file. (S)
  - File: `tests/eval/skanner-profile-detection.test.ts`
  - Action: Append one `it` block at the bottom of the existing describe block:
    `"detectMedikProfile collapses web|cli to consumer and respects KADMON_MEDIK_PROFILE"` — imports `detectMedikProfile`, asserts:
    - harness markers → `'harness'`
    - web markers (react in package.json) → `'consumer'`
    - cli markers (bin field) → `'consumer'`
    - `KADMON_MEDIK_PROFILE=harness` overrides web markers
  - Verify: `npx vitest run tests/eval/skanner-profile-detection.test.ts` — RED (`detectMedikProfile` does not exist yet).
  - Depends on: 0.7
  - Risk: Low (test-only)

- [ ] Step 1.2: Add `MedikProfile` type + `detectMedikProfile()` adapter. (M)
  - File: `scripts/lib/detect-project-language.ts`
  - Actions:
    1. Add type after `ProjectProfile` (around line 121):
       ```typescript
       /**
        * Two-value profile for /medik diagnostic banner (ADR-033).
        * Collapses web|cli → consumer; harness stays harness.
        * Used as DIAGNOSTIC HINT only — never as a per-check skip gate.
        */
       export type MedikProfile = "harness" | "consumer";
       ```
    2. Add adapter function at bottom of file (after `detectSkannerProfile` alias at line 280):
       ```typescript
       /**
        * Returns the /medik diagnostic-banner profile for the project at `cwd`.
        *
        * Precedence (top wins):
        *  1. `explicitArg` — validated against ['harness','consumer']
        *  2. `KADMON_MEDIK_PROFILE` env var — trim + lowercase + whitelist
        *  3. delegate to detectProjectProfile() and collapse 'web'|'cli' → 'consumer'
        *
        * NOT consumed by any runCheck() as a skip gate — diagnostic only (ADR-033).
        */
       export function detectMedikProfile(
         cwd: string = process.cwd(),
         explicitArg?: string,
       ): MedikProfile {
         // 1. Explicit arg
         if (explicitArg !== undefined) {
           const normalized = explicitArg.trim().toLowerCase();
           if (normalized === "harness" || normalized === "consumer") {
             return normalized;
           }
         }
         // 2. KADMON_MEDIK_PROFILE env override
         const envRaw = process.env["KADMON_MEDIK_PROFILE"];
         const envVal = envRaw?.trim().toLowerCase() ?? "";
         if (envVal === "harness" || envVal === "consumer") {
           return envVal;
         }
         // 3. Delegate + collapse
         const underlying = detectProjectProfile(cwd);
         return underlying === "harness" ? "harness" : "consumer";
       }
       ```
    3. Update file header comment to mention ADR-033 + `detectMedikProfile`.
  - Verify: `npx vitest run tests/eval/skanner-profile-detection.test.ts` GREEN. `npx tsc --noEmit` clean.
  - Depends on: 1.1
  - Risk: Low (additive — no rename, no shape change)

### Phase 2: Per-check cwd-target-existence guards (TDD)

CheckContext is NOT extended. Each affected check resolves its target locally. Inline Check #8 is wrapped in a cwd-existence guard at the command-markdown level.

- [ ] Step 2.1: Write failing test in `tests/lib/medik-profile-detection.test.ts` (RED). (M)
  - File: `tests/lib/medik-profile-detection.test.ts` (NEW)
  - Test cases (10) — using `mkdtempSync` fixture pattern from Phase 0.6:
    1. `detectMedikProfile()` returns `'harness'` for harness markers (state-store.ts present in tmpDir).
    2. `detectMedikProfile()` returns `'consumer'` for web markers (`react` in package.json).
    3. `detectMedikProfile()` returns `'consumer'` for cli markers (package.json `bin` field).
    4. `detectMedikProfile()` returns `'consumer'` for empty tmpDir (fallback collapse from `web`).
    5. `KADMON_MEDIK_PROFILE=harness` overrides web markers.
    6. `KADMON_MEDIK_PROFILE=consumer` overrides harness markers.
    7. Explicit arg `harness` beats env `KADMON_MEDIK_PROFILE=consumer`.
    8. Capability-alignment guard: when `<cwd>/.claude/agents/` AND `<cwd>/.claude/skills/` are both ABSENT, `runCheck` from `capability-alignment.ts` returns `{ status: 'NOTE', message: <contains "no consumer-local"> }`.
    9. Capability-alignment guard: when both dirs are PRESENT (write a synthetic agent + skill into tmpDir), `runCheck` runs the matrix and returns the existing PASS or violation status (no NOTE-skip).
    10. Profile detection is diagnostic-only: assert that `detectMedikProfile` is NOT imported from any file under `scripts/lib/medik-checks/` (grep assertion proving the gate is at command level only). Use `fs.readdirSync` + `fs.readFileSync` over the directory.
  - Verify: all 10 cases FAIL until 1.2 + 2.2 + 2.3 land.
  - Depends on: 0.7
  - Risk: Medium — multi-fixture setup; mitigation = reuse skanner test helpers verbatim

- [ ] Step 2.2: Add cwd-target-existence guard to `capability-alignment.ts`. (M)
  - File: `scripts/lib/medik-checks/capability-alignment.ts`
  - Action: insert at the top of `runCheck`, before `buildCapabilityMatrix`:
    ```typescript
    import fs from "node:fs";
    import path from "node:path";
    // ...existing imports

    export function runCheck(ctx: CheckContext): CheckResult {
      const agentsDir = path.join(ctx.cwd, ".claude", "agents");
      const skillsDir = path.join(ctx.cwd, ".claude", "skills");
      if (!fs.existsSync(agentsDir) || !fs.existsSync(skillsDir)) {
        return {
          status: "NOTE",
          category: "knowledge-hygiene",
          message:
            "no consumer-local agents/skills in this project — nothing to audit (capability-alignment requires both .claude/agents/ and .claude/skills/)",
        };
      }
      // ...existing matrix + violations logic unchanged
    ```
  - Verify: `npx vitest run tests/lib/medik-profile-detection.test.ts` cases 8 + 9 GREEN. Existing `tests/lib/medik-checks/capability-alignment.test.ts` (if present) STILL PASSES — guard is added BEFORE existing logic, no behavior change when both dirs are present.
  - Depends on: 2.1
  - Risk: Medium — must not regress existing capability-alignment tests; mitigation = guard is additive and non-destructive

- [ ] Step 2.3: Confirm `hook-health-24h.ts`, `instinct-decay-candidates.ts`, `skill-creator-probe.ts`, `stale-plans.ts` need NO change. (S)
  - Files: 4 listed above.
  - Action: re-verify per Phase 0.4 readings — these are already correctly cwd-aware or project_hash-filtered. **Document in plan but make NO edits.**
  - Verify: `git status` shows zero diff on these 4 files after Phase 2.
  - Depends on: 2.2
  - Risk: Low

- [ ] Step 2.4: Inline Check #8 cwd-existence guard at command markdown level. (S)
  - File: `.claude/commands/medik.md`
  - Action: replace the Check #8 invocation row's `npx tsx scripts/lint-agent-frontmatter.ts` with a guarded wrapper. Concretely, change the "Command / Method" cell for row #8 to:
    ```
    `node -e "if (!require('fs').existsSync('.claude/agents')) { console.log(JSON.stringify({ status: 'NOTE', category: 'code-hygiene', message: 'no consumer-local agents in this project — nothing to lint' })); process.exit(0); }"` then `npx tsx scripts/lint-agent-frontmatter.ts` if guard passed
    ```
    Or, equivalently, add a one-line note above row #8: "Check #8 is wrapped in a cwd-existence guard — if `.claude/agents/` is absent in cwd, emit NOTE and skip the linter invocation."
  - Verify: `grep -n "no consumer-local agents" .claude/commands/medik.md` — at least 1 hit. Existing harness self-`/medik` still finds `.claude/agents/` in the harness root, so the linter runs identically (no behavioral regression).
  - Depends on: 2.3
  - Risk: Low

### Phase 3: Command markdown — diagnostic banner wiring

- [ ] Step 3.1: Update `.claude/commands/medik.md` Phase 0 with profile detection banner. (M)
  - File: `.claude/commands/medik.md`
  - Action:
    1. Insert an `## Arguments` section between frontmatter and `## Purpose`:
       ```
       ## Arguments
       - `harness | consumer` — explicit profile override (highest precedence). Optional. Diagnostic banner only — does NOT skip any check (ADR-033).
       - `KADMON_MEDIK_PROFILE=harness|consumer` — env var fallback.
       - `KADMON_PROJECT_PROFILE=harness|web|cli` — umbrella env var (lower precedence; collapsed `web|cli` → `consumer`).
       - Without args: profile detected from filesystem markers via `detectMedikProfile()`.
       ```
    2. Insert profile-detection step at the START of Phase 0 (before `--ALV` handling):
       ```
       ### Phase 0: Detection banner + flag detection

       Before any health checks or flag parsing, emit the diagnostic banner:

       ```bash
       npx tsx -e "
       import('./scripts/lib/detect-project-language.js').then(m => {
         const profile = m.detectMedikProfile(process.cwd(), process.argv[2]);
         const source = process.argv[2] ? 'arg' : (process.env.KADMON_MEDIK_PROFILE ? 'env' : 'markers');
         console.log('Detected: ' + profile + ' (source: ' + source + ')');
       });
       " "$ARGUMENTS"
       ```

       The banner is INFORMATIONAL ONLY. All 14 checks run regardless of profile (ADR-033). Per-check NOTE responses (e.g. "no consumer-local agents — nothing to lint") come from the checks themselves, not from this banner.

       Then handle `--ALV` flag (existing behavior preserved).
       ```
    3. Update the `> **Note:**` block beneath the 14-check table to add: "All 14 checks run in any cwd (ADR-033). Checks #8 and #14 emit a NOTE when their target directories (`.claude/agents/`, `.claude/skills/`) are absent — informational, not a defect. Checks #11 and #12 are already SQLite-filtered by `project_hash` derived from cwd."
  - Verify: `grep -n "Detected:\|ADR-033\|no consumer-local" .claude/commands/medik.md` — at least 4 hits.
  - Depends on: 2.4
  - Risk: Medium — markdown edits to a hot command; mitigation = run Check #14 immediately after the edit + harness self-`/medik` smoke

### Phase 4: Verification

- [ ] Step 4.1: Mechanical — full vitest, tsc, eslint. (S)
  - Commands: `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`
  - Verify: 1091 baseline + 1 alias case + 10 new = 1102 PASS (adjust to live Phase 0.7 baseline). Zero `tsc` errors. Zero new eslint errors.
  - Depends on: 3.1
  - Risk: Low

- [ ] Step 4.2: `/medik` Check #8 (frontmatter linter) clean. (S)
  - Verify: harness self-test runs the linter identically (cwd-existence guard passes — `.claude/agents/` exists in harness root); 0 violations.
  - Depends on: 4.1
  - Risk: Low

- [ ] Step 4.3: `/medik` Check #14 (capability-alignment) clean for own edits. (S)
  - Verify: capability-alignment runs against the harness, finds zero new violations introduced by plan-033 (no orphan-skill, no capability-mismatch on the new helper code).
  - Depends on: 4.2
  - Risk: Low

- [ ] Step 4.4: Harness self-test snapshot — byte-diff. (M)
  - Action:
    1. **Before any Phase 1–3 edits land**, on a clean checkout of the pre-change state, capture: `<run /medik in harness root> > /tmp/medik-snapshot-pre.txt`.
    2. After Phase 1–3 ship, repeat with the new code: `> /tmp/medik-snapshot-post.txt`.
    3. `diff /tmp/medik-snapshot-pre.txt /tmp/medik-snapshot-post.txt` — must show ONLY additive lines for the new `Detected: harness (source: markers)` first line. Pass/Fail/NOTE/WARN counts and per-check status MUST be byte-identical.
  - Verify: diff output reviewed manually; no removed or modified pre-existing lines except the additive banner.
  - Depends on: 4.3
  - Risk: High (regression backstop for harness use case — failure here means Phase 2 inadvertently changed behavior)

- [ ] Step 4.5: Consumer dogfood at `/tmp/scratch-cs`. (M)
  - Action:
    1. `mkdir -p /tmp/scratch-cs && cd /tmp/scratch-cs && git init && npm init -y && npm pkg set dependencies.react=^18`.
    2. `bash <harness-root>/install.sh /tmp/scratch-cs`.
    3. Verify `/tmp/scratch-cs/.claude/` has `rules/`, `settings.json`, NO `agents/`, NO `skills/`, NO `commands/` (consumer with NO project-local catalog).
    4. Capture plugin cache mtime baseline: `stat -c %Y ~/.claude/plugins/cache/kadmon-harness/kadmon-harness/1.2.3/.claude/agents/*.md > /tmp/plugin-mtime-pre.txt`.
    5. Capture harness git status baseline (must be clean): `git -C <harness-root> status --short > /tmp/harness-status-pre.txt`.
    6. Run `/medik` from `/tmp/scratch-cs`.
    7. Verify output:
       - First line: `Detected: consumer (source: markers)`.
       - All 14 checks invoked (no "harness-only required" skips).
       - Checks #1–#5 run language-aware against the consumer's npm/vitest toolchain.
       - Check #8 emits `NOTE: no consumer-local agents in this project — nothing to lint`.
       - Check #11 (hook-health-24h): SQLite query by consumer's `project_hash` returns 0 rows → existing PASS message ("No hook health issues in last 24h").
       - Check #12 (instinct-decay): SQLite query by consumer's `project_hash` returns 0 rows → existing PASS message ("No instinct decay candidates"). Cross-project instincts (scope=`cross_project`) surface in either query.
       - Check #13 (skill-creator-probe): probes 3 paths; whichever exists wins.
       - Check #14 (capability-alignment): emits `NOTE: no consumer-local agents/skills in this project — nothing to audit`.
    8. Post-run verify:
       - Plugin cache mtime UNCHANGED: `diff /tmp/plugin-mtime-pre.txt <(stat -c %Y ~/.claude/plugins/cache/kadmon-harness/kadmon-harness/1.2.3/.claude/agents/*.md)` → empty.
       - Harness git status UNCHANGED: `diff /tmp/harness-status-pre.txt <(git -C <harness-root> status --short)` → empty.
  - Verify: all assertions in step 7 + step 8 pass.
  - Depends on: 4.4
  - Risk: High (consumer-corruption test — if plugin cache mtime or harness git status diverges, ABORT and revert)

- [ ] Step 4.6: Consumer-with-local-catalog dogfood at `/tmp/scratch-cs-rich`. (M)
  - Action:
    1. `mkdir -p /tmp/scratch-cs-rich && cd /tmp/scratch-cs-rich && git init && npm init -y`.
    2. `bash <harness-root>/install.sh /tmp/scratch-cs-rich`.
    3. CREATE consumer-local agent + skill:
       ```
       mkdir -p .claude/agents .claude/skills/local-skill
       cat > .claude/agents/local-test.md <<EOF
       ---
       name: local-test
       description: Consumer-local test agent
       model: sonnet
       tools: Read
       skills: [local-skill]
       ---
       Test agent for /medik consumer dogfood with rich catalog.
       EOF
       cat > .claude/skills/local-skill/SKILL.md <<EOF
       ---
       name: local-skill
       description: Consumer-local test skill
       ---
       Test skill body.
       EOF
       ```
    4. Run `/medik` from `/tmp/scratch-cs-rich`.
    5. Verify output:
       - First line: `Detected: consumer (source: markers)`.
       - Check #8 (frontmatter linter): runs against `local-test.md`, returns PASS or its actual lint result (NOT a NOTE skip).
       - Check #14 (capability-alignment): runs against the local catalog, audits `local-test` ↔ `local-skill` linkage. Result depends on actual alignment but NOT a NOTE-skip.
  - Verify: full audit coverage demonstrated for consumer with local catalog. The cancellation of the v1.4 defer (ADR-033) is justified by this evidence.
  - Depends on: 4.5
  - Risk: Medium — first time `/medik` audits a consumer-local catalog; mitigation = test asserts behavioral correctness, not specific PASS counts

- [ ] Step 4.7: Backward-compat — plan-031 + plan-032 tests still pass. (S)
  - Command: `npx vitest run tests/eval/skanner-profile-detection.test.ts tests/lib/doks-profile-detection.test.ts`
  - Verify: pre-existing cases all PASS via the deprecated `detectSkannerProfile` alias and via `detectProjectProfile`; new alias-equality case from Step 1.1 also PASSes.
  - Depends on: 4.1
  - Risk: Low (alias is identity)

- [ ] Step 4.8: `git diff --stat` matches expected file set. (S)
  - Expected paths (and ONLY these):
    - `scripts/lib/detect-project-language.ts` (`MedikProfile` type + `detectMedikProfile` adapter)
    - `tests/eval/skanner-profile-detection.test.ts` (1 alias case appended)
    - `scripts/lib/medik-checks/capability-alignment.ts` (cwd-existence guard at top of `runCheck`)
    - `.claude/commands/medik.md` (Arguments section + Phase 0 banner + Note block update + Check #8 wrapper)
    - `tests/lib/medik-profile-detection.test.ts` (NEW)
    - `docs/decisions/ADR-033-medik-project-agnostic.md` (already rewritten upstream)
    - `docs/plans/plan-033-medik-project-agnostic.md` (this file)
  - **NOT expected** (ADR-033 keeps these unchanged):
    - `scripts/lib/medik-checks/types.ts` — CheckContext shape unchanged
    - `scripts/lib/medik-checks/hook-health-24h.ts` — already `project_hash`-filtered
    - `scripts/lib/medik-checks/instinct-decay-candidates.ts` — already `project_hash`-filtered
    - `scripts/lib/medik-checks/skill-creator-probe.ts` — already path-probing
    - `scripts/lib/medik-checks/stale-plans.ts` — already cwd-existence-gated
    - `scripts/lib/medik-checks/run-with-profile.ts` — NOT created (no command-level helper needed; banner is inline)
  - Verify: `git diff --stat main...HEAD` shows exactly the 7 expected paths; no kody scope creep, no /doks scope creep.
  - Depends on: 4.7
  - Risk: Low

### Test Plan (TDD targets)

| Phase | Test file | TDD step | Cases | Notes |
|------|-----------|----------|-------|-------|
| 1 | `tests/eval/skanner-profile-detection.test.ts` | RED 1.1 → GREEN 1.2 | 1 new (`detectMedikProfile` collapse + env override) | Reuses existing tmpdir + stderr-spy harness |
| 2 | `tests/lib/medik-profile-detection.test.ts` (NEW) | RED 2.1 → GREEN 1.2 + 2.2 | 10 (4 detection + 3 override + 2 capability-alignment guard + 1 architectural assertion) | Mirrors plan-032 doks-profile-detection test layout |
| 4 | Harness self-`/medik` snapshot diff | Behavioral regression backstop | 1 (byte-diff harness output pre/post) | Manual; `/tmp/medik-snapshot-{pre,post}.txt`. ONLY additive line allowed = `Detected: harness (source: markers)` |
| 4 | Consumer dogfood (no local catalog) at `/tmp/scratch-cs` | E2E behavioral verification | 1 (14 checks invoked, NOTEs for absent targets, plugin cache stable, harness git clean) | Manual; transcript in PR body |
| 4 | Consumer dogfood (with local catalog) at `/tmp/scratch-cs-rich` | E2E coverage demonstration | 1 (Check #8 + #14 audit local catalog, no NOTE-skip) | Manual; justifies ADR-033 v1.4-defer cancellation |

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Harness self-`/medik` regression (catastrophic for downstream `/medik` users) | Step 4.4 byte-diff snapshot is the gate. Only the `Detected:` first line is an allowed additive change. If pre-existing per-check status text changes, revert Phase 2 commits and re-design with strictly additive output. |
| Consumer corruption — `/medik` accidentally writes outside cwd | Step 4.5 stat-mtime check on plugin cache + harness git-status diff. Both must be empty post-run. ABORT-and-revert protocol if either diverges. |
| NOTE message phrasing drift across checks | Plan-033 specifies the canonical phrasing template ("no consumer-local <kind> in this project — nothing to <verb>") in Step 2.2 and Step 2.4. capability-alignment.ts and the inline Check #8 wrapper use the same shape. Future check additions must follow the template. |
| `KADMON_MEDIK_PROFILE` collides with `KADMON_PROJECT_PROFILE` | Step 1.2 documents precedence: explicit arg → `KADMON_MEDIK_PROFILE` (banner-level) → `KADMON_PROJECT_PROFILE` (umbrella, via `detectProjectProfile`) → markers. Banner is diagnostic only, so a misconfigured precedence has no behavioral consequence — only a misleading banner line. |
| Plan-031 + plan-032 regression via the new adapter | Step 1.1 RED test asserts `detectMedikProfile` collapse + override semantics. Step 4.7 explicitly re-runs plan-031 + plan-032 test files. Both must remain GREEN. |
| Inline Check #8 wrapper produces a stack trace on consumer fresh install | Step 2.4 wraps the linter invocation in a `node -e "if (!fs.existsSync('.claude/agents')) ..."` guard that short-circuits with a NOTE before the linter spawn. Step 4.5 dogfood verifies the consumer-fresh-install case produces NOTE, not a stack trace. |
| Check #14 fork-aware mode regresses harness self-audit | Step 4.4 byte-diff catches any harness self-`/medik` regression. Step 4.6 (consumer with local catalog) demonstrates the fork-aware behavior is correct. |
| Misdetection in monorepos | ADR-033 Risk #1 → env var (`KADMON_MEDIK_PROFILE`) + explicit arg always beat marker scan. `Detected: <profile> (source: ...)` first-line output is auditable. Same mitigation as ADR-031, ADR-032. |

### Verification

**Mechanical**:
- `npx vitest run` — 1091 baseline + 1 alias + 10 new = 1102 PASS (adjust to live Phase 0.7 baseline).
- `npx tsc --noEmit` — 0 errors.
- `npx eslint .` — 0 new errors.
- `/medik` Check #8 (agent frontmatter linter) — clean (existing harness behavior preserved).
- `/medik` Check #14 (capability-alignment) — clean for own edits.

**Behavioral**:
- Harness self-`/medik` snapshot byte-identical pre/post except the additive `Detected: harness (source: markers)` first line. Pass/Fail/NOTE/WARN counts and per-check status text unchanged.
- Consumer dogfood (fresh install) at `/tmp/scratch-cs`: profile detected as consumer, all 14 checks invoked, Checks #8 + #14 emit informational NOTEs, plugin cache mtime unchanged, harness git status clean.
- Consumer dogfood (rich catalog) at `/tmp/scratch-cs-rich`: profile detected as consumer, Checks #8 + #14 audit the consumer-local catalog (NOT a NOTE-skip), justifying the v1.4-defer cancellation.
- Backward-compat: plan-031 + plan-032 test files all PASS.

**Diff hygiene**:
- `git diff --stat main...HEAD` matches the expected 7 paths in Step 4.8.
- Conventional commit message includes `Reviewed: full` footer (per `git-workflow.md`).

### Acceptance Criteria

- [ ] All 7 file modifications complete:
  - [ ] `scripts/lib/detect-project-language.ts` — `MedikProfile` type + `detectMedikProfile` adapter (NO rename — already shipped in plan-032)
  - [ ] `tests/eval/skanner-profile-detection.test.ts` — 1 new alias parity case appended
  - [ ] `scripts/lib/medik-checks/capability-alignment.ts` — cwd-existence guard at top of `runCheck`
  - [ ] `.claude/commands/medik.md` — Arguments section + Phase 0 banner + Note block update + Check #8 wrapper
  - [ ] `tests/lib/medik-profile-detection.test.ts` — NEW file with 10 cases
  - [ ] `docs/decisions/ADR-033-medik-project-agnostic.md` — already rewritten upstream
  - [ ] `docs/plans/plan-033-medik-project-agnostic.md` — this file
- [ ] **Files NOT modified** (verified by `git diff --stat`):
  - [ ] `scripts/lib/medik-checks/types.ts` — CheckContext shape unchanged (no `profile` field)
  - [ ] `scripts/lib/medik-checks/hook-health-24h.ts` — already correctly project-scoped
  - [ ] `scripts/lib/medik-checks/instinct-decay-candidates.ts` — already correctly project-scoped
  - [ ] `scripts/lib/medik-checks/skill-creator-probe.ts` — already meaningful in any project
  - [ ] `scripts/lib/medik-checks/stale-plans.ts` — already cwd-existence-gated
- [ ] New test file passes: 10/10.
- [ ] Existing baseline tests still pass: full vitest run = baseline + 11.
- [ ] `npx tsc --noEmit` → 0 errors.
- [ ] `npx eslint .` → 0 new errors.
- [ ] `/medik` Check #8 frontmatter linter clean.
- [ ] `/medik` Check #14 capability-alignment clean for own edits.
- [ ] Harness self-`/medik` snapshot byte-identical pre/post except additive banner.
- [ ] Consumer dogfood (no local catalog) at `/tmp/scratch-cs`: all 14 checks invoked, Checks #8 + #14 emit NOTE, plugin cache mtime unchanged, harness git status clean.
- [ ] Consumer dogfood (with local catalog) at `/tmp/scratch-cs-rich`: Checks #8 + #14 audit the local catalog (no NOTE-skip).
- [ ] Backward-compat: plan-031 (`tests/eval/skanner-profile-detection.test.ts`) + plan-032 (`tests/lib/doks-profile-detection.test.ts`) all PASS.
- [ ] `git diff --stat` shows only the expected 7 paths — no kody scope creep, no /doks scope creep.
- [ ] Conventional commit message includes `Reviewed: full` footer.
