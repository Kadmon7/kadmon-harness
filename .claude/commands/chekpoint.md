---
description: Save progress — tiered verification + review + commit and push (full/lite/skip)
agent: kody, typescript-reviewer, python-reviewer, spektr, orakle
skills: [verification-loop, coding-standards, receiving-code-review, safety-guard]
---

## Purpose
All-in-one quality gate and commit. Runs mechanical checks, invokes language-aware reviewers at the appropriate tier, consolidates findings, and only commits if everything passes. Absorbs the former /kcheck pipeline.

> **Note:** The command name `/chekpoint` (one 'c') is intentional — stylistic K-naming convention used across all harness commands.

## Tier Selection

Before executing, classify the diff scope and choose a tier. The authoritative tier matrix lives in `.claude/rules/common/development-workflow.md` (section "/chekpoint Tiers"). Summary:

- **Full** (default) — production code, refactors, schema, security, multi-file changes (5+). Runs all 4 phases with 4 reviewers in parallel + kody consolidation.
- **Lite** — test-only additions, single-file TS refactor <50 lines, small hook edits. Runs Phase 1 + ONE scope-matched reviewer only.
- **Skip** — docs-only, config-only, agent/rules metadata, typos, reverts. Runs Phase 1 verification + manual `git diff` review by Claude. No reviewers.

**Default when ambiguous: full.** Never apply Skip to anything touching runtime behavior.

User may override by saying `"chekpoint lite"`, `"skip chekpoint"`, etc. Document the selected tier in the commit message footer: `Reviewed: full` or `Reviewed: lite (ts-reviewer)` or `Reviewed: skip (verified mechanically)`.

### Tier branching

- **Full tier** → execute Phase 1, Phase 2a, Phase 2b, Phase 3, Phase 4 (all steps below)
- **Lite tier** → execute Phase 1, then a SINGLE Phase 2a reviewer (typescript-reviewer for test/TS; add spektr only if hook edit has security surface), skip Phase 2b (no consolidation needed), skip Phase 3 BLOCK gate unless that single reviewer reports BLOCK, execute Phase 4
- **Skip tier** → execute Phase 1 only, then do a manual `git diff` scan yourself (Claude), execute Phase 4 directly

## Steps

### Phase 1: Verification

Detect the project's toolchain at runtime, then run the appropriate build/typecheck/lint/test sequence. This is language-aware — per ADR-020 and the `detect-project-language.ts` module.

**Step 1: Detect toolchain.** Run:
```
npx tsx -e "import('./scripts/lib/detect-project-language.js').then(m=>console.log(JSON.stringify(m.getToolchain())))"
```
or read the toolchain from the compiled `dist/scripts/lib/detect-project-language.js`. Expected fields: `build`, `typecheck`, `test`, `lint`, `audit`, `language`.

**Step 1.5: Detect diff scope.** Run:
```
npx tsx -e "import('./scripts/lib/detect-project-language.js').then(async m => { const cp = await import('node:child_process'); const files = cp.execSync('git diff --staged --name-only', {encoding:'utf8'}).trim().split('\n').filter(Boolean); console.log(JSON.stringify(m.getDiffScope(files))); })"
```
Or use the equivalent compiled path from `dist/scripts/lib/detect-project-language.js`. Returns the `DiffScope` object with 8 boolean gates + rationale. **Always log the rationale at the start of Phase 1** so the user can see what will run and what will be skipped.

**Step 2: Run the 4 checks using the detected toolchain, gated by `DiffScope`.** For each step: if the corresponding `needs*` gate is `false`, log `(skipped: <rationale>)` instead of running. If the toolchain returns `null` (e.g. `build` for Python), skip with the existing `(skipped: no X step for <language>)` message. Conservative-by-default: ambiguous → run.

| # | Step | TypeScript toolchain | Python toolchain | Skip if |
|---|------|---------------------|------------------|---------|
| 1 | Build | `npm run build` | (skipped — null) | `!needsBuild` |
| 2 | Typecheck | `npx tsc --noEmit` | `mypy .` (fallback `pyright`) | `!needsTypecheck` |
| 3 | Test | `npx vitest run` | `pytest` | `!needsTests` |
| 4 | Lint | `npx eslint . --ext .ts,.js` (if configured) | `ruff check . && black --check .` (skip if tool missing) | `!needsLint` |

**Step 3: Stop at first failure** — report which step failed. Do NOT proceed.

