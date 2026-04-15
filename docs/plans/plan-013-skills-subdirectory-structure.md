---
number: 13
title: Skills migration from .claude/skills/<name>.md to .claude/skills/<name>/SKILL.md
date: 2026-04-14
status: pending
needs_tdd: false
route: A
adr: ADR-013-skills-subdirectory-structure.md
---

# Plan 013: Skills Subdirectory Structure Migration [konstruct]

## Overview

This plan implements ADR-013 by migrating the 46 files at `.claude/skills/<name>.md` to the Anthropic-prescribed layout `.claude/skills/<name>/SKILL.md`, fixing two hardcoded path references in executable docs, repairing the linter built under plan-012, and embedding empirical pre/post migration kody spawn outputs as proof that native skill injection transitions from `BROKEN` to `WORKING`. The decision is pre-made upstream (Anthropic docs are prescriptive) and the 3-commit sequence has been validated by a Plan-mode agent — see `ADR-013-skills-subdirectory-structure.md` and the pre-flight analysis in `C:\Users\kadmo\.claude\plans\eventual-imagining-sunset.md`. `needs_tdd: false` because the migration is purely mechanical (`git mv` + docs + linter path fix) and the linter already has 13 green test cases from plan-012 — the only new test work is adjusting the existing `writeSkill()` fixture helper to the new path shape.

## Prerequisites

These MUST be satisfied before Step 1. If any fails, HALT and resolve before proceeding.

- [ ] **R6 mitigation — parallel session sync.** Run `git fetch && git status`. Working tree MUST be clean and local `main` MUST be aligned with `origin/main`. If the parallel session has uncommitted changes in `CLAUDE.md`, `README.md`, `.claude/rules/common/agents.md`, `.claude/rules/common/development-workflow.md`, `.claude/skills/security-scan.md`, `.claude/agents/mekanik.md`, or `.claude/commands/medik.md`, wait for that session to commit/push and then `git pull --ff-only`. DO NOT start the migration on top of a dirty tree — the 46 `git mv` operations will tangle with unrelated edits.
- [ ] **Empirical baseline — pre-migration kody spawn.** Before any file movement, spawn `kody` via the Agent tool with the canonical probe prompt (see Step 17 for exact text). Capture the FULL output to a scratch buffer. Expected result: `INJECTION_STATUS: BROKEN` with kody correctly reporting that its 5 declared skills did not arrive as readable file content. This baseline is embedded in Commit 3's body as the "before" half of the proof pair. If kody surprisingly reports `WORKING` here, the entire premise of ADR-013 is invalidated and the plan HALTS pending reinvestigation.
- [ ] **ADR-013 reviewed.** Confirm `docs/decisions/ADR-013-skills-subdirectory-structure.md` exists, is at `status: proposed`, and that its Concrete Changes section matches this plan's scope.
- [ ] **Node + git + vitest available.** `node --version`, `git --version`, `npx vitest --version` all succeed in Git Bash.

## Scope

**Moved (46 files):** every `.claude/skills/<name>.md` → `.claude/skills/<name>/SKILL.md` via `git mv`. Rename history preserved.

**Modified (5 files):**

- `.claude/agents/kerka.md` — line 75 path reference (`deep-research.md` → `deep-research/SKILL.md`)
- `.claude/commands/kompact.md` — line 60 path reference (`postgres-patterns.md` → `postgres-patterns/SKILL.md`)
- `scripts/lib/lint-agent-frontmatter.ts` — line 109 path construction + line 4 docstring
- `tests/lib/lint-agent-frontmatter.test.ts` — `writeSkill()` helper (lines 31-33)
- `.claude/rules/common/agents.md` — Skill Loading section path examples + docs link + ADR-013 cross-reference
- (conditional) `CLAUDE.md` — only if grep finds a residual `.claude/skills/<name>.md` pattern; most likely a no-op

**New files:** zero. ADR-013 already exists from the arkitect hand-off. Plan-013 is a pure mutation, no new artifacts.

**Read-only references:**

- `docs/decisions/ADR-013-skills-subdirectory-structure.md` — the decision being implemented
- `docs/decisions/ADR-012-skill-frontmatter-syntax-fix.md` — partially superseded; cross-link target
- `https://code.claude.com/docs/en/skills` — upstream prescription
- `~/.claude/plugins/cache/claude-plugins-official/skill-creator/unknown/skills/skill-creator/SKILL.md` — ground-truth layout reference

