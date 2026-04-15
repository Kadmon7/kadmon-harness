---
number: 12
title: Skill frontmatter YAML syntax fix — 16 agents migration
date: 2026-04-14
status: completed
needs_tdd: false
route: A
adr: ADR-012-skill-frontmatter-syntax-fix.md
supersedes: plan-011-skill-loading-enforcement.md
---

## Plan: Skill frontmatter YAML syntax fix — 16 agents migration [konstruct]

### Overview

Fix a one-line-per-file YAML bug in all 16 agent definitions so Claude Code's native skill-injection loader actually fires. Every agent currently declares `skills: a, b, c` as a comma-separated scalar, which YAML parses as a single string and the loader silently drops. Converting each file to a block-list (`skills:\n  - a\n  - b`) makes the 46-skill catalog functional knowledge-in-context instead of passive documentation. The passive "## Skill Reference" prose sections are deleted in the same edits because they were the workaround for a loader we thought was missing. Implements ADR-012; supersedes plan-011.

### Prerequisites

- ADR-012 approved at `docs/decisions/ADR-012-skill-frontmatter-syntax-fix.md` (2026-04-14)
- Plan-011 remains on disk marked `superseded_by: plan-012` (no code shipped from it)
- All 16 agent files confirmed to use broken comma-scalar syntax (including `kerka.md` with single value — still a string, not a list)
- `agent-metadata-sync.js` does not parse the `skills:` field at all (grep confirmed); no parser update required
- No Claude Code API changes; the native loader documented at `docs.claude.com/en/docs/claude-code/sub-agents` has existed for months

### Scope

**Modified** (20 files total):
- 16 agents: `.claude/agents/{kody, typescript-reviewer, python-reviewer, orakle, spektr, arkitect, konstruct, feniks, mekanik, kurator, arkonte, almanak, doks, kartograf, alchemik, kerka}.md`
- `.claude/rules/common/agents.md` — Skill Loading section + Agent Catalog note
- `CLAUDE.md` — no count changes, but Skill Loading mention verified
- Potentially `.claude/hooks/scripts/agent-metadata-sync.js` — only if Step 1 audit finds parser assumptions about the scalar form

**Read-only references**: ADR-012, ADR-011, plan-011, plan-010 (format baseline)

**Optional new files (Step 5, follow-up)**:
- `scripts/lint-agent-frontmatter.ts`
- `tests/lib/lint-agent-frontmatter.test.ts`

### Reused utilities

- `yaml` package (already in `package.json` via existing usage; otherwise use built-in `js-yaml` or the pattern used by `agent-metadata-sync.js`)
- `/medik` phase hooks for optional linter wiring
- Existing Vitest setup at `tests/lib/`

### Phase 0: Research (complete)

- [x] Read `docs/decisions/ADR-012-skill-frontmatter-syntax-fix.md` (implementing it)
- [x] Read `docs/decisions/ADR-011-skill-loading-enforcement.md` (what NOT to do)
- [x] Read `.claude/agents/kody.md` (pilot target and template source)
- [x] Read `.claude/agents/alchemik.md` frontmatter (8-skill extreme case)
- [x] Read `.claude/agents/kerka.md` frontmatter (single-skill case: `skills: deep-research` — still broken, same fix)
- [x] Grep `^skills:` across `.claude/agents/*.md` — all 16 broken, none use list syntax
- [x] Read `.claude/hooks/scripts/agent-metadata-sync.js` — confirmed it does not parse `skills:` at all, so no parser update is needed; only test fixtures (if any) may need the new shape

### Phase 1: Audit and pilot

- [ ] **Step 1: Audit current state (S)**
  - Files: `.claude/agents/*.md` (read-only)
  - Actions: grep `^skills:` to print the full current scalar value for each of the 16 files; grep the repo for `"Skill Reference"` and `## Skill Reference` to list which agent files carry the passive section (all do, per ADR-012 evidence — verify); grep `skills` in `agent-metadata-sync.js` and `tests/hooks/agent-metadata-sync.test.ts` to confirm zero references (Phase 0 already confirmed none in the hook script)
  - Verify: audit output pasted into the plan commit body or into a scratch note; every agent file classified as `list | scalar`; Phase 2 does not start until all 16 are confirmed `scalar`
  - Risk: Low

