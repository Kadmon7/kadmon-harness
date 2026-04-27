---
number: 35
title: Rules catalog source-of-truth via non-auto-loaded CATALOG.md
date: 2026-04-26
status: completed
needs_tdd: true
route: A
adr: ADR-035-rules-catalog-source-of-truth.md
---

## Plan: Rules catalog source-of-truth via non-auto-loaded CATALOG.md [konstruct]

### Overview

Move three duplicated catalogs (Agent Catalog, Hook Catalog, Command Reference) out of `.claude/rules/common/{agents,hooks,development-workflow}.md` into dedicated, non-auto-loaded `CATALOG.md` files at `.claude/{agents,hooks,commands}/CATALOG.md`. Repoint `agent-metadata-sync.js` to the new agent catalog target. Trim the three rule files to operational orchestration content only. Net result: ~6-7k tokens / turn permanent savings (Memory files 32.6k -> ~26k), single source-of-truth per artifact type, zero distribution-layer changes.

### Assumptions

- ADR-035 is accepted and authoritative for the design — validated by reading `docs/decisions/ADR-035-rules-catalog-source-of-truth.md`.
- `.claude/{agents,hooks,commands}/` is plugin-shipped territory (ADR-010 + ADR-019) — no installer or manifest changes required.
- `_TEMPLATE.md.example` precedent (ADR-017) confirms files inside `.claude/agents/` are NOT eagerly loaded by Claude Code's runtime resolver — load-bearing assumption guarded by Phase 1 verification gate (Step 4).
- `parseCommandLevelSkillsTable()` in `scripts/lib/capability-matrix.ts` reads ONLY the `## Command-Level Skills` section in `agents.md`, not the Agent Catalog or Auto-Invoke sections — validated by reading the parser regex during Phase 0.
- `agent-metadata-sync.js` writes to TWO targets today: CLAUDE.md (brief two-column table, unchanged) and `.claude/rules/common/agents.md` (full table, repointed to `.claude/agents/CATALOG.md`).
- Vitest baseline is 1069+ tests passing on main — confirmed against CLAUDE.md status line.

### Phase 0: Research (read-only, no TaskCreate)

- [ ] Step 0.1: Read `.claude/rules/common/agents.md` end-to-end — confirm Agent Catalog spans lines 71-90 and Auto-Invoke spans lines 92-101; confirm `## Command-Level Skills` section is preserved verbatim (REQUIRED for `parseCommandLevelSkillsTable()`). (S)
  - File: `.claude/rules/common/agents.md`
  - Verify: `grep -n "^## " .claude/rules/common/agents.md` shows exact line numbers for each `##` heading.
  - Risk: Low
- [ ] Step 0.2: Read `.claude/rules/common/hooks.md` — confirm Hook Catalog spans lines 12-78 and Shared Modules spans lines 80-93. (S)
  - File: `.claude/rules/common/hooks.md`
  - Verify: `grep -n "^## " .claude/rules/common/hooks.md` shows headings.
  - Risk: Low
- [ ] Step 0.3: Read `.claude/rules/common/development-workflow.md` — confirm Command Reference spans lines 51-90. (S)
  - File: `.claude/rules/common/development-workflow.md`
  - Verify: `grep -n "^## " .claude/rules/common/development-workflow.md` shows headings.
  - Risk: Low
- [ ] Step 0.4: Read `.claude/hooks/scripts/agent-metadata-sync.js` — locate the line(s) where `agentsMdPath` (or equivalent target path) is computed for the full-table sync; locate the CLAUDE.md sync block to confirm it stays put. (S)
  - File: `.claude/hooks/scripts/agent-metadata-sync.js`
  - Verify: `grep -n "agentsMdPath\|rules/common/agents\|CLAUDE.md" .claude/hooks/scripts/agent-metadata-sync.js` returns the exact lines that need editing in Phase 2.
  - Risk: Low
- [ ] Step 0.5: Read `scripts/lib/capability-matrix.ts` — locate `parseCommandLevelSkillsTable()` and confirm it reads only the `## Command-Level Skills` heading region of `agents.md`. (S)
  - File: `scripts/lib/capability-matrix.ts`
  - Verify: `grep -n "parseCommandLevelSkillsTable\|Command-Level Skills" scripts/lib/capability-matrix.ts` shows the parser slice boundaries.
  - Risk: Low
- [ ] Step 0.6: Read `tests/hooks/agent-metadata-sync.test.ts` — identify the temp-fixture path setup and the 7 existing assertions whose logic must remain identical after retargeting. (S)
  - File: `tests/hooks/agent-metadata-sync.test.ts`
  - Verify: `grep -n "agents.md\|tmp\|expect" tests/hooks/agent-metadata-sync.test.ts` enumerates the fixture path and assertions.
  - Risk: Low