## Phase 0: Research

All Phase 0 items are marked complete pre-plan because this is an unusually well-researched task — the Plan-mode agent already read every relevant file and the arkitect already produced ADR-013. Konstruct's job is formalization, not rediscovery.

- [x] Read `docs/decisions/ADR-013-skills-subdirectory-structure.md` (the decision record this plan implements)
- [x] Read `C:\Users\kadmo\.claude\plans\eventual-imagining-sunset.md` (the pre-validated 3-commit sequence + R1-R6 risk matrix)
- [x] Read `scripts/lib/lint-agent-frontmatter.ts` (bug at line 109: `join(skillsDir, skill + '.md')` must become `join(skillsDir, skill, 'SKILL.md')`)
- [x] Read `tests/lib/lint-agent-frontmatter.test.ts` (fixture helper `writeSkill()` at lines 31-33 writes flat files — must mkdir + write subdirectory entrypoint)
- [x] Read `.claude/agents/kerka.md` (line 75 hardcoded path reference to `.claude/skills/deep-research.md`)
- [x] Read `.claude/commands/kompact.md` (line 60 hardcoded path reference to `.claude/skills/postgres-patterns.md`)
- [x] Confirm the 46 skill files all have valid `name` + `description` frontmatter (Plan-mode audit verified; no content edits required)
- [x] Confirm upstream Anthropic docs prescribe literal uppercase `SKILL.md` filename (ADR-013 Upstream Evidence section)

If any of these checkboxes need re-verification mid-plan — stop, re-read, do not guess.

## Phase 1: Migration (Commit 1)

Commit 1 is purely mechanical: 46 `git mv` operations plus the 2 hardcoded doc path fixes. Tests WILL break at the end of this phase because the linter still validates the old flat path. This is intentional and acceptable because Commits 1 and 2 ship as an atomic push pair — the tree is never pushed in a broken state, only locally committed between Commit 1 and Commit 2.

- [ ] **Step 1.1: Set `core.ignorecase=false` for the local session only.** (S)
  - Command: `git config core.ignorecase false` (run in the repo root; no `--global` flag)
  - Purpose: R1 mitigation. Git's Windows default is `core.ignorecase=true`, which can silently normalize the uppercase `SKILL.md` filename to `skill.md` on the index. Anthropic's loader requires literal uppercase.
  - File: none (git config)
  - Verify: `git config --local core.ignorecase` prints `false`
  - Depends on: prerequisites complete
  - Risk: Low
  - **DO NOT commit this config change.** The `.git/config` file is not tracked; this is a session-local setting only. If it somehow ends up in a tracked file, revert before committing Commit 1.

- [ ] **Step 1.2: Dry-run enumeration of the 46 target paths.** (S)
  - Command: `ls .claude/skills/*.md | awk -F/ '{sub(/\.md$/, "", $0); name=$NF; print ".claude/skills/" name ".md -> .claude/skills/" name "/SKILL.md"}'`
  - Purpose: Print the full transformation plan as a flat list. Eyeball-verify every entry before executing any `git mv`. Confirm count is exactly 46.
  - File: none (enumeration only)
  - Verify: Output has 46 lines, every line ends in `/SKILL.md`, no path contains a space or unusual character
  - Depends on: 1.1
  - Risk: Low

- [ ] **Step 1.3: Execute the 46 `git mv` operations.** (M)
  - Command: run `git mv .claude/skills/<name>.md .claude/skills/<name>/SKILL.md` for each of the 46 names enumerated in Step 1.2. Scripted loop or manual — either is fine, but every operation MUST use `git mv` (never `mv` + `git add`, which breaks rename detection).
  - Purpose: Move every skill file into its own subdirectory with the literal `SKILL.md` entrypoint. Git auto-creates each intermediate `<name>/` subdirectory.
  - File: `.claude/skills/**`
  - Verify: `git status --short` shows exactly 46 rename entries (`R  <old> -> <new>`) and zero `??` untracked entries under `.claude/skills/`
  - Depends on: 1.2
  - Risk: Medium (R1 case-folding, R2 history loss if wrong tool used)