> **Missing Python tooling**: if the project is Python and the required tool (`mypy`, `pytest`, `ruff`) is not installed, treat that step as WARN, not FAIL, and proceed. The user is responsible for installing their own toolchain; we only invoke.

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
- `/chekpoint full --force-ts-reviewer` — invoke typescript-reviewer regardless of `needsTypescriptReviewer`
- `/chekpoint full --force-python-reviewer` — invoke python-reviewer regardless of `needsPythonReviewer`
- `/chekpoint full --force-all` — restore current always-on behavior (all 4 specialists)

**Output**: Phase 2a logs which specialists were invoked vs skipped, mirroring the Phase 1 skip-logging pattern. Example:
```
Phase 2a specialists:
  typescript-reviewer: INVOKED (needsTypescriptReviewer: true — .ts files in diff)
  python-reviewer:     SKIPPED (needsPythonReviewer: false — no .py files in diff)
  spektr:              SKIPPED (needsSpektr: false — no auth/exec/path/SQL keywords)
  orakle:              SKIPPED (needsOrakle: false — no SQL/schema/migration/Supabase touch)
Override flags applied: none
```

### Phase 2b: Consolidation (sequential — AFTER 2a completes)
1. **WAIT** for ALL Phase 2a reviewers to complete. Do NOT invoke kody in parallel with them.
2. Invoke **kody** (sonnet) with the findings from every Phase 2a reviewer included in its prompt.
3. kody deduplicates, prioritizes, and assigns severity: BLOCK / WARN / NOTE, **subject to the Upstream BLOCK Preservation rule** in `.claude/agents/kody.md`. kody MAY consolidate duplicate BLOCKs and MAY escalate, but MUST NOT downgrade or suppress any BLOCK emitted by a Phase 2a specialist.
4. Preserve the raw Phase 2a findings alongside kody's consolidated output — both sets are inputs to the Phase 3 gate.

### Phase 3: Gate Decision (dual check)

The gate is computed against BOTH the raw Phase 2a reviewer output AND kody's consolidated output. This prevents any silent loss of a specialist BLOCK during consolidation.

If a specialist was skipped per `DiffScope`, it contributes 0 BLOCKs to `rawBlocks`. The dual-gate logic is unaffected — `rawBlocks` is the union of BLOCKs from *invoked* specialists only.

1. Collect `rawBlocks` = set of BLOCK findings emitted by any Phase 2a specialist that was actually invoked (typescript-reviewer, python-reviewer, spektr, orakle).
2. Collect `kodyBlocks` = set of BLOCK findings in kody's consolidated output.
3. **If `rawBlocks` is non-empty OR `kodyBlocks` is non-empty** → STOP. Do NOT commit. Report both sets separately in the output so the user sees if consolidation dropped anything.
4. **If `kodyBlocks.count < rawBlocks.count`** → flag explicitly as `kody consolidated N BLOCKs → M BLOCKs; verify deduplication was correct` and STOP for manual review, even when (3) already would have fired. This surfaces suspicious consolidation even if the counts happened to align by coincidence.
5. **WARN only** (no BLOCK in either set) → report warnings, proceed to commit.
6. **NOTE only or clean** → proceed to commit.

Rationale: Fix A (preservation rule in kody.md) prevents downgrades at the prompt level; this dual gate is the mechanical safety net if the prompt is ignored or edited out. See `.claude/agents/kody.md` → "Upstream BLOCK Preservation" for the authoritative rule.

### Phase 4: Commit and Push
1. `git add -A`
2. Ask user for commit description
3. Format as conventional commit: `feat|fix|docs|chore|refactor|test: description`
4. `git commit -m "type(scope): description"`
5. `git push`

## Output
Verification results + review summary + commit hash + push confirmation.

## Example
```
## Phase 1: Verification
Build:     PASS
Typecheck: PASS
Tests:     180 passing, 0 failing
Lint:      PASS

## Phase 2a: Specialist Review (3 reviewers)
typescript-reviewer: 1 NOTE
spektr:   0 issues
orakle:   0 issues

## Phase 2b: Consolidation (kody)
kody: 0 BLOCK, 0 WARN, 1 NOTE — APPROVED

## Phase 3: Gate (dual check)
Raw Phase 2a BLOCKs:   0
kody consolidated BLOCKs: 0
Delta: 0 (no consolidation drop)
Verdict: 0 BLOCK, 0 WARN, 1 NOTE — APPROVED

## Phase 4: Commit
Commit: feat(instincts): add export functionality
Hash:   abc1234
Pushed: origin/main
```