- [ ] Step 0.7: Read `tests/lib/capability-matrix.test.ts` — confirm tests reference `## Command-Level Skills` only (no dependency on Agent Catalog or Auto-Invoke). (S)
  - File: `tests/lib/capability-matrix.test.ts`
  - Verify: `grep -n "Agent Catalog\|Auto-Invoke\|Command-Level" tests/lib/capability-matrix.test.ts` returns hits ONLY for `Command-Level`.
  - Risk: Low
- [ ] Step 0.8: Pre-flight grep for cross-references that might break after Step 9-11 trim. (S)
  - Files: `.claude/{skills,agents,commands}/`
  - Verify: `grep -rn "Agent Catalog\|Hook Catalog\|Command Reference" .claude/{skills,agents,commands}/` — record matches; if non-empty, append a Phase 4.5 wording-update step before commit.
  - Risk: Low

### Phase 1: Create CATALOG.md files (additive, breaks nothing)

- [ ] Step 1.1: Create `.claude/agents/CATALOG.md`. (S)
  - File: `.claude/agents/CATALOG.md` (new)
  - Content: copy lines 71-101 verbatim from `.claude/rules/common/agents.md` (Agent Catalog 16-row table + Auto-Invoke list). Add YAML frontmatter `description: Full agent catalog with triggers and skills. Read on-demand by agent-metadata-sync hook and /medik Check #14.` Add HTML comment `<!-- DO NOT AUTO-LOAD: this file is read on-demand by agent-metadata-sync.js and human readers. -->` immediately after frontmatter.
  - Verify: `wc -l .claude/agents/CATALOG.md` returns ~35 lines; `grep -c "^|" .claude/agents/CATALOG.md` returns 18 (16 agent rows + 2 header/separator).
  - Depends on: Phase 0 complete
  - Risk: Low
- [ ] Step 1.2: Create `.claude/hooks/CATALOG.md`. (S)
  - File: `.claude/hooks/CATALOG.md` (new)
  - Content: copy lines 12-93 verbatim from `.claude/rules/common/hooks.md` (Hook Catalog 22 hooks across 9 sub-tables + Shared Modules table for 8 modules). Same frontmatter + DO-NOT-AUTO-LOAD comment pattern as Step 1.1.
  - Verify: `grep -c "^|" .claude/hooks/CATALOG.md` returns rows for 22 hooks + 8 modules + sub-table headers (~50 pipe-prefixed lines).
  - Depends on: Phase 0 complete
  - Risk: Low
- [ ] Step 1.3: Create `.claude/commands/CATALOG.md`. (S)
  - File: `.claude/commands/CATALOG.md` (new)
  - Content: copy lines 51-90 verbatim from `.claude/rules/common/development-workflow.md` (Command Reference 11 commands across 7 phase sub-tables). Same frontmatter + DO-NOT-AUTO-LOAD comment pattern.
  - Verify: `grep -c "^|" .claude/commands/CATALOG.md` returns rows for 11 commands + sub-table headers.
  - Depends on: Phase 0 complete
  - Risk: Low
- [ ] Step 1.4: VERIFICATION GATE — manual auto-load check. (S)
  - File: N/A (runtime check)
  - Verify: User restarts Claude Code session, runs `/context`, and confirms NONE of `.claude/agents/CATALOG.md`, `.claude/hooks/CATALOG.md`, `.claude/commands/CATALOG.md` appear in the Memory files section.
  - ABORT path: if ANY of the three files appears in Memory files, abort Phase 2-5 and replan with fallback to `.claude/reference/CATALOG.md` (a directory Claude Code does not auto-traverse). Document the failure mode in the ADR-035 superseder before retrying.
  - Depends on: 1.1, 1.2, 1.3
  - Risk: Medium (load-bearing assumption from ADR-017 precedent — verified via _TEMPLATE.md.example, but a future Claude Code release could change resolver behavior)

### Phase 2: Repoint agent-metadata-sync hook (TDD)

- [ ] Step 2.1: Write failing test (RED). (S)
  - File: `tests/hooks/agent-metadata-sync.test.ts`
  - Action: update the temp-fixture setup to create `.claude/agents/CATALOG.md` (not `.claude/rules/common/agents.md`) and update the assertion that reads back the synced table to read from the new path. Keep all 7 assertion shapes identical in logic.
  - Verify: `npx vitest run tests/hooks/agent-metadata-sync.test.ts` reports a failing test (red) — the hook still writes to the OLD path.
  - Depends on: Phase 1 GATE passed
  - Risk: Low