- [ ] **Step 1.4: Verify the committed paths are literal uppercase `SKILL.md`.** (S)
  - Command: `git ls-files .claude/skills/ | head -50` and `git ls-files .claude/skills/ | wc -l`
  - Purpose: R1 gate. Every one of the 46 lines MUST end in `SKILL.md` (uppercase). If ANY line shows `skill.md` or any other casing, the Windows case-folding has won — HALT, run `git mv` in reverse to undo, investigate, and retry with a more aggressive `core.ignorecase=false` check (e.g. verify with `git config --show-origin core.ignorecase` that the local setting is actually applied).
  - File: none (verification)
  - Verify: `git ls-files .claude/skills/ | wc -l` reports 46, AND `git ls-files .claude/skills/ | grep -c 'SKILL\.md$'` reports 46, AND `git ls-files .claude/skills/ | grep -c 'skill\.md$'` reports 0
  - Depends on: 1.3
  - Risk: High (this is the R1 gate — getting it wrong means reverting the entire migration)

- [ ] **Step 1.5: Fix hardcoded path reference in `kerka.md`.** (S)
  - File: `.claude/agents/kerka.md` line 75
  - Change: `.claude/skills/deep-research.md` → `.claude/skills/deep-research/SKILL.md`
  - Verify: `grep -n 'deep-research' .claude/agents/kerka.md` shows the new path and no residual flat references
  - Depends on: 1.4
  - Risk: Low

- [ ] **Step 1.6: Fix hardcoded path reference in `kompact.md`.** (S)
  - File: `.claude/commands/kompact.md` line 60
  - Change: `.claude/skills/postgres-patterns.md` → `.claude/skills/postgres-patterns/SKILL.md`
  - Verify: `grep -n 'postgres-patterns' .claude/commands/kompact.md` shows the new path and no residual flat references
  - Depends on: 1.4
  - Risk: Low

- [ ] **Step 1.7: Run vitest to confirm the expected red state.** (S)
  - Command: `npx vitest run`
  - Purpose: Confirm that the linter test suite fails in the *expected* way (the linter is still validating the flat path, which no longer exists). Non-linter tests must remain green. If non-linter tests are red, that's an unrelated regression — HALT and investigate before committing.
  - Verify: Linter tests in `tests/lib/lint-agent-frontmatter.test.ts` fail with path-not-found errors. ALL OTHER tests are green.
  - Depends on: 1.5, 1.6
  - Risk: Medium (distinguishing expected red from unrelated red)

- [ ] **Step 1.8: Commit 1 — do NOT push.** (S)
  - Command: `git commit -m "feat(skills): migrate 46 skills to subdirectory structure" -m "..." -m "Reviewed: lite (ts-reviewer)"`
  - Purpose: Seal Commit 1 locally. The push is deferred until after Commit 2 lands (atomic push pair).
  - Commit message body MUST mention: 46 skills moved, 2 hardcoded path refs fixed, tests intentionally red pending Commit 2, references ADR-013.
  - Verify: `git log -1 --stat` shows 48 files changed (46 renames + 2 path fixes), commit is on local `main`, `git status` is clean
  - Depends on: 1.7
  - Risk: Low

## Phase 2: Linter Repair (Commit 2)

Commit 2 atomically restores green tests by fixing the linter path construction and updating the fixture helper. This is intentionally small and laser-focused — no doc edits, no scope creep.

- [ ] **Step 2.1: Fix the linter path construction.** (S)
  - File: `scripts/lib/lint-agent-frontmatter.ts` line 109
  - Change: `join(skillsDir, skill + '.md')` → `join(skillsDir, skill, 'SKILL.md')`
  - Verify: `grep -n "SKILL.md" scripts/lib/lint-agent-frontmatter.ts` shows the new join call; `grep -n "skill + '.md'" scripts/lib/lint-agent-frontmatter.ts` returns nothing
  - Depends on: Phase 1 complete and committed
  - Risk: Low

- [ ] **Step 2.2: Update the linter docstring.** (S)
  - File: `scripts/lib/lint-agent-frontmatter.ts` line 4 (docstring comment)
  - Change: replace the comment describing the flat path contract with one that describes `<name>/SKILL.md`. Reference ADR-013.
  - Verify: `head -10 scripts/lib/lint-agent-frontmatter.ts` shows the updated comment
  - Depends on: 2.1
  - Risk: Low

