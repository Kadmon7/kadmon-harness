---
number: 32
title: /doks project-agnostic via runtime profile detection
date: 2026-04-26
status: pending
needs_tdd: true
route: A
adr: ADR-032-doks-project-agnostic.md
---

## Plan: /doks project-agnostic via runtime profile detection [konstruct]

### Overview

Make `/doks` semantically correct in any cwd by (1) renaming `detectSkannerProfile` to the generic `detectProjectProfile` (with deprecated alias preserving plan-031 imports), (2) refactoring the doks agent + command to detect profile at runtime and apply per-layer eligibility (harness profile = all 4 layers writable; consumer profile = Layer 1 always writable, Layer 2 read-only, Layers 3-4 writable but enumerate cwd-only). This is an in-place rewrite of plan-032 — the original draft assumed consumer projects had symlinked `.claude/{agents,skills,commands}` dirs into the plugin cache (false: `install.sh` line 4 explicitly states "Does NOT copy agents/skills/commands"). Real fix is purely semantic; no `isSymlink()` helper, no symlink protection. Harness self-`/doks` MUST remain byte-identical (snapshot-gated).

### Assumptions

- ADR-032 is on disk and is the authoritative spec — validated by reading `docs/decisions/ADR-032-doks-project-agnostic.md` (Decision section enumerates harness/consumer profiles + override precedence + rename; the symlink helper is explicitly excluded).
- `scripts/lib/detect-project-language.ts` currently exports `detectSkannerProfile` (line 154) and `SkannerProfile` (line 120) — validated by reading the file. Internal env var read at line 171 is `KADMON_SKANNER_PROFILE`.
- Consumer projects do NOT have `.claude/{agents,skills,commands}` directories — validated by ADR-032 §Empirical correction citing Kadmon-Sports state and `install.sh` line 4.
- `tests/eval/skanner-profile-detection.test.ts` from plan-031 has 12+ cases and imports `detectSkannerProfile` — validated by reading the file's header (12 cases minimum) and import block (line 24). Cannot run vitest from sub-agent shell, so baseline test count is asserted from harness git log: latest commit `a72cec9` says plan-031 added 12 cases.
- The doks agent body (`.claude/agents/doks.md`) is the orchestrator with Workflow steps 1-4; the command file (`.claude/commands/doks.md`) has 8 numbered steps and is the entry-point spec — both validated by reading.
- `.claude/skills/docs-sync/SKILL.md` describes WHAT to sync (4-layer model, behavior-over-counts) and does NOT mandate a write target per layer — validated by reading. No edit needed unless Phase 0 reveals a contradiction.
- Plan-031 imports stay green via `export const detectSkannerProfile = detectProjectProfile` (function-reference identity guarantees behavior parity).
- Test count baseline: latest commit prior to this plan reports 1069 + plan-031's 12 = 1081 green. Plan-032 adds 2 alias parity cases + 8 new doks-profile cases = 1091 target. Phase 0 records the live baseline; Phase 4 asserts against it.

### Phase 0: Research

- [ ] Step 0.1: Read ADR-032 in full to internalize per-layer eligibility rules and override precedence. (S)
  - File: `docs/decisions/ADR-032-doks-project-agnostic.md`
  - Verify: Decision section enumerates harness + consumer per-layer rules + 5-tier override precedence + rename; "NO `isSymlink()` HELPER" line present.
  - Depends on: none
  - Risk: Low
- [ ] Step 0.2: Read `scripts/lib/detect-project-language.ts` to confirm rename insertion points. (S)
  - File: `scripts/lib/detect-project-language.ts`
  - Verify: `detectSkannerProfile` at line 154; `SkannerProfile` type at line 120; `VALID_SKANNER_PROFILES` at line 122; `isSkannerProfile` at line 128; env-var read at line 171. No `isSymlink` symbol exists.
  - Depends on: none
  - Risk: Low
