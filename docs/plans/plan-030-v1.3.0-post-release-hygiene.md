---
number: 30
title: v1.3.0 Post-Release Hygiene
date: 2026-04-24
status: completed
needs_tdd: false
route: B
adr: none
---

# Plan-030: v1.3.0 Post-Release Hygiene [konstruct]

## Overview

Five-phase cleanup pass after v1.3.0 was tagged + pushed at commit `4122bcf` on `release/v1.3`. Tag stays untouched. Scope: doc-version sweep across `docs/`, surgical refactor of `/abra-kdabra` (drop redundant kody review, add TL;DR gate), final smoke (`/medik` + `/skanner`), new `reference_graphify.md` memory, and a final `/chekpoint` push. No production code, no ADR, no version bump.

## Assumptions

- v1.3.0 tag is at `4122bcf` on `release/v1.3` and stays put — confirmed in scope context.
- `CHANGELOG.md` is already correct for `[1.3.0]` and has an empty `[Unreleased]` block — verified by Read of lines 1-30.
- `docs/onboarding/reference_kadmon_harness.md` is already partially synced to v1.3.0 (line 7: "Kadmon Harness v1.3.0 — quick reference") — verified by Read.
- `.claude-plugin/marketplace.json` description currently says "16 agents, 11 commands, 46 skills, 22 hooks" — already correct for v1.3.0 counts (verified). Likely no edit needed; verify only.
- `/abra-kdabra` Step 5 ("Code Review") is documented at `.claude/commands/abra-kdabra.md` lines 102-107 — verified by Read.
- `/abra-kdabra` orchestration chain "arkitect (if arch) → konstruct → feniks (if tdd) → kody" appears in `.claude/rules/common/agents.md` line 132 AND in `development-workflow.md` line 62 — both must be updated to drop `→ kody`.
- Memory dir is `~/.claude/projects/C--Command-Center-Kadmon-Harness/memory/` (hyphens, per CLAUDE.md "Common Pitfalls").
- 25 files under `Kadmon-Harness` mention `v1.2.3 | 21 hooks | 957 tests | 9/13 health checks | Unreleased` per Grep audit — most are historical (ADRs, plans, roadmap retrospectives) where past-tense references are correct. Only **forward-looking docs** (CLAUDE.template, TROUBLESHOOTING, README, marketplace, workspace-surface-audit SKILL) need updates.

## Phase 0: Research

- [ ] **Step 0.1**: Confirm tag + branch state (S)
  - File: N/A
  - Commands:
    - `git tag --list 'v1.3.0' --format='%(refname:short) %(objectname:short)'` — MUST print `v1.3.0 4122bcf`
    - `git branch --show-current` — MUST print `release/v1.3`
    - `git status --porcelain` — MUST be empty (clean working tree)
  - Verify: all three commands above.
  - Risk: HIGH if tag is missing or branch is wrong — abort plan, surface to user.
  - Depends on: none

- [ ] **Step 0.2**: Re-pull `release/v1.3` to catch any parallel-session commits (S)
  - File: N/A
  - Command: `git pull --ff-only origin release/v1.3`
  - Verify: `git log -1 --format='%H'` matches `git ls-remote origin release/v1.3 | cut -f1`.
  - Why: per `feedback_parallel_sessions.md` — never assume working tree is current at plan kickoff.
  - Depends on: 0.1
  - Risk: Low

## Phase A: Doc sync v1.3.0 across `docs/`

> Mirror to TaskCreate (4 steps).

- [ ] **Step A.1**: Invoke `doks` agent (opus) for comprehensive scan (M)
  - File: docs/, README.md, .claude-plugin/marketplace.json, .claude/skills/workspace-surface-audit/SKILL.md
  - Action: invoke doks via Task tool with prompt: "v1.3.0 doc sync. Hunt and update stale references in forward-looking docs only. Targets: `v1.2.3`, `1.2.3` (in CURRENT-state context, not historical), `21 hooks`, `957 tests`, `8/9/13 health checks`, `Unreleased`. Files in scope: `docs/onboarding/CLAUDE.template.md`, `docs/onboarding/TROUBLESHOOTING.md`, `docs/onboarding/reference_kadmon_harness.md`, `docs/roadmap/v2.0-multi-project.md`, `README.md`, `.claude-plugin/marketplace.json`, `.claude/skills/workspace-surface-audit/SKILL.md`. EXCLUDE: ADRs (historical context — past v1.x.x refs are correct), plans (pinned to their date), CHANGELOG `[1.3.0]` section, graphify-out/wiki (auto-regenerated). Verify plan-028 + plan-029 status frontmatter is `completed`. New canonical counts: `46 skills`, `22 hooks`, `1053 tests`, `14 health checks`, `85 files`, `v1.3.0`."
  - Verify: doks returns a report listing files touched + diffs.
  - Depends on: 0.2
  - Risk: Medium — doks may over-edit historical refs in ADRs/plans. Mitigation: explicit EXCLUDE list in prompt; manual verification in A.2.