- [ ] **Step 2.3: Update the `writeSkill()` fixture helper.** (S)
  - File: `tests/lib/lint-agent-frontmatter.test.ts` lines 31-33
  - Change: the current helper does `writeFileSync(join(skillsDir, name + '.md'), content)`. Rewrite to `mkdirSync(join(skillsDir, name), { recursive: true })` followed by `writeFileSync(join(skillsDir, name, 'SKILL.md'), content)`. Import `mkdirSync` from `node:fs` if not already imported.
  - Verify: `grep -n 'mkdirSync' tests/lib/lint-agent-frontmatter.test.ts` shows the new call; `grep -n "SKILL.md" tests/lib/lint-agent-frontmatter.test.ts` shows the new file path
  - Depends on: 2.2
  - Risk: Low (existing helper, small adjustment)

- [ ] **Step 2.4: Run the linter test file in isolation.** (S)
  - Command: `npx vitest run tests/lib/lint-agent-frontmatter.test.ts`
  - Purpose: Verify the 13 test cases from plan-012 pass against the new path shape.
  - Verify: 13 pass, 0 fail
  - Depends on: 2.3
  - Risk: Low

- [ ] **Step 2.5: Run the full vitest suite.** (S)
  - Command: `npx vitest run`
  - Purpose: Confirm that fixing the linter path + fixture helper restores the full suite to green. Baseline test count may have drifted from 576 due to parallel session activity — use the current `origin/main` count as the baseline, not a hardcoded number.
  - Verify: Test suite is entirely green. Compare total count against `git stash && npx vitest run && git stash pop` on `origin/main` if there's any doubt about expected count.
  - Depends on: 2.4
  - Risk: Medium (if anything unrelated broke between prerequisites and now, this surfaces it)

- [ ] **Step 2.6: Run the linter CLI against the real `.claude/agents/` directory.** (S)
  - Command: `npx tsx scripts/lint-agent-frontmatter.ts`
  - Purpose: Verify the linter, now pointed at the new structure, correctly validates all 16 agents against the 46 skills in their new subdirectory homes. This is the end-to-end integration check.
  - Verify: Linter exits 0 and reports all 16 agents OK. Zero missing-path warnings. If any skill is reported missing, that's a bug in Step 1.3 or Step 2.1 — HALT and fix.
  - Depends on: 2.5
  - Risk: Medium (surfaces any mismatch between declared `skills:` names and actual directory names)

- [ ] **Step 2.7: Commit 2.** (S)
  - Command: `git commit -am "fix(lint): resolve skills at <name>/SKILL.md not <name>.md" -m "..." -m "Reviewed: lite (ts-reviewer)"`
  - Commit message body MUST mention: restores test green, fixes linter + fixture helper atomically, references ADR-013 and Commit 1.
  - Tier: `lite (ts-reviewer)` — TypeScript production code under `scripts/lib/`, small scoped change, no security surface.
  - Verify: `git log -2 --oneline` shows Commit 1 and Commit 2 in order; `git status` is clean
  - Depends on: 2.6
  - Risk: Low

- [ ] **Step 2.8: Atomic push of Commits 1 and 2.** (S)
  - Command: `git push`
  - Purpose: The tree is never pushed in a red state. Commit 1 alone is red; Commit 1 + Commit 2 is green. Push them together.
  - Verify: `git log origin/main..main` is empty after push; `gh run list --limit 3` (if CI is configured) shows the push triggered no failing jobs
  - Depends on: 2.7
  - Risk: Low

## Phase 3: Empirical Proof + Docs (Commit 3)