- [ ] Step 0.3: Read current doks agent body and command spec to know what to refactor. (S)
  - Files: `.claude/agents/doks.md`, `.claude/commands/doks.md`
  - Verify: agent has Workflow steps 1-4 + Documentation Files table with Layers 1-4; command has 8 numbered steps (currently no `## Arguments` section).
  - Depends on: none
  - Risk: Low
- [ ] Step 0.4: Read `tests/eval/skanner-profile-detection.test.ts` to mirror its tmpdir + stderr-spy helpers. (S)
  - File: `tests/eval/skanner-profile-detection.test.ts`
  - Verify: helpers `makeTmpDir`, `writeMarker`, `cleanProfileEnv` and `stderrSpy` pattern identified for reuse.
  - Depends on: none
  - Risk: Low
- [ ] Step 0.5: Read `.claude/skills/docs-sync/SKILL.md` to confirm no contradiction with the new write-target model. (S)
  - File: `.claude/skills/docs-sync/SKILL.md`
  - Verify: skill describes "what to sync" not "where to write per profile". If no per-layer write-target instructions, no edit needed in Phase 2.
  - Depends on: none
  - Risk: Low
- [ ] Step 0.6: Verify Kadmon-Sports `.claude/` empirical state matches ADR-032 §Empirical correction. (S)
  - Command: `ls C:/Command-Center/Kadmon-Sports/.claude/`
  - Verify: shows `rules/`, `agent-memory/`, `settings.json`, `settings.local.json`. No `agents/`, `skills/`, or `commands/`. (If divergent, flag immediately and pause; the plan's premise depends on this state.)
  - Depends on: 0.1
  - Risk: Medium (premise-critical; if false, ADR-032 must be revisited before plan continues)
- [ ] Step 0.7: Confirm baseline test count. (S)
  - Command: `npx vitest run 2>&1 | tail -5`
  - Verify: record actual baseline (target: 1081). If divergent, adjust Phase 4 targets.
  - Depends on: 0.1-0.6
  - Risk: Low

### Phase 1: Detection rename + KADMON_PROJECT_PROFILE env (TDD)

RED-GREEN-REFACTOR. Failing test first, then ship the rename.

- [ ] Step 1.1: Append 2 alias parity cases to plan-031's existing test file. (S)
  - File: `tests/eval/skanner-profile-detection.test.ts`
  - Action: Append two `it` blocks at the bottom of the existing describe block:
    1. `"detectSkannerProfile is the same reference as detectProjectProfile (alias contract)"` — imports both and asserts `detectSkannerProfile === detectProjectProfile`.
    2. `"detectProjectProfile behaves identically to detectSkannerProfile for the harness case"` — runs both with the same tmpDir + harness marker, asserts both return `'harness'`.
  - Verify: `npx vitest run tests/eval/skanner-profile-detection.test.ts` — RED (named export `detectProjectProfile` does not exist yet).
  - Depends on: 0.7
  - Risk: Low (test-only, mirrors existing pattern)
- [ ] Step 1.2: Rename function + type + env support. (M)
  - File: `scripts/lib/detect-project-language.ts`
  - Actions:
    1. Rename function `detectSkannerProfile` → `detectProjectProfile` (signature unchanged).
    2. Rename type `SkannerProfile` → `ProjectProfile`. Append `export type SkannerProfile = ProjectProfile;` with JSDoc `@deprecated Use ProjectProfile (alias preserved for plan-031 imports).`
    3. Rename internal `VALID_SKANNER_PROFILES` → `VALID_PROJECT_PROFILES`; rename type guard `isSkannerProfile` → `isProjectProfile`.
    4. Update env-var lookup: read `KADMON_PROJECT_PROFILE` first (new umbrella), fall back to `KADMON_SKANNER_PROFILE` (backward compat for plan-031 callers). Order: explicit arg → `KADMON_PROJECT_PROFILE` → `KADMON_SKANNER_PROFILE` → markers.
    5. Append: `export const detectSkannerProfile = detectProjectProfile;` with JSDoc `@deprecated Use detectProjectProfile (alias preserved for plan-031 imports).`
    6. Update top-of-file comment block to mention ADR-032.
    7. **No `isSymlink` helper** — explicitly excluded by ADR-032.
  - Verify: `npx vitest run tests/eval/skanner-profile-detection.test.ts` GREEN (12 plan-031 + 2 new alias = 14). `npx tsc --noEmit` clean.
  - Depends on: 1.1
  - Risk: Medium (rename touches a heavily-used function; alias must preserve identity)
- [ ] Step 1.3: Regression sweep. (S)
  - Command: `grep -rn "detectSkannerProfile\|SkannerProfile" scripts/ .claude/ tests/ docs/`
  - Verify: every hit either (a) is in this plan / ADR-032 / plan-031 / the test file, or (b) resolves cleanly via the alias. Full `npx vitest run` — baseline + 2 = 1083 PASS.
  - Depends on: 1.2
  - Risk: Low (alias is identity)

### Phase 2: Doks agent + command refactor

Per ADR-032 §Decision: profile detection drives per-layer eligibility; consumer counts come from cwd-relative `ls` only; plugin cache is never traversed.

- [ ] Step 2.1: Insert Workflow Step 0 (profile detection) into doks agent. (M)
  - File: `.claude/agents/doks.md`
  - Action: Insert a new section between the `## Workflow` header and `### 1. Understand What Changed`:
    ```
    ### 0. Detect profile and per-layer write-eligibility (ADR-032)

    Before any layer scan:

    1. Resolve profile via `detectProjectProfile(cwd, explicitArg)` from `scripts/lib/detect-project-language.ts`. Precedence: explicit `/doks <profile>` arg → `KADMON_DOKS_PROFILE` → `KADMON_PROJECT_PROFILE` → markers → fallback consumer.
    2. Map detector output to write-mode:
       - `harness` → harness write-mode
       - `web` | `cli` | unknown → consumer write-mode
    3. Per-layer eligibility:
       - Layer 1 (CLAUDE.md, README.md): ALWAYS writable.
       - Layer 2 (.claude/rules/): writable IF harness; SKIP with NOTE in consumer ("Rules harness-shared (general for all projects). Update from harness self-/doks; install.sh re-run resyncs the consumer copy.").
       - Layer 3 (.claude/commands/): writable always; in consumer profile, describe ONLY consumer-local commands (cwd-relative `ls .claude/commands/*.md`). Plugin-provided commands NOT enumerated.
       - Layer 4 (.claude/agents/, .claude/skills/): writable always; in consumer profile, describe ONLY consumer-local components. Plugin-provided components NOT enumerated.
    4. Print a per-layer eligibility summary at the start of the run so the user sees what will and will not sync.
    ```
  - Verify: `grep -n "Step 0\|detectProjectProfile\|per-layer eligibility" .claude/agents/doks.md` — at least 4 hits.
  - Depends on: 1.2
  - Risk: Low (additive)
- [ ] Step 2.2: Update Workflow Step 3 ("Update Documentation") with per-layer guards. (M)
  - File: `.claude/agents/doks.md`
  - Action: Modify Priority 1 / Priority 2 / Priority 3 instructions to reference the eligibility map from Step 0. Add explicit clauses:
    - "Layer 2 (rules): if eligibility=read-only, do NOT call Edit/Write on files inside `.claude/rules/`; emit the NOTE from Step 0 instead."
    - "Layer 3-4 (commands/agents/skills): in consumer profile, scan ONLY cwd-relative `.claude/{commands,agents,skills}/`. NEVER traverse `~/.claude/plugins/cache/` or any harness path."
  - Update the existing Documentation Files table to add a "Write-eligibility" column with values `always` (Layer 1), `harness-only` (Layer 2), `cwd-only` (Layers 3-4 in consumer; full in harness).
  - Verify: `grep -n "harness-shared\|cwd-only\|cwd-relative" .claude/agents/doks.md` — at least 3 hits.
  - Depends on: 2.1
  - Risk: Medium (gating must NOT regress harness self-`/doks` — Phase 4.4 snapshot is the backstop)
- [ ] Step 2.3: Update Output Format with new sections. (S)
  - File: `.claude/agents/doks.md`
  - Action: Append two sections to the existing `## Output Format` template:
    ```
    ### Profile (ADR-032)
    - Profile: harness | consumer (source: arg | env | markers)
    - Layer eligibility:
      - Layer 1 (CLAUDE.md, README.md): writable
      - Layer 2 (rules/): writable | read-only (harness-shared)
      - Layer 3 (commands/): writable (cwd-only in consumer)
      - Layer 4 (agents/, skills/): writable (cwd-only in consumer)

    ### Plugin-inherited components (consumer profile only)
    NOTE: Plugin kadmon-harness provides shared infra (16 agents, 46 skills, 11 commands, rules/) — not enumerated here. See harness self-docs.
    ```
  - Verify: `grep -n "Profile (ADR-032)\|Plugin-inherited" .claude/agents/doks.md` — both hit.
  - Depends on: 2.2
  - Risk: Low
- [ ] Step 2.4: Update Workflow Step 2 ("Extract Ground Truth") for cwd-only counts. (S)
  - File: `.claude/agents/doks.md`
  - Action: Add a clause after the existing `ls .claude/...` commands: "In consumer profile, these counts are cwd-only. Plugin-inherited counts are NOT included; the Output Format NOTE explains the omission. NEVER traverse `~/.claude/plugins/cache/` or any path outside cwd."
  - Verify: `grep -n "cwd-only\|NEVER traverse" .claude/agents/doks.md` — at least 2 hits.
  - Depends on: 2.3
  - Risk: Low
- [ ] Step 2.5: Update `.claude/commands/doks.md` with Arguments + step descriptions. (S)
  - File: `.claude/commands/doks.md`
  - Action:
    1. Insert an `## Arguments` section before `## Purpose`:
       ```
       ## Arguments
       - `harness | consumer` — explicit profile override (highest precedence). Optional.
       - `KADMON_DOKS_PROFILE=harness|consumer` — env var fallback.
       - `KADMON_PROJECT_PROFILE=harness|web|cli` — umbrella env var (lower precedence).
       - Without args: profile detected from filesystem markers (`detectProjectProfile`).
       ```
    2. Replace step 1 with: `1. Invoke **doks agent** (opus) — agent runs Step 0 profile detection + per-layer eligibility (ADR-032).`
    3. Insert step 2a after step 2: `2a. Per-layer eligibility computed (Layer 1 always writable; Layer 2 harness-only; Layers 3-4 cwd-only in consumer).`
    4. Update step 4 to: `4. **Layer 2 — Rules**: Update .claude/rules/common/hooks.md, agents.md, development-workflow.md if affected (SKIP with NOTE in consumer profile — rules are harness-shared).`
    5. Update steps 5-6 to mention "(consumer profile: cwd-only enumeration; plugin-provided components not listed)".
  - Verify: `grep -n "harness | consumer\|KADMON_DOKS_PROFILE\|harness-shared\|cwd-only" .claude/commands/doks.md` — at least 4 hits.
  - Depends on: 2.4
  - Risk: Low (spec-only)
- [ ] Step 2.6: Verify or update `docs-sync` skill. (S)
  - File: `.claude/skills/docs-sync/SKILL.md`
  - Action: If Phase 0.5 found no contradiction, leave unchanged. If contradiction exists (e.g., "always writes to all 4 layers" or per-layer write-target mandates), insert: "Write-eligibility per layer is determined at runtime by the doks agent (ADR-032). This skill describes WHAT to sync; the agent decides WHERE based on profile."
  - Verify: skill content reviewed and either left unchanged or augmented as above.
  - Depends on: 2.5
  - Risk: Low

### Phase 3: New profile detection test file (TDD)

Mirror plan-031's helper pattern; no symlink scenarios needed.

- [ ] Step 3.1: Write `tests/lib/doks-profile-detection.test.ts` with 8 cases. (M)
  - File: `tests/lib/doks-profile-detection.test.ts` (NEW)
  - Action: Create test file mirroring plan-031's helpers (`makeTmpDir`, `writeMarker`, `cleanProfileEnv`, stderr-spy). Cases:
    1. `detectProjectProfile()` returns `'harness'` for harness markers (proves the renamed function reuses the existing detection logic).
    2. `detectProjectProfile()` returns `'web'` for `react|next|vite` markers in package.json (collapsed to consumer in agent body — verified by helper #8).
    3. `detectProjectProfile()` returns `'cli'` for package.json `bin` field (collapsed to consumer in agent body — verified by helper #8).
    4. `KADMON_DOKS_PROFILE=consumer` overrides harness markers (test for the agent-body-level override; the function honors `KADMON_PROJECT_PROFILE` umbrella; the agent reads `KADMON_DOKS_PROFILE` first as documented in Step 2.5).
    5. `KADMON_DOKS_PROFILE=harness` overrides web markers.
    6. Explicit arg beats env var: arg=`harness`, env=`KADMON_DOKS_PROFILE=consumer` → `harness`.
    7. Backward-compat: `import { detectSkannerProfile } from "..."` resolves and `detectSkannerProfile === detectProjectProfile` (function-reference identity).
    8. Per-layer eligibility helper: implement `computeLayerEligibility(profile: 'harness' | 'consumer')` inside the test file; assert `'harness'` → all 4 layers writable; `'consumer'` → Layer 1 writable, Layer 2 read-only (harness-shared), Layers 3-4 writable (cwd-only). Helper mirrors agent body Step 0 logic.
  - Verify: `npx vitest run tests/lib/doks-profile-detection.test.ts` — 8/8 PASS.
  - Depends on: 1.2 (function exists), 2.1-2.5 (semantics defined)
  - Risk: Low (no symlink dependency; pure marker + env tests)
- [ ] Step 3.2: Document agent-body-vs-test-helper boundary in test header comment. (S)
  - File: `tests/lib/doks-profile-detection.test.ts`
  - Action: Add a top-of-file comment: "The doks agent body is markdown — directly testing the agent requires running `/doks` end-to-end (Phase 4 manual verification). This file unit-tests `detectProjectProfile` and a simulated `computeLayerEligibility` helper that mirrors the agent's Step 0 logic. Drift between this helper and the agent body is caught by Phase 4 self-test snapshot + consumer dogfood."
  - Verify: `head -20 tests/lib/doks-profile-detection.test.ts` shows the contract comment.
  - Depends on: 3.1
  - Risk: Low

### Phase 4: Verification

- [ ] Step 4.1: Mechanical — full vitest, tsc, eslint. (S)
  - Commands: `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`
  - Verify: 1081 baseline + 2 alias + 8 new = 1091 PASS (adjust to live Phase 0.7 baseline). Zero `tsc` errors. Zero new eslint errors.
  - Depends on: 3.2
  - Risk: Low
- [ ] Step 4.2: `/medik` Check #8 frontmatter linter clean for doks agent edits. (S)
  - Command: `npx tsx scripts/lib/lint-agent-frontmatter.ts` (or whatever Check #8 uses; locate via `grep -rn "Check #8\|lint-agent-frontmatter" scripts/`)
  - Verify: doks agent frontmatter unchanged (only body edits); linter PASS.
  - Depends on: 4.1
  - Risk: Low
- [ ] Step 4.3: `/medik` Check #14 capability-alignment clean. (S)
  - Command: invoke `/medik` Check #14 OR run its underlying script directly.
  - Verify: doks agent skills (`docs-sync`, `skill-stocktake`, `rules-distill`, `code-tour`) remain aligned with `tools:` declaration; no `requires_tools:` mismatch.
  - Depends on: 4.2
  - Risk: Low
- [ ] Step 4.4: Harness self-test snapshot — byte-diff. (M)
  - Action:
    1. **Before any Phase 1-3 edits land**, on a clean checkout of the pre-change state, capture: `<run /doks dry-run or read-only mode in harness root> > /tmp/doks-snapshot-pre.txt`. (If `/doks` lacks a dry-run mode, snapshot the agent's stdout up to the first Write/Edit invocation, then `git stash` to discard side effects.)
    2. After Phase 1-3 ship, repeat with the new code: `> /tmp/doks-snapshot-post.txt`.
    3. `diff /tmp/doks-snapshot-pre.txt /tmp/doks-snapshot-post.txt` — must show ONLY additive lines for the new "Profile (ADR-032)" + "Layer eligibility" sections. Existing per-file documentation update lines must be byte-identical.
  - Verify: diff output reviewed manually; no removed or modified pre-existing lines.
  - Depends on: 4.3
  - Risk: High (regression backstop for harness use case — failure here means Phase 2 changed behavior)
- [ ] Step 4.5: Consumer dogfood at `/tmp/scratch-web`. (M)
  - Action:
    1. `mkdir -p /tmp/scratch-web && cd /tmp/scratch-web && npm init -y && npm pkg set dependencies.react=^18`.
    2. `bash <harness-root>/install.sh /tmp/scratch-web`.
    3. Verify `/tmp/scratch-web/.claude/` has `rules/`, `settings.json`, `settings.local.json`, NO `agents/`, NO `skills/`, NO `commands/` (proves ADR-032 §Empirical correction holds).
    4. **CREATE consumer-local agent**:
       ```
       mkdir -p .claude/agents && cat > .claude/agents/local-test.md <<EOF
       ---
       name: local-test
       description: Consumer-local test agent
       model: sonnet
       tools: Read
       ---
       Test agent for /doks consumer dogfood.
       EOF
       ```
    5. Capture plugin cache mtime baseline: `stat -c %Y ~/.claude/plugins/cache/kadmon-harness/kadmon-harness/1.2.3/.claude/agents/*.md > /tmp/plugin-mtime-pre.txt`.
    6. Capture harness git status baseline (must be clean): `git -C <harness-root> status --short > /tmp/harness-status-pre.txt`.
    7. Run `/doks` from `/tmp/scratch-web`.
    8. Verify output:
       - First line indicates: `Detected: web (source: markers)` (or `consumer` after collapse).
       - Layer 1 (CLAUDE.md, README.md): writable, written.
       - Layer 2 (rules/): SKIP with NOTE about harness-shared.
       - Layer 3 (commands/): no consumer-local commands → reports cwd-only count = 0.
       - Layer 4 (agents/, skills/): describes `local-test.md` ONLY. Does NOT enumerate the harness 16 agents.
       - NOTE: "Plugin kadmon-harness provides shared infra — not enumerated here."
    9. Post-run verify:
       - Plugin cache mtime UNCHANGED: `stat -c %Y ~/.claude/plugins/cache/kadmon-harness/kadmon-harness/1.2.3/.claude/agents/*.md > /tmp/plugin-mtime-post.txt; diff /tmp/plugin-mtime-pre.txt /tmp/plugin-mtime-post.txt` → empty.
       - Harness git status UNCHANGED: `git -C <harness-root> status --short > /tmp/harness-status-post.txt; diff /tmp/harness-status-pre.txt /tmp/harness-status-post.txt` → empty.
       - `/tmp/scratch-web/CLAUDE.md` exists or was updated; `local-test` mentioned somewhere in consumer docs.
  - Verify: all assertions in step 8 + step 9 pass.
  - Depends on: 4.4
  - Risk: High (catastrophic-corruption test from ADR-032 §Risks #3 — if plugin cache mtime or harness git status diverges, ABORT and revert)
- [ ] Step 4.6: Backward-compat — plan-031 test still passes. (S)
  - Command: `npx vitest run tests/eval/skanner-profile-detection.test.ts`
  - Verify: 12 plan-031 + 2 new alias = 14 PASS; no failures attributable to the rename.
  - Depends on: 4.1
  - Risk: Low (alias is identity)
- [ ] Step 4.7: `git diff --stat` matches expected file set. (S)
  - Expected paths (and ONLY these):
    - `scripts/lib/detect-project-language.ts` (rename + alias + `KADMON_PROJECT_PROFILE` env support)
    - `tests/eval/skanner-profile-detection.test.ts` (2 alias cases appended)
    - `.claude/agents/doks.md` (Step 0 + per-layer guards in Step 3 + Output Format additions + Step 2 cwd-only clause)
    - `.claude/commands/doks.md` (Arguments section + step descriptions)
    - `tests/lib/doks-profile-detection.test.ts` (NEW)
    - `docs/decisions/ADR-032-doks-project-agnostic.md` (already rewritten upstream)
    - `docs/plans/plan-032-doks-project-agnostic.md` (this file)
    - Optionally `.claude/skills/docs-sync/SKILL.md` (only if Phase 0.5 flagged a contradiction)
  - Verify: `git diff --stat main...HEAD` shows exactly the above; no kody scope creep, no `/medik` scope creep (plan-033 territory).
  - Depends on: 4.6
  - Risk: Low

### Test Plan (TDD targets)

| Phase | Test file | TDD step | Cases | Notes |
|------|-----------|----------|-------|-------|
| 1 | `tests/eval/skanner-profile-detection.test.ts` | RED 1.1 → GREEN 1.2 | 2 new (alias contract + parity) | Reuses existing tmpdir + stderr-spy harness |
| 3 | `tests/lib/doks-profile-detection.test.ts` (NEW) | After agent semantics defined | 8 (per ADR-032 markers + env override + alias + eligibility helper) | Unit-level for helpers; Phase 4 covers agent body E2E |
| 4 | Harness self-`/doks` snapshot diff | Behavioral regression backstop | 1 (byte-diff harness output pre/post) | Manual; `/tmp/doks-snapshot-{pre,post}.txt` |
| 4 | Consumer dogfood at `/tmp/scratch-web` | E2E behavioral verification | 1 (cwd-only enumeration, harness clean, plugin mtime stable) | Manual; transcript in PR body |

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Layer 2 false skip — consumer user expects rules edits to work and is surprised | Step 2.1 + Step 2.5 emit explicit NOTE: "Rules harness-shared (general for all projects). Update from harness self-/doks; install.sh re-run resyncs." Documented in CLAUDE.md after merge. |
| Harness self-`/doks` regression (catastrophic for downstream doks consumers) | Step 4.4 byte-diff snapshot is the gate. If diff shows non-additive changes, revert Phase 2 commits and re-design with strictly additive output. |
| Consumer corruption — `/doks` accidentally writes outside cwd | Step 4.5 stat-mtime check on plugin cache + harness git-status diff. Both must be empty post-run. ABORT-and-revert protocol if either diverges. |
| `KADMON_DOKS_PROFILE` collides with `KADMON_PROJECT_PROFILE` | Step 1.2 + Step 2.5 document precedence: explicit arg → `KADMON_DOKS_PROFILE` (agent-level) → `KADMON_PROJECT_PROFILE` (library-level umbrella) → `KADMON_SKANNER_PROFILE` (back-compat) → markers. Separation by tier prevents collision. |
| Plan-031 regression via rename | Step 1.1 RED test asserts `detectSkannerProfile === detectProjectProfile`; alias is function-reference identity. Step 1.3 grep regression sweep + Step 4.6 plan-031 test re-run are double gates. |
| Layer 2 user confusion — "why are rules read-only?" | Output NOTE includes the resync mechanism (`install.sh` re-run). README.md will document the rationale post-merge. |
| Plan-033 (medik) inheritance via alias breaks | Plan-033 plans to import `detectProjectProfile` directly; the alias preserves plan-031, the new symbol serves plan-033. Step 4.6 verifies both names resolve. |
| Monorepo misdetection (project nested inside harness clone or vice versa) | ADR-032 Risk #1 → env-var + explicit-arg override (proven from ADR-031). Step 2.5 documents the override syntax in command file. |

### Verification

**Mechanical**:
- `npx vitest run` — 1081 baseline + 2 + 8 = 1091 PASS (adjust to live Phase 0.7 baseline).
- `npx tsc --noEmit` — 0 errors.
- `npx eslint .` — 0 new errors.
- `/medik` Check #8 (agent frontmatter linter) — clean for doks agent.
- `/medik` Check #14 (capability-alignment) — clean.

**Behavioral**:
- Harness self-`/doks` snapshot byte-identical (additive-only diff for the new Profile + Layer eligibility output sections).
- Consumer dogfood at `/tmp/scratch-web`: profile detected as web/consumer, Layer 1 written, Layer 2 SKIP with NOTE, Layers 3-4 enumerate `local-test.md` only (NO harness 16 agents), plugin cache mtime unchanged, harness git status clean.
- Backward-compat: `tests/eval/skanner-profile-detection.test.ts` 14/14 PASS (12 existing + 2 new alias).

**Diff hygiene**:
- `git diff --stat main...HEAD` matches the expected 6-7 paths in Step 4.7.
- Conventional commit message includes `Reviewed: full` footer (per `git-workflow.md`).

### Acceptance Criteria

- [ ] All 7 file modifications complete:
  - [ ] `scripts/lib/detect-project-language.ts` — rename + alias + `KADMON_PROJECT_PROFILE` env support (with `KADMON_SKANNER_PROFILE` fallback)
  - [ ] `tests/eval/skanner-profile-detection.test.ts` — 2 alias parity cases appended
  - [ ] `.claude/agents/doks.md` — Workflow Step 0 + per-layer guards in Step 3 + cwd-only clause in Step 2 + Output Format additions
  - [ ] `.claude/commands/doks.md` — Arguments section + step description updates
  - [ ] `tests/lib/doks-profile-detection.test.ts` — NEW file with 8 cases
  - [ ] `docs/decisions/ADR-032-doks-project-agnostic.md` — already rewritten upstream
  - [ ] `docs/plans/plan-032-doks-project-agnostic.md` — this file
  - [ ] `.claude/skills/docs-sync/SKILL.md` — verified unchanged OR augmented per Phase 0.5 finding
- [ ] New test file passes: 8/8.
- [ ] Existing baseline tests still pass: full vitest run = baseline + 10.
- [ ] `npx tsc --noEmit` → 0 errors.
- [ ] `npx eslint .` → 0 new errors.
- [ ] `/medik` Check #8 frontmatter linter clean for doks agent edits.
- [ ] `/medik` Check #14 capability-alignment clean.
- [ ] Harness `/doks` snapshot byte-identical pre/post (additive-only diff for new sections).
- [ ] Manual consumer self-test in `/tmp/scratch-web`: Layer 1 sync confirmed, Layer 2 NOTE confirmed, Layers 3-4 cwd-only enumeration confirmed (`local-test.md` only), plugin cache mtime unchanged, harness git status clean post-run.
- [ ] Backward-compat: `import { detectSkannerProfile }` from plan-031 test still resolves and the function reference matches `detectProjectProfile`.
- [ ] `git diff --stat` shows only the expected paths (no kody scope creep, no `/medik` scope creep — that's plan-033).
- [ ] Conventional commit message includes `Reviewed: full` footer.