- [ ] **Step A.2**: Manual verification pass — re-run audit grep (S)
  - File: N/A
  - Commands:
    - `git diff --stat release/v1.3...HEAD` — confirm only forward-looking docs touched
    - `grep -rEn "v1\.2\.3|21 hooks|957 tests|9 health checks|13 health checks|8 health checks" docs/onboarding README.md .claude-plugin/marketplace.json` — should return zero forward-looking hits
    - `grep -A1 "^---" docs/plans/plan-028*.md docs/plans/plan-029*.md | grep status:` — both MUST be `status: completed`
  - Verify: zero stale forward-looking references remain.
  - Depends on: A.1
  - Risk: Low

- [ ] **Step A.3**: Verify plan-028 + plan-029 frontmatter status (S)
  - File: docs/plans/plan-028-v1.3-medik-expansion-release.md, docs/plans/plan-029-capability-alignment-audit.md
  - Action: Read frontmatter; if `status` is not `completed`, Edit it to `completed` (both shipped in v1.3.0 per CHANGELOG).
  - Verify: both files have `status: completed` in YAML frontmatter.
  - Depends on: A.1
  - Risk: Low

- [ ] **Step A.4**: Verify `.claude-plugin/marketplace.json` matches v1.3.0 counts (S)
  - File: .claude-plugin/marketplace.json
  - Action: Already says "16 agents, 11 commands, 46 skills, 22 hooks" per Read — confirm no edit needed. If counts drift, Edit to match.
  - Verify: counts match `46 skills / 22 hooks / 11 commands / 16 agents`.
  - Depends on: A.1
  - Risk: Low

**Phase A exit criteria**: zero stale `v1.2.3 | 21 hooks | 957 tests | 8|9|13 health checks` in forward-looking docs; plan-028 + plan-029 status `completed`; marketplace.json verified.

**Phase A TL;DR**: Sync version markers in 7 forward-looking docs to v1.3.0 / 46 skills / 22 hooks / 1053 tests / 14 health checks. Historical files (ADRs, plans) untouched.

## Phase B: `/abra-kdabra` command cleanup

> Mirror to TaskCreate (5 steps).

- [ ] **Step B.1**: Remove Step 5 (kody Code Review) from `/abra-kdabra` (M)
  - File: .claude/commands/abra-kdabra.md
  - Action: Delete lines 102-107 (`### Step 5: Code Review (after code exists)` block). Rationale: /abra-kdabra produces a PLAN, not code; konstruct already validates plan structure; when implementation actually ships, /chekpoint Phase 2b invokes kody automatically. Doubling = redundant.
  - Verify: `grep -c "Step 5" .claude/commands/abra-kdabra.md` returns 0; `grep -c "kody" .claude/commands/abra-kdabra.md` should drop to 1 or 0 (only frontmatter `agent:` reference may remain — see B.2).
  - Depends on: 0.2
  - Risk: Low

- [ ] **Step B.2**: Update frontmatter `agent:` field — drop `kody` (S)
  - File: .claude/commands/abra-kdabra.md (line 3)
  - Action: Change `agent: arkitect, konstruct, feniks, kody` → `agent: arkitect, konstruct, feniks`. Drop `kody` since command no longer invokes it.
  - Verify: `head -5 .claude/commands/abra-kdabra.md | grep agent:` shows only 3 agents.
  - Depends on: B.1
  - Risk: Low