Commit 3 does the empirical verification that the migration actually fixes the runtime injection (this is the plan's success gate per ADR-013 Risk R5) and embeds the proof artifacts into both the commit body and ADR-013's Verification section. It also updates the Skill Loading documentation.

- [ ] **Step 3.1: Spawn kody post-migration with the canonical probe prompt.** (S)
  - Tool: Agent (subagent_type `kody`)
  - Prompt: "Without using any tools, list the first 3 rules from the `coding-standards` skill verbatim as they appear in your injected context. If the skill content is not present in your context, say so explicitly. End your reply with a single line in this exact format: `INJECTION_STATUS: WORKING` if the skill content is present, or `INJECTION_STATUS: BROKEN` if it is not."
  - Purpose: This is the go/no-go gate for plan-013 (ADR-013 Risk R5). A green outcome is the only way plan-013 can be declared a success.
  - Verify: Capture the FULL kody reply into a scratch buffer for embedding in Step 3.5 and Step 3.6.
  - Depends on: Phase 2 pushed (Claude Code picks up the new layout only on new sub-agent spawns after the migration landed)
  - Risk: High (this is the R5 gate)

- [ ] **Step 3.2: Analyze kody's output and branch.** (S)
  - If kody's reply contains `INJECTION_STATUS: WORKING` AND quotes actual verbatim content from the `coding-standards` skill (not generic TypeScript advice, not paraphrases) → PROCEED to Step 3.3.
  - If kody's reply contains `INJECTION_STATUS: BROKEN` → **HALT PLAN, trigger R5 rollback path**: `git revert HEAD~1 HEAD` (reverts Commit 2 then Commit 1), push the reverts, and investigate. Possible causes: Claude Code session cache (try restarting Claude Code and re-spawning kody *before* reverting), Claude Code version predates the subdirectory loader, frontmatter edge case in a specific skill file that the loader rejects silently. DO NOT ship Commit 3 with a BROKEN gate result.
  - If kody's reply is ambiguous (mentions rules but does not emit the `INJECTION_STATUS:` sentinel line) → treat as BROKEN and go to the HALT branch. The probe prompt is explicit about the sentinel format; ambiguity means the experiment was invalid.
  - Verify: Explicit WORKING verdict in the captured output
  - Depends on: 3.1
  - Risk: High (wrong branch here either ships broken docs or unnecessarily reverts green work)

- [ ] **Step 3.3: Update `.claude/rules/common/agents.md` Skill Loading section.** (S)
  - File: `.claude/rules/common/agents.md`
  - Change: in the "Skill Loading" section near the top of the file, update path examples from `.claude/skills/<name>.md` to `.claude/skills/<name>/SKILL.md`. Add an explicit link to `https://code.claude.com/docs/en/skills` and a cross-reference to `docs/decisions/ADR-013-skills-subdirectory-structure.md`.
  - Verify: `grep -n 'SKILL.md' .claude/rules/common/agents.md` shows the new examples; `grep -n 'code.claude.com/docs/en/skills' .claude/rules/common/agents.md` shows the link; no residual `<name>.md` flat examples remain in the Skill Loading section
  - Depends on: 3.2 (green branch only)
  - Risk: Low

- [ ] **Step 3.4: Grep `CLAUDE.md` for residual flat-path references.** (S)
  - Command: `grep -n '\.claude/skills/[a-z-]*\.md' CLAUDE.md` (BSD/Git Bash compatible; adjust regex if needed)
  - Purpose: Find any residual references to the old flat path. Most likely a no-op — CLAUDE.md typically describes skills by category, not by file path. But verify anyway.
  - If matches found: edit them to the new subdirectory form.
  - If no matches found: note "no edits needed" in the commit message body.
  - Verify: Post-edit, `grep` returns zero residual flat-path references
  - Depends on: 3.3
  - Risk: Low

- [ ] **Step 3.5: Append post-migration proof to ADR-013 Verification section.** (S)
  - File: `docs/decisions/ADR-013-skills-subdirectory-structure.md`
  - Change: append a new subsection under "Checklist Verification" titled `### Post-Migration Empirical Proof (2026-04-14)` containing the FULL text of kody's reply from Step 3.1, in a fenced code block. Include a one-line preamble: "Post-migration kody spawn with the canonical injection probe. Result: WORKING."
  - This is an append-only edit — do NOT modify any existing ADR-013 content. ADRs are append-only once shipped (per `feedback_no_half_done.md`), and even though ADR-013 is only hours old, the principle applies — the Verification section is the designated append target.
  - Verify: `git diff docs/decisions/ADR-013-skills-subdirectory-structure.md` shows only additions, zero deletions, and the new subsection contains the kody output verbatim
  - Depends on: 3.4
  - Risk: Low

- [ ] **Step 3.6: Commit 3.** (S)
  - Command: `git commit -am "docs(adr): ADR-013 skills subdirectory structure supersedes ADR-012 path resolution" -m "<body>" -m "Reviewed: skip (docs-only)"`
  - Commit message body MUST embed:
    1. A short summary of the migration (46 files moved, 2 hardcoded refs fixed, linter repaired).
    2. The post-migration kody output from Step 3.1 in a fenced code block under a "Post-migration proof" heading.
    3. Optionally, the pre-migration kody output from Prerequisites in a fenced code block under a "Pre-migration baseline (reference)" heading, for auditors who want the full before/after pair.
    4. A reference to ADR-013 and to Commits 1 and 2 by hash.
  - Tier: `skip` per the development-workflow rules — this is a docs-only + metadata commit with zero runtime impact. Mechanical verification (`git diff` review) is still performed.
  - Verify: `git log -3 --oneline` shows Commits 1, 2, 3 in order; `git show HEAD --stat` shows only `.claude/rules/common/agents.md`, possibly `CLAUDE.md`, and `docs/decisions/ADR-013-skills-subdirectory-structure.md` modified
  - Depends on: 3.5
  - Risk: Low

- [ ] **Step 3.7: Push Commit 3.** (S)
  - Command: `git push`
  - Verify: `git log origin/main..main` is empty; `gh run list --limit 3` shows the push triggered no failing jobs
  - Depends on: 3.6
  - Risk: Low

## Verification Strategy

Plan-013 uses a two-layer verification protocol: mechanical checks prove the file system and test suite are in the expected state, and an empirical check proves the runtime behavior actually changed. The empirical layer is the one that matters — mechanical green without empirical green is the exact failure mode plan-012 hit.

**Mechanical (necessary but not sufficient):**

- `git ls-files .claude/skills/` returns 46 lines, all ending in literal uppercase `SKILL.md` (Step 1.4)
- `npx vitest run` full suite green after Commit 2 (Step 2.5)
- `npx vitest run tests/lib/lint-agent-frontmatter.test.ts` reports 13/13 (Step 2.4)
- `npx tsx scripts/lint-agent-frontmatter.ts` reports 16/16 agents OK against the new structure (Step 2.6)
- `git log --follow .claude/skills/<any-name>/SKILL.md` traces the rename back to the flat predecessor (preserves history; spot-check one or two)
- `grep -rn '\.claude/skills/[a-z-]*\.md'` across the tree finds zero residual flat-path references in executable docs after Commit 3 (allowed: historical mentions in `docs/plans/plan-012-*.md` and `docs/decisions/ADR-012-*.md`, which describe the previous state)

**Empirical (the actual gate):**

- Pre-migration kody spawn reproduces `INJECTION_STATUS: BROKEN` with kody correctly distinguishing between rules-via-CLAUDE.md (present) and skills-via-loader (absent) — captured in Prerequisites
- Post-migration kody spawn produces `INJECTION_STATUS: WORKING` with verbatim `coding-standards` content quoted in the reply — captured in Step 3.1
- Both outputs are embedded in Commit 3's body and in ADR-013's Verification section as a before/after pair

If the mechanical layer is green but the empirical layer is red, the plan FAILS and rolls back per Risk R5. Mechanical green alone is not enough — that was plan-012's mistake.

## Risks & Mitigations

Full R1-R6 risk matrix from the pre-validated Plan-mode file:

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| **R1** | Git on Windows case-folds `SKILL.md` → `skill.md` | HIGH | Set `core.ignorecase=false` in the local session before Step 1.3. Verify post-mv via `git ls-files` (Step 1.4). If any path is lowercase, reverse the `git mv` operations and retry with a stricter check. |
| **R2** | `git mv` history loss if `mv + git add` used instead | MEDIUM | Use `git mv` exclusively in Step 1.3 — never `mv` followed by `git add`. Git's rename detection requires the atomic move. |
| **R3** | Tests red between Commit 1 and Commit 2 | MEDIUM | Commit 1 is not pushed until Commit 2 also exists locally. Atomic push in Step 2.8. The tree on `origin/main` is never red. |
| **R4** | Claude Code caches sub-agent resolution and picks up new layout only after session restart | LOW | Document "restart Claude Code after merge to pick up the new layout" in Commit 3's body. No code change required. If pre/post kody spawns from the SAME Claude Code session yield inconsistent results, restart the session and re-run Step 3.1. |
| **R5** | Post-migration kody spawn returns `INJECTION_STATUS: BROKEN` | **CRITICAL** | This is the hard go/no-go gate. If kody reports BROKEN post-migration, HALT plan, restart Claude Code once and retry (R4 overlap), and if still BROKEN, `git revert HEAD~1 HEAD` to roll back Commits 1+2, push the reverts, investigate (cache, version, frontmatter edge case), do NOT ship Commit 3. |
| **R6** | Parallel session working tree collision | MEDIUM | Prerequisites block verifies clean tree + origin alignment before Step 1.1. If the parallel session has uncommitted changes in files plan-013 touches, wait for it to ship and then `git pull --ff-only`. |

## Rollout Sequence

Three commits, two pushes:

1. **Commit 1** `feat(skills): migrate 46 skills to subdirectory structure` — local only, not pushed yet
2. **Commit 2** `fix(lint): resolve skills at <name>/SKILL.md not <name>.md` — local, then pushed atomically with Commit 1 (Step 2.8)
3. **Commit 3** `docs(adr): ADR-013 skills subdirectory structure supersedes ADR-012 path resolution` — committed and pushed alone (Step 3.7) after the empirical gate (Step 3.2) passes

Total estimate: 2-3 hours end to end. Most of the time is the Step 1.3 loop (careful, one mistake here recovers expensively) and the Step 3.1-3.2 empirical gate (which has a natural wait for the new Claude Code session to spawn kody fresh against the new layout).

## Follow-ups After Merge

These tasks are documented here so they don't get lost in the session transition between plan-013 merge and plan-010 Sprint D kickoff. Neither is in scope for plan-013 — they are reminders.

- **Task #15 — KADMON_RUNTIME_ROOT env var propagation test (5 min).** Write a 3-line hook that logs `process.env.KADMON_RUNTIME_ROOT`, trigger it once, confirm the value arrives. De-risks plan-010 Phase 1 (6-hour load-bearing refactor) before starting the refactor. Run this right before plan-010 Phase 1 kickoff. Tag in Claude Code task list: `plan-010-prereq`.
- **Task #16 — `/medik` full diagnostic baseline.** 8 health checks (including the new Agent Frontmatter Check #8 that enforces the new structure via linter) + mekanik + kurator in parallel. Pre-requisite: parallel session must commit its 7 pending local files first (CLAUDE.md, README.md, rules/common/agents.md, rules/common/development-workflow.md, skills/security-scan, agents/mekanik, commands/medik). Run `/medik` right after plan-013 merges and parallel session syncs. Tag in Claude Code task list: `plan-010-prereq`.

## Success Criteria

Plan-013 is complete when every checkbox below is checked. Any unchecked item is a blocker.

- [ ] 46 skill files exist at `.claude/skills/<name>/SKILL.md` with literal uppercase `SKILL.md`, verified via `git ls-files`
- [ ] Git rename history is preserved — spot-check `git log --follow` on at least two skills shows the move from flat to subdirectory
- [ ] Linter (`scripts/lib/lint-agent-frontmatter.ts`) constructs the new path `<name>/SKILL.md` and exits 0 against the real `.claude/agents/` directory
- [ ] Linter tests (`tests/lib/lint-agent-frontmatter.test.ts`) report 13/13 green after the fixture helper update
- [ ] Full `npx vitest run` suite is green (count matches current `origin/main` baseline)
- [ ] The 2 hardcoded doc path references in `.claude/agents/kerka.md:75` and `.claude/commands/kompact.md:60` are updated to the new subdirectory form
- [ ] `.claude/rules/common/agents.md` Skill Loading section shows the new path examples, the Anthropic docs link, and the ADR-013 cross-reference
- [ ] `CLAUDE.md` grep for residual flat-path references returns clean (or any matches are fixed)
- [ ] Post-migration kody spawn with the canonical probe prompt returns `INJECTION_STATUS: WORKING` with verbatim `coding-standards` content quoted in the reply
- [ ] ADR-013 Verification section contains the embedded post-migration kody proof (append-only edit)
- [ ] Three commits exist in the order: Commit 1 (feat) → Commit 2 (fix) → Commit 3 (docs), all on `origin/main`
- [ ] `npx tsc --noEmit` compiles clean (no new type errors from linter edit)
- [ ] Task #15 and Task #16 are recorded in the Claude Code task list with the `plan-010-prereq` tag
