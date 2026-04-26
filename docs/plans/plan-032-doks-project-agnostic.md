---
number: 32
title: /doks project-agnostic via runtime profile detection + symlink protection
date: 2026-04-26
status: pending
needs_tdd: true
route: A
adr: ADR-032-doks-project-agnostic.md
---

## Plan: /doks project-agnostic via runtime profile detection + symlink protection [konstruct]

### Overview

Make `/doks` safe and useful in consumer projects by (1) renaming `detectSkannerProfile` to the generic `detectProjectProfile` (with a deprecated alias so plan-031 imports keep working), (2) adding an `isSymlink()` helper, and (3) refactoring the doks agent + command to detect profile at runtime and skip writes to symlinked layers in consumer projects. Layer 1 (`CLAUDE.md`, `README.md`) always syncs; Layers 2-4 are read-only when their `.claude/<type>/` dir resolves to a symlink (the canonical root symlink shape from ADR-019). Harness self-`/doks` behavior must remain byte-identical (snapshot gated).

### Assumptions

- ADR-032 is on disk and accepted as the authoritative spec for this plan — validated by reading `docs/decisions/ADR-032-doks-project-agnostic.md`.
- `scripts/lib/detect-project-language.ts` currently exports `detectSkannerProfile` and `SkannerProfile` (lines 120-257) — validated by reading the file.
- `tests/eval/skanner-profile-detection.test.ts` imports `detectSkannerProfile` and 16 cases pass on `main` — validated by reading the test (16 `it` blocks counted: 12 numbered + 4 trailing diagnostic/invalid-input cases).
- Plan-031 stays green via the alias `export const detectSkannerProfile = detectProjectProfile` (same function reference, no behavioral change).
- `/doks` execution lives in the agent body (`.claude/agents/doks.md`); the command file (`.claude/commands/doks.md`) is a thin invocation wrapper. Both ship in this plan.
- `isSymlink()` belongs co-located in `detect-project-language.ts` because (a) it is consumed by the same callers, (b) creating `path-helpers.ts` for one function is premature, (c) ADR-032 explicitly lists `detect-project-language.ts` as the implementation site. Re-evaluate if a third caller emerges.
- Harness layer dirs (`.claude/agents/`, `.claude/skills/`, `.claude/commands/`) are NOT symlinks in the harness self-repo — they ARE symlinks per ADR-019, so the harness self-test must verify behavior in the symlinked-self case, NOT a regular-dir case. **Re-confirm during Phase 0 by running `node -e "console.log(require('node:fs').lstatSync('.claude/agents').isSymbolicLink())"` from the harness root.** If true, the doks agent must treat `harness` profile + symlink layers as writable (harness self-edit IS the allowed case); only `consumer` profile + symlink layers are read-only.
- Test count baseline: 1069 + 12 plan-031 = 1081 currently green. New file adds 12 cases → 1093 target. (User-supplied target of 1081 was based on a different baseline; this plan tracks against the actual baseline observed at Phase 0.)
- Windows `lstatSync` correctly identifies the canonical root symlinks created by `install.sh`/`install.ps1` per ADR-019 + Developer Mode requirement. If junctions are encountered, fall back to `realpath`-based detection (deferred — ADR-032 Risk #3 documents the mitigation).

### Phase 0: Research

- [ ] Step 0.1: Read ADR-032 in full to internalize per-layer detection rules and override precedence.
  - File: `docs/decisions/ADR-032-doks-project-agnostic.md`
  - Verify: Decision section enumerates 8 rules; Risks section enumerates 5 mitigations.
  - Depends on: none
  - Risk: Low
  - Complexity: S
- [ ] Step 0.2: Read current `scripts/lib/detect-project-language.ts` to confirm export surface and pick the rename insertion point.
  - File: `scripts/lib/detect-project-language.ts`
  - Verify: `detectSkannerProfile` is at lines ~154-257; `SkannerProfile` type at ~120; no `isSymlink` symbol exists.
  - Depends on: none
  - Risk: Low
  - Complexity: S
- [ ] Step 0.3: Read current doks agent body and command spec to know what to refactor.
  - Files: `.claude/agents/doks.md`, `.claude/commands/doks.md`
  - Verify: agent has Workflow steps 1-4 + Documentation Files table with 4 layers; command has 8 numbered steps.
  - Depends on: none
  - Risk: Low
  - Complexity: S
- [ ] Step 0.4: Read `tests/eval/skanner-profile-detection.test.ts` to mirror its tmpdir + stderr-spy pattern in the new doks test.
  - File: `tests/eval/skanner-profile-detection.test.ts`
  - Verify: `makeTmpDir`, `writeMarker`, `cleanProfileEnv`, `getDiagnostic` helpers identified for reuse.
  - Depends on: none
  - Risk: Low
  - Complexity: S
- [ ] Step 0.5: Read `.claude/skills/docs-sync/SKILL.md` to confirm whether its description contradicts the new symlink-aware model.
  - File: `.claude/skills/docs-sync/SKILL.md`
  - Verify: skill describes "what to sync" not "where to write" — if no instructions about layer write-targets, no edit needed (most likely outcome). If it DOES specify writing to `.claude/skills/*` unconditionally, edit follows in Phase 2.
  - Depends on: none
  - Risk: Low
  - Complexity: S
- [ ] Step 0.6: Confirm baseline test count and harness layer-dir symlink status.
  - Commands: `npx vitest run 2>&1 | tail -5`, `node -e "['agents','skills','commands'].forEach(d => console.log(d, require('node:fs').lstatSync('.claude/'+d).isSymbolicLink()))"`
  - Verify: tests = 1081 (or current), record actual; harness `.claude/{agents,skills,commands}` symlink booleans recorded for Phase 4 self-test.
  - Depends on: 0.1-0.5
  - Risk: Low
  - Complexity: S

### Phase 1: Detection rename + isSymlink helper (TDD)

This phase is RED-GREEN-REFACTOR. Write the failing test first, then ship the rename + helper.

- [ ] Step 1.1: Add a backward-compat alias test case in plan-031's existing test file.
  - File: `tests/eval/skanner-profile-detection.test.ts`
  - Action: Append two `it` blocks at the bottom of the existing describe block:
    1. `"detectSkannerProfile is the same reference as detectProjectProfile (alias contract)"` — imports both and asserts `detectSkannerProfile === detectProjectProfile`.
    2. `"detectProjectProfile behaves identically to detectSkannerProfile for the harness case"` — runs both with the same tmpDir + harness marker, asserts both return `'harness'`.
  - Verify: `npx vitest run tests/eval/skanner-profile-detection.test.ts` — RED (new symbol `detectProjectProfile` does not exist yet → "is not a function" or import resolution error).
  - Depends on: 0.6
  - Risk: Low (test-only change, mirrors existing pattern)
  - Complexity: S
- [ ] Step 1.2: Rename `detectSkannerProfile` → `detectProjectProfile`, add deprecated alias, add `isSymlink()` helper, rename type.
  - File: `scripts/lib/detect-project-language.ts`
  - Actions:
    1. Rename function `detectSkannerProfile` → `detectProjectProfile` (function signature unchanged).
    2. Rename type `SkannerProfile` → `ProjectProfile`. Add `export type SkannerProfile = ProjectProfile;` deprecated alias.
    3. Rename internal const `VALID_SKANNER_PROFILES` → `VALID_PROJECT_PROFILES`; rename type guard `isSkannerProfile` → `isProjectProfile`.
    4. Update internal env-var lookup from `KADMON_SKANNER_PROFILE` to `KADMON_PROJECT_PROFILE` **only as a NEW primary read; keep `KADMON_SKANNER_PROFILE` as fallback** to preserve plan-031 behavior. Order: explicit arg → `KADMON_PROJECT_PROFILE` → `KADMON_SKANNER_PROFILE` → markers. (ADR-032 Risk #5 documents future unification; this plan keeps both env vars working.)
    5. Append: `export const detectSkannerProfile = detectProjectProfile;` with JSDoc `@deprecated Use detectProjectProfile (same function — alias preserved for plan-031 imports).`
    6. Add `export function isSymlink(p: string): boolean { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } }` immediately below the helper section. JSDoc notes: returns `false` for non-existent paths; treats `lstat` errors (permission, ENOENT) as `false`.
    7. Update top-of-file comment block to mention ADR-032.
  - Verify: `npx vitest run tests/eval/skanner-profile-detection.test.ts` — GREEN (16 plan-031 + 2 new alias cases = 18). `npx tsc --noEmit` clean.
  - Depends on: 1.1
  - Risk: Medium (rename touches a heavily-used function; alias must preserve identity)
  - Complexity: M
- [ ] Step 1.3: Regression smoke — confirm `/skanner` test consumers still resolve.
  - Files: any file under `scripts/` or `.claude/` that imports `detectSkannerProfile` or `SkannerProfile`.
  - Commands: `grep -rn "detectSkannerProfile\|SkannerProfile" scripts/ .claude/ tests/ docs/` — record all hit sites; verify all still resolve via the alias.
  - Verify: full `npx vitest run` — 1081 (or current baseline) + 2 = 1083 PASS, no failures attributable to the rename.
  - Depends on: 1.2
  - Risk: Low (alias is identity)
  - Complexity: S

### Phase 2: Doks agent + command refactor

The agent body is the orchestrator; the command is the entry point spec. Both must reflect symlink-aware behavior.

- [ ] Step 2.1: Add Workflow Step 0 to doks agent — runtime profile + per-layer symlink detection.
  - File: `.claude/agents/doks.md`
  - Action: Insert a new section between "## Workflow" header and "### 1. Understand What Changed":
    ```
    ### 0. Detect profile and per-layer write-eligibility (ADR-032)

    Before any layer scan:

    1. Resolve profile via `detectProjectProfile(cwd, explicitArg)` from `scripts/lib/detect-project-language.ts`. Precedence: explicit `/doks <profile>` arg → `KADMON_DOKS_PROFILE` → `KADMON_PROJECT_PROFILE` → markers → fallback `'web'`. (Map `'web'` and `'cli'` to consumer behavior; only `'harness'` activates harness write-mode.)
    2. For each layer dir in {`.claude/agents/`, `.claude/skills/`, `.claude/commands/`}, run `isSymlink(path)`:
       - `harness` profile + symlink: WRITABLE (harness self-edit is the legitimate case).
       - `harness` profile + regular dir: WRITABLE (harness without symlinks — should not occur in distribution but tolerate).
       - consumer profile + symlink: READ-ONLY. Emit `WARN: Layer N (.claude/<type>/) is a symlink to harness install — skipping`.
       - consumer profile + regular dir: WRITABLE (consumer forked locally — sync as fork).
    3. Layer 1 (`CLAUDE.md`, `README.md`) is ALWAYS writable regardless of profile (project-root files, never symlinked).
    4. Print a per-layer eligibility summary at the start of the run so the user sees what will and will not sync.
    ```
  - Verify: `grep -n "Step 0\|detectProjectProfile\|isSymlink" .claude/agents/doks.md` — at least 3 hits.
  - Depends on: 1.2
  - Risk: Low (additive)
  - Complexity: M
- [ ] Step 2.2: Update doks agent Workflow Step 3 ("Update Documentation") with per-layer guards.
  - File: `.claude/agents/doks.md`
  - Action: Modify Priority 1 / Priority 2 / Priority 3 instructions to gate Layer 2-4 writes on the eligibility map from Step 0. Add an explicit clause: "If a Layer is READ-ONLY per Step 0, describe the change in the output but DO NOT call Write/Edit on files inside that layer dir." Update the existing Documentation Files table to add a "Write-eligibility" column with values `always`, `profile-dependent`, mirroring ADR-032 §Decision.
  - Verify: `grep -n "READ-ONLY\|symlink" .claude/agents/doks.md` — at least 4 hits across Steps 0 and 3.
  - Depends on: 2.1
  - Risk: Medium (gating logic must NOT regress harness self-`/doks` — Phase 4 snapshot covers this)
  - Complexity: M
- [ ] Step 2.3: Update doks agent Output Format to include profile + per-layer eligibility.
  - File: `.claude/agents/doks.md`
  - Action: Append two sections to the existing `## Output Format` template:
    ```
    ### Profile (ADR-032)
    - Profile: harness | consumer (source: arg | env | markers)
    - Layer eligibility:
      - Layer 1 (CLAUDE.md, README.md): writable
      - Layer 2 (rules/): writable | read-only (symlink)
      - Layer 3 (commands/): writable | read-only (symlink)
      - Layer 4 (skills/): writable | read-only (symlink)

    ### Read-only layer warnings
    [List of layers skipped with WARN message; empty when harness profile.]
    ```
  - Verify: `grep -n "Profile (ADR-032)\|Layer eligibility" .claude/agents/doks.md` → both hit.
  - Depends on: 2.2
  - Risk: Low
  - Complexity: S
- [ ] Step 2.4: Update doks command file Arguments + Steps with profile override + symlink semantics.
  - File: `.claude/commands/doks.md`
  - Action:
    1. Add an `## Arguments` section before `## Purpose`:
       ```
       ## Arguments
       - `harness | consumer` — explicit profile override (highest precedence). Optional.
       - `KADMON_DOKS_PROFILE=harness|consumer` — env var fallback (medium precedence).
       - Without args: profile detected from filesystem markers (`detectProjectProfile`).
       ```
    2. Replace step 1 with: `1. Invoke **doks agent** (opus) — agent runs Step 0 profile detection + per-layer symlink check (ADR-032).`
    3. After step 2, insert: `2a. Per-layer eligibility computed (Layer 1 always writable; Layers 2-4 writable only when profile=harness OR layer dir is not a symlink).`
    4. Update steps 4-6 (Layer 2-4) descriptions to include `(skipped with WARN if read-only per Step 2a)`.
  - Verify: `grep -n "harness | consumer\|KADMON_DOKS_PROFILE\|symlink" .claude/commands/doks.md` — at least 3 hits.
  - Depends on: 2.3
  - Risk: Low (spec-only change)
  - Complexity: S
- [ ] Step 2.5: Verify or update `docs-sync` skill if its description contradicts the new write-target model.
  - File: `.claude/skills/docs-sync/SKILL.md`
  - Action: If Phase 0 Step 0.5 found no contradiction, no edit. If a contradiction exists (e.g. "always writes to all 4 layers"), insert a brief note: "Write-eligibility per layer is determined at runtime by the doks agent (ADR-032). This skill describes WHAT to sync; the agent decides WHERE."
  - Verify: skill content read and either left unchanged or augmented as above.
  - Depends on: 2.4
  - Risk: Low
  - Complexity: S

### Phase 3: New profile detection + symlink test file

- [ ] Step 3.1: Write `tests/lib/doks-profile-detection.test.ts` with the 12 mandated cases.
  - File: `tests/lib/doks-profile-detection.test.ts` (NEW)
  - Action: Create test file mirroring plan-031's helpers (`makeTmpDir`, `writeMarker`, `cleanProfileEnv`, `getDiagnostic`). Add a new helper `makeSymlink(target: string, linkPath: string)` using `fs.symlinkSync(target, linkPath, 'dir')` (Windows requires Developer Mode — document at top of file). Cases:
    1. `detectProjectProfile()` returns `'harness'` for harness markers — proves the renamed function reuses the existing detection logic.
    2. `isSymlink()` returns `true` for a symlink dir created via `fs.symlinkSync`.
    3. `isSymlink()` returns `false` for a regular directory created via `fs.mkdirSync`.
    4. `isSymlink()` returns `false` for a non-existent path (no throw).
    5. Doks orchestrator simulation — harness profile + regular layer dirs → all 4 layers eligible. (Implement as a small helper inside the test file: `computeLayerEligibility(profile, dirPaths)` returning `{ layer1: 'writable', layer2: 'writable' | 'read-only', ... }`. Document in test comments that the helper mirrors the agent body's Step 0 logic and is the unit-level expression of agent behavior.)
    6. Doks orchestrator: consumer profile + Layer 2 symlink → Layer 1 + 3 + 4 writable, Layer 2 read-only.
    7. Doks orchestrator: consumer profile + Layer 3 forked (regular dir) + Layer 2/4 symlinks → Layers 1 + 3 writable, Layers 2 + 4 read-only.
    8. Mixed: Layer 2 symlink, Layer 3 forked, Layer 4 symlink → only Layers 1+3 writable.
    9. `KADMON_DOKS_PROFILE=consumer` in harness-marker tmp dir → `detectProjectProfile` honors override, returns `'web'` or whatever consumer alias maps to. (Verify exact alias mapping in the agent body — the function returns `harness | web | cli`; the agent maps `web|cli` to "consumer" for write-mode purposes.)
    10. Explicit arg beats env override (mirrors plan-031 case 11 with the new env var name).
    11. Backward-compat: `import { detectSkannerProfile } from "..."` resolves and `detectSkannerProfile === detectProjectProfile` (proven once in plan-031 file; included here too as a smoke).
    12. Windows path handling: `lstatSync` on a path with backslashes (`path.join(tmpDir, 'sub\\dir')` on Win32, `path.join(tmpDir, 'sub/dir')` on Unix) does not throw and returns the expected boolean.
  - Verify: `npx vitest run tests/lib/doks-profile-detection.test.ts` — 12/12 PASS.
  - Depends on: 1.2 (helpers exist), 2.1-2.4 (orchestrator semantics defined; helper mirrors them)
  - Risk: Medium (Windows symlink behavior under Developer Mode is the dependency — fallback: skip cases 2-4 with `it.skipIf(process.platform === 'win32' && !canSymlink())` if the runner can't create symlinks)
  - Complexity: M
- [ ] Step 3.2: Document the agent-body-vs-test-helper boundary in the test file's header comment.
  - File: `tests/lib/doks-profile-detection.test.ts`
  - Action: Add a top-of-file comment explaining: "The doks agent body is markdown — directly testing the agent requires running `/doks` end-to-end (Phase 4 manual verification). This file unit-tests the helpers `detectProjectProfile`, `isSymlink`, and a simulated `computeLayerEligibility` that mirrors the agent's Step 0 logic. Drift between this helper and the agent body is caught by Phase 4 self-test snapshot + consumer dogfood."
  - Verify: `head -20 tests/lib/doks-profile-detection.test.ts` shows the contract comment.
  - Depends on: 3.1
  - Risk: Low
  - Complexity: S

### Phase 4: Verification

Mechanical + behavioral verification before declaring done.

- [ ] Step 4.1: Mechanical — full vitest, tsc, eslint clean.
  - Commands: `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`
  - Verify: 1081 (current baseline) + 2 (Phase 1 alias cases) + 12 (Phase 3 new file) = 1095 PASS. Zero `tsc` errors. Zero new eslint errors. Adjust target if Phase 0 baseline differs.
  - Depends on: 3.2
  - Risk: Low
  - Complexity: S
- [ ] Step 4.2: /medik Check #8 frontmatter linter clean for the doks agent edits.
  - Command: `npx tsx scripts/lib/lint-agent-frontmatter.ts` (or whichever entry point Check #8 uses; verify via `grep -rn "Check #8\|lint-agent-frontmatter" scripts/`)
  - Verify: doks agent frontmatter unchanged; linter PASS.
  - Depends on: 4.1
  - Risk: Low
  - Complexity: S
- [ ] Step 4.3: /medik Check #14 capability-alignment clean.
  - Command: invoke `/medik` Check #14 OR run its underlying script directly.
  - Verify: doks agent skills (`docs-sync`, `skill-stocktake`, `rules-distill`, `code-tour`) remain aligned with `tools:` declaration; no `requires_tools:` mismatch.
  - Depends on: 4.2
  - Risk: Low
  - Complexity: S
- [ ] Step 4.4: Harness self-test snapshot — capture pre-edit `/doks` output, then post-edit, byte-diff.
  - Action:
    1. **Before any Phase 1-3 edits land**, on a clean checkout of the pre-change state, capture: `<run /doks dry-run or read-only mode in harness root> > /tmp/doks-snapshot-pre.txt`. (If `/doks` has no dry-run mode, snapshot the agent's stdout up to the first Write/Edit invocation, OR run `git stash` after the run to discard side effects.)
    2. After Phase 1-3 ship, repeat with the new code: `> /tmp/doks-snapshot-post.txt`.
    3. `diff /tmp/doks-snapshot-pre.txt /tmp/doks-snapshot-post.txt` — must show ONLY additive lines for the new "Profile" + "Layer eligibility" sections in the output. Existing per-file documentation update lines must be byte-identical.
  - Verify: diff output reviewed manually; no removed or modified pre-existing lines.
  - Depends on: 4.3
  - Risk: High (this is the regression backstop for harness use case — failure here means agent body refactor changed behavior)
  - Mitigation: if snapshot diff fails, `git revert` Phase 2 commits and re-design Step 2.2 with stricter additive-only changes.
  - Complexity: M
- [ ] Step 4.5: Consumer dogfood (manual).
  - Action:
    1. `mkdir -p /tmp/scratch-web && cd /tmp/scratch-web && npm init -y && npm pkg set dependencies.react=^18`.
    2. Run the harness installer to plant `.claude/` symlinks: `bash <harness-root>/install.sh` (or platform equivalent).
    3. Verify `lstatSync('.claude/agents').isSymbolicLink() === true` via `node -e ...`.
    4. Run `/doks` (with the new agent body) in this scratch project.
    5. Confirm in output:
       - Profile detected as `web` / consumer.
       - Layer 1 (CLAUDE.md, README.md) WRITTEN.
       - Layers 2-4 emit `WARN: ... symlink to harness install — skipping`.
       - No files inside `.claude/agents/`, `.claude/skills/`, `.claude/commands/` modified (verify via `git -C <harness-root> status` — must show clean).
  - Verify: harness git status clean post-run; `/tmp/scratch-web/CLAUDE.md` exists or was updated; consumer-side console shows 3 WARN messages for Layers 2-4.
  - Depends on: 4.4
  - Risk: High (this is the catastrophic-corruption test from ADR-032 §Context — if harness git status shows modifications, ABORT and revert)
  - Mitigation: run from a fresh harness checkout under git so revert is one command away. Capture full transcript in `/tmp/doks-dogfood.txt` for the PR description.
  - Complexity: M
- [ ] Step 4.6: Backward-compat sanity — plan-031's existing test still passes.
  - Command: `npx vitest run tests/eval/skanner-profile-detection.test.ts`
  - Verify: 16 plan-031 + 2 new alias cases = 18 PASS; no failures attributable to the rename.
  - Depends on: 4.1
  - Risk: Low (alias preserves identity)
  - Complexity: S
- [ ] Step 4.7: `git diff --stat` matches the expected file set.
  - Expected paths (and ONLY these):
    - `scripts/lib/detect-project-language.ts` (rename + alias + isSymlink)
    - `tests/eval/skanner-profile-detection.test.ts` (2 alias cases appended)
    - `.claude/agents/doks.md` (Step 0 + gated Step 3 + Output Format additions)
    - `.claude/commands/doks.md` (Arguments section + step descriptions)
    - `tests/lib/doks-profile-detection.test.ts` (new file)
    - Optionally `.claude/skills/docs-sync/SKILL.md` (only if Phase 0 Step 0.5 flagged a contradiction)
  - Verify: `git diff --stat main...HEAD` shows exactly the above; no kody scope creep, no `/medik` scope creep (which is plan-033 territory).
  - Depends on: 4.6
  - Risk: Low
  - Complexity: S

### Test Plan (TDD targets)

| Phase | Test file | TDD step | Cases | Notes |
|------|-----------|----------|-------|-------|
| 1 | `tests/eval/skanner-profile-detection.test.ts` | RED 1.1 → GREEN 1.2 | 2 new (alias contract + parity) | Reuses existing tmpdir + stderr-spy harness |
| 3 | `tests/lib/doks-profile-detection.test.ts` (NEW) | After agent semantics defined | 12 (per ADR-032 + symlink scenarios) | Unit-level for helpers; Phase 4 covers agent body E2E |
| 4 | Harness self-`/doks` snapshot diff | Behavioral regression backstop | 1 (byte-diff harness output pre/post) | Manual; `/tmp/doks-snapshot-{pre,post}.txt` |
| 4 | Consumer dogfood at `/tmp/scratch-web` | E2E behavioral verification | 1 (3 layers WARN, harness clean) | Manual; transcript in PR body |

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Rename breaks an unknown caller of `detectSkannerProfile` | Step 1.3 grep regression; alias is identity, so behavior is preserved as long as the import resolves. Full vitest run catches any import path issues. |
| Harness self-`/doks` behavior drifts (catastrophic for snapshot) | Step 4.4 byte-diff is the gate. If diff fails, revert Phase 2 commits and re-design with strictly additive output changes. |
| Consumer dogfood corrupts harness | Step 4.5 verifies harness git status is clean. Run from fresh harness checkout under git so revert is one command. ABORT-and-revert protocol documented. |
| Windows symlink creation in tests fails (Developer Mode not enabled in CI) | Step 3.1 plans `it.skipIf(process.platform === 'win32' && !canSymlink())` fallback for cases 2-4. Verify CI Windows matrix has Developer Mode before relying on these cases. |
| `KADMON_DOKS_PROFILE` collides with `KADMON_PROJECT_PROFILE` precedence | Step 1.2 documents the order: explicit arg → `KADMON_PROJECT_PROFILE` → `KADMON_SKANNER_PROFILE` → markers. `KADMON_DOKS_PROFILE` is the doks-command override layer that the agent reads BEFORE calling `detectProjectProfile`, so collision is avoided by separating "command-arg-equivalent" (DOKS) from "library-level override" (PROJECT). |
| Mixed-state layer dirs (regular dir with symlinked children) | ADR-032 Risk #4 ruled: top-level dir is truth. Documented in Step 2.1; tests case 7 covers the explicit "forked dir wins" scenario. |
| Agent body refactor introduces a subtle skip on a layer that should sync | Phase 4 Step 4.4 snapshot + Step 4.5 dogfood are two independent gates; agreement between them is the green light. |
| Plan-031 test file edit conflicts with concurrent work | Plan-031 is shipped; only the bottom of the describe block is touched. Run `git fetch && git rebase` immediately before Phase 1 to detect upstream drift. |

### Verification

**Mechanical**:
- `npx vitest run` — 1081 baseline + 2 + 12 = 1095 PASS (adjust to actual baseline from Phase 0).
- `npx tsc --noEmit` — 0 errors.
- `npx eslint .` — 0 new errors.
- `/medik` Check #8 (agent frontmatter linter) — clean for doks agent.
- `/medik` Check #14 (capability-alignment) — clean.

**Behavioral**:
- Harness self-`/doks` snapshot byte-identical (additive-only diff for the new Profile + Layer eligibility output sections).
- Consumer dogfood at `/tmp/scratch-web`: profile=web detected, Layer 1 written, Layers 2-4 WARN, harness git status clean.
- Backward-compat: `tests/eval/skanner-profile-detection.test.ts` 18/18 PASS (16 existing + 2 new alias).

**Diff hygiene**:
- `git diff --stat main...HEAD` matches the expected 5-6 paths in Step 4.7.

### Acceptance Criteria

- [ ] All 6 file modifications complete:
  - [ ] `scripts/lib/detect-project-language.ts` — rename + alias + `isSymlink()` + `KADMON_PROJECT_PROFILE` env support (with `KADMON_SKANNER_PROFILE` fallback)
  - [ ] `tests/eval/skanner-profile-detection.test.ts` — 2 alias parity cases appended
  - [ ] `.claude/agents/doks.md` — Workflow Step 0 + per-layer write gates in Step 3 + Output Format additions
  - [ ] `.claude/commands/doks.md` — Arguments section + step description updates
  - [ ] `tests/lib/doks-profile-detection.test.ts` — new file with 12 cases
  - [ ] `.claude/skills/docs-sync/SKILL.md` — verified unchanged OR augmented per Phase 0 Step 0.5 finding
- [ ] New test file passes: 12/12.
- [ ] Existing baseline tests still pass: full vitest run = baseline + 14.
- [ ] `npx tsc --noEmit` → 0 errors.
- [ ] `/medik` Check #8 frontmatter linter clean for doks agent edits.
- [ ] `/medik` Check #14 capability-alignment clean.
- [ ] Harness `/doks` snapshot byte-identical pre/post (additive-only diff for new sections).
- [ ] Manual consumer self-test in `/tmp/scratch-web`: Layer 1 sync confirmed, Layer 2-4 symlink WARN confirmed, harness git status clean post-run.
- [ ] Backward-compat: `import { detectSkannerProfile }` from plan-031 test still resolves and the function reference matches `detectProjectProfile`.
- [ ] `git diff --stat` shows only the expected paths (no kody scope creep, no `/medik` scope creep — that's plan-033).
- [ ] Conventional commit message includes `Reviewed: full` footer (per `git-workflow.md`).