- [ ] **Step 2: Pilot on kody (S)**
  - File: `.claude/agents/kody.md`
  - Actions: rewrite `skills: coding-standards, receiving-code-review, git-workflow, github-ops, regex-vs-llm-structured-text` as a 5-item YAML block list; delete the "## Skill Reference" prose section (lines 10-12); leave everything else untouched
  - Commit: `fix(agents): migrate kody skills frontmatter to YAML list format` — tier `lite` (ts-reviewer)
  - Empirical verification: invoke kody via `/chekpoint lite` against a trivial test-only diff in a fresh session; inspect the sub-agent's `observations.jsonl` under `~/.claude/projects/<project>/memory/observations/` for the session; **expected**: kody applies `coding-standards` conventions without ever issuing a Read against `.claude/skills/coding-standards.md`, because the content is already injected at spawn; **not-expected**: kody asks to read skill files first, or the review output is generic without coding-standards specifics
  - **Halt rule**: if the pilot fails (skills not injected), stop the rollout and escalate. Do NOT proceed to Step 3. Possible causes: loader parses strictly, so syntax was still wrong; or Claude Code's injection mechanism has drifted from the documentation
  - Depends on: Step 1
  - Risk: Medium (the empirical outcome gates everything downstream)

### Phase 2: Rollout