- [ ] **Step B.3**: Augment Step 3 GATE with TL;DR summary block (M)
  - File: .claude/commands/abra-kdabra.md
  - Action: In Step 3 (lines 68-80), insert before the "Ask:" line a TL;DR template. Per user preference: Spanish labels + visual emoji icons (insights-style, fast scanning). Note in template: this block is RUNTIME OUTPUT to user, not artifact code, so emojis + Spanish are compliant with global rule (artifacts stay English; prose to user follows user's es-MX register).
    ```
    ## ✨ Approval Gate

    **🎯 Decisión**: <ADR title or plan title, one line>
    **🤔 Por qué**: <motivation, 1-2 lines>
    **📦 Alcance**: <files/components touched>
    **⚠️ Riesgo**: <what could break>
    **⏱️ Esfuerzo**: <S/M/L + hours>
    **🧪 Tests**: <count + new TDD targets>

    📄 Full ADR: `docs/decisions/ADR-NNN-slug.md` · Plan: `docs/plans/plan-NNN-slug.md`
    ```
  - Why: unblocks user from opening full files just to decide approve/reject. Files stay linked for drill-down. Spanish + emojis matches user's prose register (CLAUDE.md global "Working Style").
  - Verify: `grep -c "Approval Gate" .claude/commands/abra-kdabra.md` returns 1; block appears BEFORE the existing "Ask:" line; Spanish labels present (`Decisión`, `Por qué`, `Alcance`, `Riesgo`, `Esfuerzo`, `Tests`).
  - Depends on: B.1
  - Risk: Low

- [ ] **Step B.4**: Update `## Output` section + Examples to reflect 4-step flow (S)
  - File: .claude/commands/abra-kdabra.md (lines 151-181)
  - Action: Update `## Output` description and both `## Example: Architecture Route` + `## Example: Implementation Route` blocks if they reference Step 5 or kody. Verify the two example blocks end at the STOP gate (Step 3) — no follow-on kody phase.
  - Verify: `grep -n "Step 5\|kody" .claude/commands/abra-kdabra.md` shows no matches outside Step 4 if-needs_tdd-true contextual mentions.
  - Depends on: B.1, B.3
  - Risk: Low

- [ ] **Step B.5**: Update orchestration tables in two rules files (M)
  - File 1: .claude/rules/common/agents.md (line 132)
    - Action: `arkitect (if arch) → konstruct → feniks (if tdd) → kody` → `arkitect (if arch) → konstruct → feniks (if tdd)`
  - File 2: .claude/rules/common/development-workflow.md (line 62)
    - Action: In the `/abra-kdabra` row of the Plan Phase command table, drop `kody` from the `Agent` column → `arkitect, konstruct, feniks`
  - Verify: `grep "/abra-kdabra" .claude/rules/common/agents.md .claude/rules/common/development-workflow.md` — neither line should mention `kody`.
  - Depends on: B.1
  - Risk: Low

**Phase B exit criteria**: `/abra-kdabra` is a 4-step flow (no Step 5); GATE renders TL;DR before the approval question; agents.md + development-workflow.md tables match.

**Phase B TL;DR**: Drop redundant kody step from /abra-kdabra (5→4 steps), add TL;DR summary at the approval gate, sync 2 routing tables. User decides faster from the gate without opening ADR/plan files.

## Phase C: Final smoke `/medik` + `/skanner`

> No TaskCreate mirror (3 steps, all manual smoke).

- [ ] **Step C.1**: Run `/medik` — verify all 14 checks PASS (M)
  - File: N/A (manual command run)
  - Command: `/medik` (full diagnostic, no `--ALV` flag, no `clean` subcommand)
  - Verify: Phase 1 emits 14 check rows; final summary shows 0 FAIL. Mekanik + kurator (Phase 2) report no critical issues.
  - Decision tree:
    - All 14 PASS → record results inline in this plan as completion notes; proceed to C.2.
    - Any FAIL → STOP. Surface to user. FAIL fixes are out of plan-030 scope; create separate fix plan.
    - WARN/NOTE only → record and proceed to C.2 (non-blocking).
  - Depends on: Phase A complete, Phase B complete
  - Risk: Medium — fresh edits in Phase A/B may trigger Check #1 (build) or #14 (capability-alignment) if metadata is inconsistent.

- [ ] **Step C.2**: Run `/skanner` — perf + E2E without agent eval (M)
  - File: N/A (manual command run)
  - Command: `/skanner` (no `--agent-eval` flag — too expensive)
  - Verify: arkonte perf scan returns no NEW O(n^2) or hot-path regressions vs v1.3.0 baseline; kartograf E2E passes.
  - Decision tree: same as C.1 (PASS proceed; FAIL stop and flag separately).
  - Depends on: C.1
  - Risk: Medium — same as C.1.

- [ ] **Step C.3**: Document results inline in this plan (S)
  - File: docs/plans/plan-030-v1.3.0-post-release-hygiene.md (this file)
  - Action: Append a `## Completion Notes` section at the bottom with `/medik` summary line + `/skanner` summary line + timestamps.
  - Verify: section exists; both summaries present; no separate report files created (per scope rules).
  - Depends on: C.1, C.2
  - Risk: Low

**Phase C exit criteria**: 14/14 checks PASS; perf + E2E green; results documented inline.

**Phase C TL;DR**: Final post-release smoke. `/medik` (14 checks) + `/skanner` (perf + E2E). PASS = ship; FAIL = stop and flag separately, do not patch in plan-030.

## Phase D: `reference_graphify.md` memory file

> No TaskCreate mirror (3 steps, all docs/index updates).

- [ ] **Step D.1**: Create `reference_graphify.md` memory file (M)
  - File: `~/.claude/projects/C--Command-Center-Kadmon-Harness/memory/reference_graphify.md`
  - Action: Write file with frontmatter `type: reference` + 5 rules:
    1. **Use `graphify query "<question>"` BEFORE Grep/Glob** for architecture/cross-module questions
    2. **Commands cheat-sheet** — `query`, `path A B`, `explain <concept>`, `update .`
    3. **Sprint E result** — 8.11× avg token reduction (Method C, total session cost across 10 queries), per ADR-026
    4. **God nodes + community structure** at `graphify-out/GRAPH_REPORT.md` (67 communities)
    5. **Foot-gun** — see [reference_graphify_update_gotcha.md](reference_graphify_update_gotcha.md) for the `graphify update .` reports-stomp issue
  - Verify: file exists at the absolute path; frontmatter has `type: reference`; all 5 rules numbered and present.
  - Depends on: 0.2
  - Risk: Low

- [ ] **Step D.2**: Update `MEMORY.md` index — promote graphify reference to primary (S)
  - File: `~/.claude/projects/C--Command-Center-Kadmon-Harness/memory/MEMORY.md`
  - Action: In the `## References` section, ADD a new line listing `reference_graphify.md` as primary above the existing `reference_graphify_update_gotcha.md` line. Reword the gotcha line to indicate it's a child note.
  - Verify: `## References` section has both files; primary listed first.
  - Constraint: References cap is 8; current count is 8. **Adding a 9th violates the cap.** Mitigation: merge by demoting the gotcha into a sub-bullet under the new primary entry, OR remove `reference_statusline_structure.md` if statusline content is captured elsewhere. Default: merge (one bullet, primary line + nested child link).
  - Depends on: D.1
  - Risk: Medium — cap violation requires a merge decision. If unclear at execution time, ask user.

- [ ] **Step D.3**: Verify `MEMORY.md` line count + cap discipline (S)
  - File: `~/.claude/projects/C--Command-Center-Kadmon-Harness/memory/MEMORY.md`
  - Commands:
    - `wc -l ~/.claude/projects/C--Command-Center-Kadmon-Harness/memory/MEMORY.md` — MUST be < 200
    - `grep -c "^- \[" MEMORY.md` (under References section) — MUST be ≤ 8
  - Verify: line count under cap; reference count under cap.
  - Depends on: D.2
  - Risk: Low

**Phase D exit criteria**: `reference_graphify.md` exists; MEMORY.md indexes it; cap discipline preserved.

**Phase D TL;DR**: Add a primary graphify reference memory (5 rules: query-first, commands, Sprint E result, GRAPH_REPORT pointer, foot-gun link). Merge under References cap (8 max).

## Phase E: Final `/chekpoint` + push

> Mirror to TaskCreate (5 steps).

- [ ] **Step E.1**: Stage Phase A docs in one commit (S)
  - File: N/A
  - Commands:
    - `git add docs/ README.md .claude-plugin/marketplace.json .claude/skills/workspace-surface-audit/SKILL.md`
    - `git status --porcelain` — verify only Phase A targets staged
  - Verify: staged files match Phase A scope.
  - Depends on: Phase D complete
  - Risk: Low

- [ ] **Step E.2**: Stage Phase B (command + rules) in one commit (S)
  - File: N/A
  - Commands:
    - `git add .claude/commands/abra-kdabra.md .claude/rules/common/agents.md .claude/rules/common/development-workflow.md`
  - Verify: only Phase B targets staged.
  - Depends on: E.1 (E.1 must be committed first; one-commit-per-phase enforced)
  - Risk: Low

- [ ] **Step E.3**: Stage Phase D memory file (M)
  - File: N/A
  - Note: memory dir is OUTSIDE the repo (`~/.claude/projects/...`). Memory files are NOT committed to the harness repo. Skip git staging for Phase D — already persisted at write time.
  - Verify: `git status` shows no memory file in tracked changes.
  - Depends on: E.2 committed
  - Risk: Low

- [ ] **Step E.4**: Run `/chekpoint` full tier on the bundle (L)
  - File: N/A
  - Command: `/chekpoint` (full tier — multi-file refactor of command + rules + 7 docs)
  - Verify: Phase 1 (verification: build + typecheck + tests + lint) passes; Phase 2 reviewers run (typescript-reviewer NO-OP since no .ts/.js, kody primary for docs + command + rules); Phase 3 gate clears.
  - Depends on: E.1, E.2 committed
  - Risk: Medium — kody may flag the TL;DR template wording or the 4-step flow output as inconsistent. Mitigation: address feedback inline before commit; if kody BLOCKs, re-edit per Phase 2b consolidation.

- [ ] **Step E.5**: Push to `release/v1.3` (S)
  - File: N/A
  - Command: `git push origin release/v1.3` (no `--force`; tag v1.3.0 untouched at 4122bcf)
  - Verify: `git ls-remote origin release/v1.3` matches local HEAD; `git tag -l v1.3.0` still points to 4122bcf.
  - Constraint: NEVER --force-push; tag is immutable.
  - Depends on: E.4
  - Risk: HIGH if force-pushed (would break tag). Mitigation: explicit non-force flag; verify tag SHA pre + post push.

**Phase E exit criteria**: 2 commits on `release/v1.3` (Phase A docs + Phase B command/rules); /chekpoint full PASS; pushed; tag v1.3.0 still at 4122bcf.

**Phase E TL;DR**: Two commits (docs sweep + command/rules cleanup), one /chekpoint full tier, push to release/v1.3. Tag stays at 4122bcf, no version bump.

## Testing Strategy

- **Unit**: none — no production code changes (`needs_tdd: false`).
- **Integration**: Phase C smoke (`/medik` 14 checks + `/skanner` arkonte/kartograf) acts as integration gate.
- **E2E**: kartograf workflow tests via `/skanner`.
- **Manual verification**: Phase A.2 audit grep, Phase B.4 grep, Phase D.3 cap check.

## Risks & Mitigations

| Risk | Phase | Severity | Mitigation |
|---|---|---|---|
| doks over-edits historical ADR/plan refs | A | Medium | Explicit EXCLUDE list in agent prompt; A.2 manual grep verifies forward-only changes |
| `/medik` Check #14 (capability-alignment) FAILs after Phase B drops `kody` from `agent:` | C | Medium | abra-kdabra.md is a COMMAND, not skill; Check #14 compares skill `requires_tools:` to agent `tools:`, not command `agent:`. Verified by reading ADR-029 + check-14 source. False alarm risk = low. |
| MEMORY.md References cap violated by D.1 | D | Medium | Merge primary + child into one bullet (D.2 mitigation note); if ambiguous, ask user before write |
| Force-push or tag clobber on E.5 | E | HIGH | Explicit non-force; verify tag SHA before + after push (E.5 verify step) |
| Parallel session edits release/v1.3 between 0.2 and E.5 | All | Medium | feedback_parallel_sessions.md guidance: never revert unrecognized changes. If `git pull --ff-only` fails at E.5, STOP and surface to user. |
| /chekpoint at E.4 BLOCKs on TL;DR template wording | E | Low | Iterate B.3 wording per kody feedback; this is a docs-only edit, low blast radius |
| /skanner perf scan flags graphify-out/ as god node hot path | C | Low | graphify-out/ is generated content, not runtime path. Document inline as expected; not a regression. |

## Success Criteria

- [ ] Phase 0: tag at 4122bcf verified, working tree fresh from origin
- [ ] Phase A: zero stale forward-looking version refs in `docs/onboarding/`, `README.md`, `marketplace.json`, `workspace-surface-audit/SKILL.md`; plan-028/029 status `completed`
- [ ] Phase B: `/abra-kdabra` is a 4-step flow with TL;DR at the gate; `agent:` frontmatter has 3 agents; agents.md + development-workflow.md tables match
- [ ] Phase C: 14/14 `/medik` checks PASS; `/skanner` perf + E2E PASS; results inlined in `## Completion Notes`
- [ ] Phase D: `reference_graphify.md` exists with 5 rules; `MEMORY.md` indexes it; line count < 200 + reference cap ≤ 8
- [ ] Phase E: 2 commits on `release/v1.3` (Phase A + Phase B); `/chekpoint` full PASS; push lands without force; tag `v1.3.0` still at `4122bcf`

## TaskCreate mirror requirement

Per `/abra-kdabra` Step 4 contract: TaskCreate is REQUIRED for plans ≥5 steps OR ≥2 phases. Plan-030 has 5 phases / 18 steps total → **TaskCreate REQUIRED**.

Per-phase mirror:
- **Phase A** (4 steps) → mirror
- **Phase B** (5 steps) → mirror
- **Phase C** (3 steps) → optional (manual smoke); mirror still recommended for ECC observation capture
- **Phase D** (3 steps) → optional; mirror recommended
- **Phase E** (5 steps) → mirror

Total task tasks = 20 (18 + 2 Phase 0 setup). Mark each task complete in same iteration as the markdown checkbox.

## Cross-references

- `adr: none` — no architectural decision; user explicitly scoped this as hygiene only
- `route: B` — implementation direct, no arkitect
- Tag v1.3.0 at commit `4122bcf` — immutable per E.5 constraint
- Predecessors: plan-028 (v1.3 medik expansion, completed), plan-029 (capability alignment, completed)
- Memory feedback drawn from: `feedback_parallel_sessions.md`, `feedback_always_chekpoint.md`, `feedback_verify_before_ship.md`

## Completion Notes

### Phase C Smoke Results (2026-04-24)

**/medik — 14 checks**: 0 FAIL, 3 NOTEs (known causes), 1 WARN (plugin-path heuristic).

| Category | # | Check | Status |
|---|---|---|---|
| Core | 1 Build / 2 Typecheck / 3 Tests (1053/1053) | — | PASS × 3 |
| Runtime | 4 Hook errors / 5 DB / 9 Install-health / 11 Hook-24h / 13 Skill-creator | mixed | PASS × 3, NOTE × 2, WARN × 1 |
| Code hygiene | 6 dist-sync / 7 Deps / 8 Agent-frontmatter | — | PASS × 3 |
| Knowledge hygiene | 10 Stale-plans / 12 Instinct-decay / 14 Capability-align | mixed | PASS × 2, NOTE × 1 |

NOTE causes:
- Check 4: 19 old EBUSY backup-rotate errors from April 23 (pre-v1.3.0), not regression.
- Checks 11 + 12: standalone invocation without main-session DB open. In real `/medik` runs via hook pipeline, DB is open. Expected.

WARN cause:
- Check 13: probe looks at 3 hardcoded plugin paths; skill-creator IS available (visible as `skill-creator:skill-creator` in session). Path-heuristic miss, not regression.

mekanik + kurator Phase 2 analysis skipped — no FAILs to diagnose, smoke purpose satisfied.

### Phase C `/skanner` Results (2026-04-24)

**arkonte (performance)** — 2 MEDIUM + 2 LOW findings on v1.3.0 new surfaces:

| Severity | File:line | Issue |
|---|---|---|
| MEDIUM | `capability-matrix.ts:172` | Quadratic backtrack worst-case in `scanHeuristicTools` fence-stripping regex. Fix: split-on-backtick approach, O(n). |
| MEDIUM | `stale-plans.ts:22` | Per-plan `git log` subprocess; risks 500ms budget with many pending plans. Fix: batch single `git log` call. |
| LOW | `medik-alv.ts:43` | `ABS_PATH_RE` space-in-class + redundant `{1,}`. Cosmetic. |
| LOW | `post-edit-security.js:45` | `where`/`which` probe per invocation, no cache. Optional sentinel-file fix. |

**kartograf (E2E)** — 5/5 scenarios PASS, 53/53 tests PASS, 4.16s wall-clock:

| # | Scenario | Status |
|---|---|---|
| 1 | Session lifecycle | PASS |
| 2 | Instinct lifecycle | PASS |
| 3 | Hook chain | PASS |
| 4 | no-context-guard blocking | PASS |
| 5 | Cost tracking | PASS |

### Decision: Performance findings deferred

Per plan-030 scope "no production code changes", the 2 MEDIUM + 2 LOW findings land in **v1.3.1 performance backlog** (documented here + TROUBLESHOOTING-equivalent surface). Neither is a regression introduced by v1.3.0 work that wasn't already present at shipping time. Fixing = separate plan post-v1.3.1.