- [ ] Step 2.2: Repoint hook target path (GREEN). (S)
  - File: `.claude/hooks/scripts/agent-metadata-sync.js`
  - Action: change the variable that resolves the full-table sync target (identified in Step 0.4) from `.claude/rules/common/agents.md` to `.claude/agents/CATALOG.md`. Leave the CLAUDE.md sync block (brief two-column Agent | Model table) UNCHANGED.
  - Verify: `npx vitest run tests/hooks/agent-metadata-sync.test.ts` reports green — Step 2.1 test passes; previously-passing assertions remain green.
  - Depends on: 2.1
  - Risk: Low
- [ ] Step 2.3: Refactor — confirm no dead code paths remain. (S)
  - File: `.claude/hooks/scripts/agent-metadata-sync.js`
  - Action: re-read the hook end-to-end; remove any leftover references to `rules/common/agents.md` if they exist as constants or comments. No behavioral change.
  - Verify: `grep -n "rules/common/agents" .claude/hooks/scripts/agent-metadata-sync.js` returns zero matches.
  - Depends on: 2.2
  - Risk: Low
- [ ] Step 2.4: Run full Vitest suite — confirm zero regressions. (S)
  - Files: all tests under `tests/`
  - Verify: `npm run build && npx vitest run` reports 1069+ tests pass (Step 2.1 test now green; no other tests regress).
  - Depends on: 2.3
  - Risk: Low

### Phase 3: Trim three rule files (no new code, docs/rules only)

- [ ] Step 3.1: Trim `.claude/rules/common/agents.md`. (S)
  - File: `.claude/rules/common/agents.md`
  - Action: REMOVE lines 71-101 (`## Agent Catalog (16)` table + `## Auto-Invoke (no prompt needed)` list). KEEP all other sections including `## Command-Level Skills` (REQUIRED — `parseCommandLevelSkillsTable()` consumer), Orchestration Chain, Skill Loading, Routing principles, Manual Rules, Parallel Execution, Approval Criteria, Communication, Skill capability declaration, Agent Template Contract. ADD pointer line directly after Skill Loading rules block: `> Full Agent Catalog (triggers, skills) -> see .claude/agents/CATALOG.md.`
  - Verify: `grep -c "^## " .claude/rules/common/agents.md` shows the removed `## Agent Catalog` and `## Auto-Invoke` headings are gone; `grep -c "^## Command-Level Skills" .claude/rules/common/agents.md` returns 1.
  - Depends on: Phase 2 complete
  - Risk: Medium (pre-flight grep from Step 0.8 must have returned zero or all matches must be patched here)
- [ ] Step 3.2: Trim `.claude/rules/common/hooks.md`. (S)
  - File: `.claude/rules/common/hooks.md`
  - Action: REMOVE lines 12-93 (`## Hook Catalog (22 registered)` 9 sub-tables + `## Shared Modules (8)` table). KEEP Exit Codes, Safety, Performance, Data, Plugin-Mode Runtime Resolution, Windows Compatibility. ADD pointer directly after Exit Codes: `> Full Hook Catalog (22 hooks + 8 modules) -> see .claude/hooks/CATALOG.md.`
  - Verify: `grep -c "^## " .claude/rules/common/hooks.md` shows `## Hook Catalog` and `## Shared Modules` headings are gone; remaining sections intact.
  - Depends on: 3.1
  - Risk: Low
- [ ] Step 3.3: Trim `.claude/rules/common/development-workflow.md`. (S)
  - File: `.claude/rules/common/development-workflow.md`
  - Action: REMOVE lines 51-90 (`## Command Reference (11)` with 7 phase sub-tables). KEEP Order, /chekpoint Tiers, Commits, Research, Enforcement. ADD pointer directly after `/chekpoint Tiers`: `> Full Command Reference (11 commands) -> see .claude/commands/CATALOG.md.`
  - Verify: `grep -c "^## Command Reference" .claude/rules/common/development-workflow.md` returns 0; `grep -c "^## /chekpoint Tiers\|^## Commits\|^## Research\|^## Enforcement" .claude/rules/common/development-workflow.md` returns 4.
  - Depends on: 3.2
  - Risk: Low
- [ ] Step 3.4: Re-run `/medik` Check #14 — capability-alignment must still PASS. (S)
  - File: N/A (diagnostic run)
  - Verify: `/medik` reports Check #14 PASS — `parseCommandLevelSkillsTable()` finds the `## Command-Level Skills` section in the trimmed `agents.md`. If FAIL, Step 3.1 inadvertently removed the Command-Level Skills section; revert and redo Step 3.1.
  - Depends on: 3.1, 3.2, 3.3
  - Risk: Low (mitigated — Step 3.1 explicitly preserves the section)