- [ ] **Step 3: Rollout to remaining 15 agents (S)**
  - Files: `.claude/agents/{typescript-reviewer, python-reviewer, orakle, spektr, arkitect, konstruct, feniks, mekanik, kurator, arkonte, almanak, doks, kartograf, alchemik, kerka}.md`
  - Actions: apply the same two edits to each file — (a) rewrite `skills:` scalar as a YAML block list, (b) delete the `## Skill Reference` section where present. kerka's single-skill case becomes a single-item list (`- deep-research`). alchemik gets the 8-item list from ADR-012 evidence. Preserve every other character in every file
  - Commit: `fix(agents): migrate remaining 15 agent skill frontmatters to YAML list format` — tier `lite` (ts-reviewer). Single PR, one mechanical diff
  - Verify: `npx vitest run` full suite green (expected — only frontmatter touched); `agent-metadata-sync.js` fires on every edit and writes back to `CLAUDE.md`/`rules/common/agents.md` catalog without warnings (Step 1 already confirmed the hook doesn't touch `skills:`, so sync stays silent); spot-check by invoking alchemik (`/evolve` dry-run), konstruct (`/abra-kdabra` on a trivial task), and kerka (`/research` on a canned query) to confirm no regression
  - Depends on: Step 2 pilot verified clean
  - Risk: Low (same edit replicated 15 times; `/chekpoint lite` catches YAML breakage)

- [ ] **Step 4: Rules and docs (S)**
  - Files: `.claude/rules/common/agents.md`, `CLAUDE.md` (verify only), `.claude/hooks/scripts/agent-metadata-sync.js` (only if Step 1 found assumptions)
  - Actions: rewrite the "Skill Loading" section in `rules/common/agents.md` to (a) state that `skills:` in agent frontmatter is parsed as a YAML list by Claude Code's native loader which injects full skill content at sub-agent spawn, (b) quote the correct block-list syntax with an example, (c) link to ADR-012 and the official docs URL; update the Agent Catalog note to clarify that the catalog table's comma-separated skill names are human-readable shorthand while the authoritative syntax lives in each agent's frontmatter. Verify `CLAUDE.md` Agents table is unchanged (still 16). Touch `agent-metadata-sync.js` only if Step 1 surfaced old assumptions (unlikely per Phase 0)
  - Commit: `docs(agents): document correct skills frontmatter syntax and link ADR-012` — tier `skip` (docs/metadata per the `/chekpoint` tier table)
  - Verify: rendered section reads cleanly; any stray `## Skill Reference` references across docs caught by `rg "Skill Reference" docs/ .claude/` (grep the repo before deletion — see R3)
  - Depends on: Step 3
  - Risk: Low

### Phase 3: Optional follow-up

- [ ] **Step 5: Frontmatter linter (M, FOLLOW-UP — may ship separately)**
  - Files: `scripts/lint-agent-frontmatter.ts` (NEW), `tests/lib/lint-agent-frontmatter.test.ts` (NEW)
  - Actions: small CLI script that iterates `.claude/agents/*.md`, parses each frontmatter via `yaml`, asserts that `skills` is a `Array<string>` (not `string`, not `undefined` unless empty), and that every listed skill name has a matching file at `.claude/skills/<name>.md`. Exit 1 on any violation with a per-file message. Wire as a `/medik` phase check (new phase or extension to an existing one) and optionally as a pre-commit hook
  - Tests: happy path (kody post-fix); scalar regression (fixture reverts to the broken form — linter must fail); unknown skill name typo; missing `skills` field (allowed — exit 0); empty list (allowed — exit 0)
  - Commit: `feat(medik): add agent frontmatter linter to prevent skill syntax regression` — tier `full` (new code path)
  - Depends on: Step 4 merged
  - Risk: Low. Can ship in plan-012 or defer to plan-013

### Verification strategy

- **Empirical (Step 2 pilot)**: kody `/chekpoint lite` against a trivial diff, sub-agent observations inspected at `~/.claude/projects/<project>/memory/observations/`, expected absence of Read calls against `.claude/skills/coding-standards.md` confirming native injection is live
- **Regression (Step 3)**: `npx vitest run` full suite, expected ≥ 549 passing (current baseline), no new failures because production code paths are untouched
- **Sync hook (Step 3)**: any edit to an agent file fires `agent-metadata-sync.js` in PostToolUse; confirm no stderr warnings and that `CLAUDE.md` / `rules/common/agents.md` catalog rows are still well-formed after the edits
- **Manual smoke (Step 3)**: invoke alchemik, konstruct, kerka after the rollout; confirm they still produce expected output shape without the passive section
- **Docs grep (Step 4)**: `rg "Skill Reference" docs/ .claude/` finds zero results after Step 3; update any stragglers in Step 4

### Risks and mitigations

- **R1 — Lenient parser**: Claude Code might silently split the comma-scalar and the bug is elsewhere. *Mitigation*: Step 2 pilot is the halt gate. If native injection is already running on the current syntax, the rewrite is still safe (block-list is a strict superset) but the passive section deletion might regress agents that rely on their prose reference. In that case, reintroduce the prose section and investigate
- **R2 — `agent-metadata-sync.js` regression**: Phase 0 confirmed the hook ignores `skills:` entirely, so it should round-trip cleanly. *Mitigation*: if Step 1 surfaces any previously-unseen skill parsing in the hook, fix in the same Step 3 PR with updated fixtures
- **R3 — Passive section references elsewhere**: other docs may link to "Skill Reference" anchors. *Mitigation*: `rg "Skill Reference" docs/ .claude/` before Step 3 deletions; update or remove stale references in Step 4
- **R4 — kerka is a single-skill case**: YAML parses `skills: deep-range` as a one-element string, not a list. *Mitigation*: kerka is still rewritten to `- deep-research` single-item block list in Step 3; no special case
- **R5 — CLAUDE.md agent count**: the fix must not change the agent count (still 16). *Mitigation*: Step 4 explicitly re-verifies

### Rollout sequence (commits)

1. **Commit 1 (Step 2)**: `fix(agents): migrate kody skills frontmatter to YAML list format` — `lite` tier, ts-reviewer
2. **Commit 2 (Step 3)**: `fix(agents): migrate remaining 15 agent skill frontmatters to YAML list format` — `lite` tier, ts-reviewer
3. **Commit 3 (Step 4)**: `docs(agents): document correct skills frontmatter syntax and link ADR-012` — `skip` tier
4. **Commit 4 (Step 5, optional)**: `feat(medik): add agent frontmatter linter to prevent skill syntax regression` — `full` tier, may defer to plan-013

### Follow-ups after merge

- If Step 5 deferred, open a short plan-013 for the linter alone
- Document `SubagentStart` hook in `.claude/rules/common/hooks.md` as an available mechanism not currently used (informational; relevant because ADR-011 would have needed it)
- Consider a `/forge` pattern to flag agents whose observations never Read their listed skills — detects drift indirectly
- Review date: **2026-05-14** — verify no regressions in agent behavior, check whether any agent needs different always-load skills now that injection actually works, close out ADR-012

### Success criteria

- [ ] All 16 agent files ship with `skills:` as a YAML block list (verified via grep for `^skills:` pattern — zero scalar matches)
- [ ] All passive `## Skill Reference` sections deleted from agent files
- [ ] `kody` pilot empirically confirms skills are injected at sub-agent spawn (observations trace lacks explicit skill Reads)
- [ ] `npx vitest run` passes (≥ 549 tests)
- [ ] `.claude/rules/common/agents.md` Skill Loading section documents correct YAML list syntax and links ADR-012
- [ ] `CLAUDE.md` agent count remains 16
- [ ] `agent-metadata-sync.js` produces no stderr warnings on the rollout edits
- [ ] Optional: frontmatter linter shipped or explicitly deferred with reason recorded in follow-ups