### Phase 4: Update doks agent (S)

- [ ] Step 4.1: Update `.claude/agents/doks.md` Documentation Files table. (S)
  - File: `.claude/agents/doks.md`
  - Action: in the `## Documentation Files` table, ADD a Layer 1.5 row covering `.claude/{agents,hooks,commands}/CATALOG.md` with description "Reference catalogs (16 agents / 22 hooks / 11 commands) — read on-demand, drift-checked by /doks". Update Layer 2 rules description wording to "operational logic" (replace any "catalog" wording).
  - Verify: `grep -c "CATALOG.md" .claude/agents/doks.md` returns >=3 (one per artifact type).
  - Depends on: Phase 3 complete
  - Risk: Low

### Phase 5: Verification + commit (M)

- [ ] Step 5.1: Token audit. (S)
  - File: N/A (runtime check)
  - Verify: `/context` Memory files section reports < 28k tokens (down from 32.6k baseline). If still >= 28k, investigate via `/context` line-by-line — likely a CATALOG.md auto-loaded (regression of Step 1.4 gate).
  - Depends on: Phase 4 complete
  - Risk: Low
- [ ] Step 5.2: Mechanical verification suite. (M)
  - File: N/A (CI suite)
  - Verify:
    1. `npm run build` succeeds (no TypeScript errors).
    2. `npx vitest run` reports 1069+ tests pass.
    3. `/medik` reports 14/14 PASS (Check #14 critical).
    4. End-to-end hook test: edit any agent's `model:` frontmatter field, save, observe `agent-metadata-sync.js` writes to `.claude/agents/CATALOG.md` (NOT `.claude/rules/common/agents.md`); CLAUDE.md brief two-column table also updates.
    5. `/doks` reports CATALOG.md row counts match filesystem (16 agents / 22 hooks / 11 commands).
  - Depends on: 5.1
  - Risk: Low
- [ ] Step 5.3: Commit each phase separately via `/chekpoint`. (S)
  - File: N/A (git workflow)
  - Action: 4 separate commits in this order:
    - Phase 1: `docs(catalogs): extract catalogs from rules into non-auto-loaded CATALOG.md files`. Reviewed: skip (docs-only).
    - Phase 2: `fix(hooks): repoint agent-metadata-sync to agents/CATALOG.md`. Reviewed: lite (typescript-reviewer).
    - Phase 3: `refactor(rules): trim catalogs from agents/hooks/development-workflow rules`. Reviewed: skip (rules metadata).
    - Phase 4: `docs(doks): teach docs-sync about CATALOG.md layer`. Reviewed: skip (rules metadata).
  - Verify: `git log --oneline -4` shows the 4 commits in order; each commit body includes `Reviewed:` footer per `git-workflow.md` rules.
  - Depends on: 5.2
  - Risk: Low
- [ ] Step 5.4: Final commit body references ADR-035 + plan-035. (S)
  - File: N/A (git workflow)
  - Action: ensure the Phase 4 commit body (the last in the series) includes `Refs: ADR-035, plan-035` so the audit trail is complete.
  - Verify: `git log -1 --format=%B` on the Phase 4 commit shows the references.
  - Depends on: 5.3
  - Risk: Low

### Testing Strategy

- **Unit (existing, no new files)**: `tests/hooks/agent-metadata-sync.test.ts` — fixture path retargeted in Step 2.1; 7 assertions unchanged in logic.
- **Unit (no change required)**: `tests/lib/capability-matrix.test.ts` — `## Command-Level Skills` section preserved verbatim in `agents.md`; no test edit needed (verified Step 0.7).
- **Integration**: `/medik` 14/14 PASS post-Phase 3 (Step 3.4) and post-Phase 5 (Step 5.2). Check #14 is the load-bearing gate — confirms parser still finds Command-Level Skills.
- **End-to-end (manual)**: Step 5.2 item 4 — edit an agent's `model:` field, observe hook writes to new CATALOG.md target.
- **Smoke (manual)**: Step 1.4 `/context` auto-load gate — single load-bearing manual check on the ADR-017 non-auto-load assumption.

### Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| CATALOG.md auto-loads (assumption from ADR-017 precedent fails) | Low | Step 1.4 manual `/context` gate. Fallback: `.claude/reference/CATALOG.md` documented in ADR-035 risk section. ABORT Phase 2-5 if gate fails. |
| `agent-metadata-sync.js` test fixture mismatch after retarget | Medium | Step 2.1 explicitly re-shapes fixture as RED test before hook edit; Step 2.2 turns it green; Step 2.4 runs full suite. |
| Skills/agents reference removed sections by literal heading ("see Agent Catalog above") | Low | Step 0.8 pre-flight grep on `.claude/{skills,agents,commands}/`; if non-empty, patch wording before Phase 3 commit. |
| Plugin distribution loses CATALOG.md | Zero | CATALOG.md ships inside `.claude/{type}/` — already covered by plugin manifest (ADR-010) + canonical root symlinks (ADR-019). No installer change. |
| `/medik` Check #14 false fail (Command-Level Skills section accidentally removed) | Low | Step 3.1 explicitly preserves the section verbatim; Step 3.4 re-runs Check #14 immediately after trim. |

### Rollback

Per-phase `git revert <sha>` (commits land in 4 separate commits per Step 5.3):

- Revert Phase 4 commit -> doks table reverts to pre-CATALOG.md wording (CATALOG.md still exists, drift check still works manually).
- Revert Phase 3 commit -> rules return to fat form with full catalogs (CATALOG.md still exists, harmless duplication restored).
- Revert Phase 2 commit -> hook writes to old path again (CATALOG.md becomes stale shadow but does not break anything; agents.md restored as authority).
- Revert Phase 1 commit -> CATALOG.md files disappear (rules already restored if Phase 3 reverted; if Phase 3 still trimmed, BLOCK rollback and redo Phase 3 revert first).

Hard rollback signal: `/medik` Check #14 fails OR `agent-metadata-sync.js` emits "agent not found in catalog" warnings during `/chekpoint`. Both reversible without DB or migration impact.

### Critical Files (12 modified)

**Trim (3, Phase 3)**
- `C:\Command-Center\Kadmon-Harness\.claude\rules\common\agents.md` (147 -> ~75 lines)
- `C:\Command-Center\Kadmon-Harness\.claude\rules\common\hooks.md` (121 -> ~40 lines)
- `C:\Command-Center\Kadmon-Harness\.claude\rules\common\development-workflow.md` (109 -> ~60 lines)

**Create (3, Phase 1)**
- `C:\Command-Center\Kadmon-Harness\.claude\agents\CATALOG.md` (new)
- `C:\Command-Center\Kadmon-Harness\.claude\hooks\CATALOG.md` (new)
- `C:\Command-Center\Kadmon-Harness\.claude\commands\CATALOG.md` (new)

**Update (2, Phase 2 + Phase 4)**
- `C:\Command-Center\Kadmon-Harness\.claude\hooks\scripts\agent-metadata-sync.js` (repoint full-table target path)
- `C:\Command-Center\Kadmon-Harness\.claude\agents\doks.md` (Documentation Files table gains Layer 1.5)

**Tests (1, Phase 2)**
- `C:\Command-Center\Kadmon-Harness\tests\hooks\agent-metadata-sync.test.ts` (fixture path retargeted; 7 assertions unchanged in logic)

**No-change verify (1)**
- `C:\Command-Center\Kadmon-Harness\scripts\lib\capability-matrix.ts` (Step 0.5 confirms `parseCommandLevelSkillsTable()` reads ONLY `## Command-Level Skills`; no edit needed)

**Decision/plan artifacts (2)**
- `C:\Command-Center\Kadmon-Harness\docs\decisions\ADR-035-rules-catalog-source-of-truth.md` (already accepted)
- `C:\Command-Center\Kadmon-Harness\docs\plans\plan-035-rules-catalog-source-of-truth.md` (this file)

### Success Criteria

- [ ] `/context` Memory files section drops from 32.6k to < 28k tokens (Step 5.1).
- [ ] All 1069+ Vitest tests pass (Step 5.2 item 2).
- [ ] `npm run build` succeeds with zero TypeScript errors (Step 5.2 item 1).
- [ ] `/medik` 14/14 PASS, especially Check #14 capability-alignment (Step 3.4 + Step 5.2 item 3).
- [ ] `agent-metadata-sync.js` end-to-end writes to `.claude/agents/CATALOG.md` after agent frontmatter edit; CLAUDE.md two-column table sync unaffected (Step 5.2 item 4).
- [ ] `/doks` confirms CATALOG.md row counts match filesystem (16 agents / 22 hooks / 11 commands) (Step 5.2 item 5).
- [ ] All four commits land with `Reviewed:` footer matching the tier table (Step 5.3).
- [ ] No CATALOG.md file appears in `/context` Memory files section (Step 1.4 gate held).
