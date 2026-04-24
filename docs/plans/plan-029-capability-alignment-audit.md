---
number: 29
title: Capability & Metadata Alignment Audit
date: 2026-04-24
status: accepted
needs_tdd: true
route: A
adr: ADR-029-capability-alignment-audit.md
---

# Plan-029: Capability & Metadata Alignment Audit [konstruct]

## Overview

Implement Path B from ADR-029 as a new `/medik` check that detects five classes of metadata drift across agents, skills, commands, and `rules/common/agents.md`. The check rides the modular `runCheck(ctx) -> CheckResult` contract paved by plan-028. Introduces a reusable `buildCapabilityMatrix()` builder and an opt-in `requires_tools:` skill frontmatter field (with a body-scan fallback) so capability mismatch becomes deterministic. Seed adopters are `council` and `deep-research`.

## Assumptions

- Plan-028 Phase 4/5 check modules exist at `scripts/lib/medik-checks/*.ts` — verified by direct read. `types.ts` exports the canonical `CheckStatus | CheckCategory | CheckContext | CheckResult` shapes (validated: status vocabulary is `"PASS" | "NOTE" | "WARN" | "FAIL"`; category vocabulary is `"core" | "runtime" | "code-hygiene" | "knowledge-hygiene"`).
- `/medik` already documents checks 10-13 as the new modular checks — validated against `.claude/commands/medik.md` lines 30-47.
- Check **#9 is already taken by "Install health"** (see `.claude/commands/medik.md` line 30). The ADR's nominal "Check #9" is therefore **renumbered to Check #14** in this plan — the next free slot after 13. This is the pre-flight renumbering the ADR's `no_context Application` section explicitly flagged.
- There is **no check registry file yet** (`scripts/lib/medik-checks/index.ts` does not exist; `medik.ts` does not exist). Phase 1 health checks currently run as direct commands per-row in `.claude/commands/medik.md`. Each new check is invoked by a one-shot `npx tsx` command in the table. Plan-029 follows this same pattern rather than inventing a registry.
- "Command-Level Skills" table lives at `.claude/rules/common/agents.md` lines 158-169 — parsed by scanning rows between the `## Command-Level Skills` heading and the next `##` heading, extracting the first backticked identifier per row.
- Skill loader and existing frontmatter linter ignore unknown top-level YAML keys — adding `requires_tools:` to skill frontmatter is backward compatible (confirmed by `scripts/lib/lint-agent-frontmatter.ts` which only inspects `skills:` and has no strict key list).

## Phase 0: Coordination & Sequencing Gate

- [ ] **Step 0.1**: Verify plan-028 Phase 4/5 check modules are tracked in git on `release/v1.3` (S)
  - File: N/A (inspection only)
  - Commands:
    - `git status --porcelain scripts/lib/medik-checks/` — MUST be empty (no untracked, no modified)
    - `git ls-files scripts/lib/medik-checks/` — MUST list `types.ts`, `stale-plans.ts`, `hook-health-24h.ts`, `instinct-decay-candidates.ts`, `skill-creator-probe.ts`
    - `git log --oneline --grep="plan-028" release/v1.3 -- scripts/lib/medik-checks/` — MUST show at least one commit
  - Decision tree:
    - All three pass → proceed to Step 0.2.
    - `git status --porcelain` shows untracked or modified files in `scripts/lib/medik-checks/` → **STOP**. Parallel VSCode session is still editing. Notify user: "plan-028 artifacts not yet committed; defer plan-029 until the sibling session has landed its PR." Do NOT proceed, do NOT create `capability-alignment.ts`.
    - Files tracked but commits not on `release/v1.3` → **STOP**. Ask user which branch plan-028 is landing on and wait for merge.
  - Verify: the "MUST" commands above.
  - Risk: **HIGH** — clobbering parallel work. This is the single most important gate in the plan.
  - Depends on: none

- [ ] **Step 0.2**: `git pull origin release/v1.3` on the working tree (S)
  - File: N/A
  - Command: `git pull --ff-only origin release/v1.3`
  - Verify: `git log -1 --format='%H %s'` matches the remote head (`git ls-remote origin release/v1.3` returns same SHA).
  - Depends on: 0.1
  - Risk: Low

- [ ] **Step 0.3**: Open feature branch `feature/capability-alignment-check` from fresh `release/v1.3` (S)
  - File: N/A
  - Command: `git checkout -b feature/capability-alignment-check`
  - Verify: `git branch --show-current` prints the branch name.
  - Depends on: 0.2
  - Risk: Low

- [ ] **Step 0.4**: Confirm Check #14 is the next free slot (S)
  - File: N/A
  - Commands:
    - `grep -E "^\| ?(9|1[0-9])" .claude/commands/medik.md` — enumerate current check numbers
    - Expected current range: 1-8, 9, 10, 11, 12, 13
  - Verify: no existing row uses `| 14 |`. If 14 is taken, pick next free slot (15, 16, ...) and use that number throughout plan-029 (mechanical rename in later steps).
  - Depends on: 0.2
  - Risk: Low

## Phase 1: Capability Matrix Module (reusable, no /medik wiring yet)

- [ ] **Step 1.1**: Write failing unit tests for `parseAgentFrontmatter()` and `parseSkillFrontmatter()` helpers (M)
  - File: `tests/lib/capability-matrix.test.ts`
  - Content: inline fixture strings (no on-disk scan). Cover:
    - (a) agent with `tools: Read, Grep, Write` scalar form → returns `['Read','Grep','Write']`
    - (b) agent with `skills:` YAML block list → returns string array
    - (c) skill with `requires_tools: [Task]` flow-style → returns `['Task']`
    - (d) skill with `requires_tools:\n  - Task\n  - WebFetch` block-style → returns both
    - (e) skill without `requires_tools:` → returns `[]`
    - (f) malformed YAML → returns `{ error: string }` without throwing
  - Verify: `npx vitest run tests/lib/capability-matrix.test.ts` — all 6 tests RED (file does not exist yet).
  - Depends on: 0.3
  - Risk: Low

- [ ] **Step 1.2**: Implement `scripts/lib/capability-matrix.ts` — frontmatter parsers only (M)
  - File: `scripts/lib/capability-matrix.ts` (NEW)
  - Exports (partial — only what's needed to green Step 1.1):
    - `interface AgentEntry { name: string; filePath: string; tools: string[]; skills: string[]; model: string; }`
    - `interface SkillEntry { name: string; filePath: string; declaredOwner?: string; requiresTools: string[]; heuristicTools: string[]; isCommandLevel: boolean; }`
    - `interface CommandEntry { name: string; filePath: string; skills: string[]; agents: string[]; }`
    - `export function parseAgentFrontmatter(content: string, filePath: string): AgentEntry | { error: string }`
    - `export function parseSkillFrontmatter(content: string, filePath: string): SkillEntry | { error: string }`
  - Approach: reuse the regex pattern from `scripts/lib/lint-agent-frontmatter.ts` (`FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/`) and its block-list scanner for YAML list parsing. Support BOTH block-list (`- item`) and flow-style (`[item, item]`) for `tools:` and `requires_tools:`. Scalar comma-list (`Read, Grep, Write`) is supported for `tools:` (existing agent convention) but NOT for `requires_tools:` (new field — enforce block or flow form).
  - LOC budget: ≤50 prod LOC (two focused parsers).
  - Verify: `npx vitest run tests/lib/capability-matrix.test.ts` — all 6 tests GREEN.
  - Depends on: 1.1
  - Risk: Medium — YAML corner cases (quoted values, trailing comments).

- [ ] **Step 1.3**: Write failing tests for `buildCapabilityMatrix({ cwd })` (M)
  - File: `tests/lib/capability-matrix.test.ts` (append)
  - Content: create a temp dir with a minimal `.claude/agents/<x>.md`, `.claude/skills/<y>/SKILL.md`, `.claude/commands/<z>.md`, `.claude/rules/common/agents.md` fixture. Assert:
    - (g) `matrix.agents` length matches on-disk agent count
    - (h) `matrix.skills[i].isCommandLevel === true` for skill listed in the Command-Level Skills table
    - (i) `matrix.commands[i].skills` parses YAML list form `skills:\n  - foo`
    - (j) missing `.claude/` dir → returns empty matrix, not throw
  - Verify: 4 new tests RED.
  - Depends on: 1.2
  - Risk: Low

- [ ] **Step 1.4**: Implement `buildCapabilityMatrix(ctx: { cwd: string }): CapabilityMatrix` (M)
  - File: `scripts/lib/capability-matrix.ts` (extend)
  - Add:
    - `interface CapabilityMatrix { agents: AgentEntry[]; skills: SkillEntry[]; commands: CommandEntry[]; commandLevelSkills: Set<string>; parseErrors: string[]; }`
    - `export function buildCapabilityMatrix(ctx: { cwd: string }): CapabilityMatrix`
    - `function parseCommandLevelSkillsTable(agentsMdContent: string): Set<string>` — extracts backticked identifiers from rows between `## Command-Level Skills` and the next `##` heading. Strip `:plugin:` prefixes (e.g. `skill-creator:skill-creator` → `skill-creator`).
  - Approach: walk `<cwd>/.claude/agents/*.md` (skip `_`-prefix), `<cwd>/.claude/skills/*/SKILL.md`, `<cwd>/.claude/commands/*.md`. Read `<cwd>/.claude/rules/common/agents.md` once. Silently skip missing directories (consistent with `stale-plans.ts`). Push malformed-YAML files to `parseErrors` rather than throwing.
  - LOC budget: ≤50 prod LOC.
  - Verify: 4 new tests GREEN. Plus `npx tsc --noEmit` clean.
  - Depends on: 1.3
  - Risk: Medium — command-level skill table parsing is regex-fragile.

- [ ] **Step 1.5**: Write failing tests for heuristic body-scan `scanHeuristicTools(skillBody: string): string[]` (S)
  - File: `tests/lib/capability-matrix.test.ts` (append)
  - Content: inline strings. Assert:
    - (k) body with `via \`Task\`` outside code fence → returns `['Task']`
    - (l) body with `\`\`\`\nTask(...)\n\`\`\`` INSIDE fence → returns `[]` (stripped)
    - (m) body with `WebFetch` in instruction sentence → returns `['WebFetch']`
    - (n) body with no matches → returns `[]`
  - Verify: 4 tests RED.
  - Depends on: 1.4
  - Risk: Low

- [ ] **Step 1.6**: Implement `scanHeuristicTools()` (S)
  - File: `scripts/lib/capability-matrix.ts` (extend)
  - Export: `export function scanHeuristicTools(skillBody: string): string[]`
  - Approach:
    1. Strip fenced code blocks via `body.replace(/```[\s\S]*?```/g, '')`
    2. Strip inline code spans via `stripped.replace(/`[^`]+`/g, ' CODE ')` — keep the word boundary but remove the token so `\`Task\`` no longer matches `/\bTask\b/`. (Revise per test outcomes — if `(k)` requires backticked `Task` to match, drop the inline-code strip step and only strip fences.)
    3. Regex anchors per ADR-029: `/\bTask\s*\(/`, `/\bTask\s+tool\b/i`, `/\bWebFetch\s*\(/`, `/\bWebFetch\b/`, `/\bBash\s*\(/`
    4. De-duplicate. Return sorted.
  - LOC budget: ≤20 prod LOC.
  - Verify: 4 heuristic tests GREEN.
  - Depends on: 1.5
  - Risk: Medium — false positives drove the "WARN-only" decision in ADR-029; tests pin the exact expectation.

- [ ] **Step 1.7**: Wire heuristic into `buildCapabilityMatrix` — populate `SkillEntry.heuristicTools` (S)
  - File: `scripts/lib/capability-matrix.ts` (modify `buildCapabilityMatrix`)
  - Change: for every skill, call `scanHeuristicTools(bodyAfterFrontmatter)` and store on `SkillEntry.heuristicTools`.
  - Verify: Add one test `(o): skill body mentions \`Task\` but frontmatter lacks requires_tools → entry.heuristicTools=['Task'], entry.requiresTools=[]`. GREEN.
  - Depends on: 1.6
  - Risk: Low

## Phase 2: Violation detector (`findViolations`)

- [ ] **Step 2.1**: Write failing tests for each of the 5 violation kinds (M)
  - File: `tests/lib/capability-matrix.test.ts` (append)
  - Content: synthesize `CapabilityMatrix` fixtures in-memory (no filesystem) and assert violations:
    - (p) `capability-mismatch` (FAIL): skill has `requiresTools: ['Task']`, declared owner agent has `tools: ['Read']` → one FAIL violation, `subject` is skill name, `evidence` mentions `'Task'` and owner file
    - (q) `ownership-drift` (WARN): skill's `declaredOwner = 'agentA'` but `agentA.skills` does not list the skill → one WARN
    - (r) `path-drift` (FAIL): command has `skills: ['foo/SKILL.md']` (flat or nested) in a shape that doesn't resolve to `.claude/skills/foo/SKILL.md` → one FAIL
    - (s) `command-skill-drift` (FAIL): command references skill `ghost` which does not exist on disk → one FAIL
    - (t) `orphan-skill` (NOTE): skill has no owner AND not in `commandLevelSkills` → one NOTE
    - (u) heuristic tool mismatch (WARN, not FAIL): `heuristicTools: ['Task']`, `requiresTools: []`, owner lacks `Task` → WARN suggesting `requires_tools:` declaration
    - (v) clean matrix → empty violations array
  - Verify: 7 tests RED.
  - Depends on: 1.7
  - Risk: Low

- [ ] **Step 2.2**: Implement `findViolations(matrix: CapabilityMatrix): Violation[]` (M)
  - File: `scripts/lib/capability-matrix.ts` (extend)
  - Exports:
    - `type ViolationKind = 'capability-mismatch' | 'ownership-drift' | 'path-drift' | 'command-skill-drift' | 'orphan-skill' | 'heuristic-tool-mismatch'`
    - `interface Violation { kind: ViolationKind; severity: 'FAIL' | 'WARN' | 'NOTE'; subject: string; message: string; evidence: string; }`
    - `export function findViolations(matrix: CapabilityMatrix): Violation[]`
  - Approach: one pass, five-plus-one branches. Classification driven by ADR-029 "Detection rules" section verbatim. Use a helper `resolveOwner(skill, matrix)` that tries `skill.declaredOwner` first, then falls back to "agent whose `skills:` list contains this skill name". Owner not resolved AND skill not command-level → orphan-skill NOTE.
  - LOC budget: ≤50 prod LOC (guarded by helpers like `resolveOwner`, `isPathDrift`).
  - Verify: all 7 tests GREEN. `npx tsc --noEmit` clean.
  - Depends on: 2.1
  - Risk: Medium — classification logic has overlapping conditions (e.g., a mismatch plus an ownership-drift on the same skill). Tests pin the expected emission order.

## Phase 3: `requires_tools:` opt-in — seed adopters

- [ ] **Step 3.1**: Add `requires_tools: [Task]` to the council skill frontmatter (S)
  - File: `.claude/skills/council/SKILL.md`
  - Change: insert one line after `description:` and before the closing `---`:
    ```yaml
    requires_tools: [Task]
    ```
  - Verify: `npx vitest run tests/lib/capability-matrix.test.ts` — existing tests still green. `npx tsc --noEmit` clean. `npx tsx scripts/lint-agent-frontmatter.ts` still exits 0.
  - Depends on: 2.2
  - Risk: Low — field is opt-in; loader ignores unknown keys (verified against linter code).

- [ ] **Step 3.2**: Add `requires_tools: [Task, WebFetch]` to deep-research (S)
  - File: `.claude/skills/deep-research/SKILL.md`
  - Change: insert one line in frontmatter.
  - Verify: as Step 3.1.
  - Depends on: 3.1
  - Risk: Low

- [ ] **Step 3.3**: Document `requires_tools:` in the ADR-013 / ADR-012 lineage (S)
  - File: `.claude/rules/common/agents.md`
  - Change: append a short paragraph under the "Command-Level Skills" table (before "Agent Template Contract") explaining:
    - Purpose: "Skills that invoke sub-agents, WebFetch, or other tools outside their owner's default grant SHOULD declare `requires_tools:` as a YAML list in frontmatter. /medik Check #14 flags mismatches with FAIL severity."
    - Format: YAML flow (`[Task]`) or block list.
    - Opt-in: missing field falls back to heuristic scan (WARN-only).
  - LOC budget: ≤10 lines of prose, no table changes.
  - Verify: `grep -c "requires_tools" .claude/rules/common/agents.md` ≥ 2.
  - Depends on: 3.2
  - Risk: Low

## Phase 4: `capability-alignment.ts` check module

- [ ] **Step 4.1**: Write failing test for the check module entrypoint (M)
  - File: `tests/lib/medik-checks/capability-alignment.test.ts`
  - Content: mirror the pattern of `tests/lib/medik-checks/stale-plans.test.ts` (tmpdir fixture, inline writes). Tests:
    - (a) fixture tmpdir with aligned matrix (owner tools ⊇ skill requires_tools) → `runCheck` returns `{ status: 'PASS', category: 'runtime', message: /clean|aligned/i }`
    - (b) fixture with `capability-mismatch` violation → `{ status: 'FAIL', category: 'runtime' }`; `message` mentions the skill and missing tool
    - (c) fixture with only `orphan-skill` NOTE → `{ status: 'NOTE', category: 'knowledge-hygiene' }`
    - (d) fixture with mix (1 FAIL + 2 WARN + 1 NOTE) → status = worst = `FAIL`; message summarizes counts e.g. `"1 FAIL / 2 WARN / 1 NOTE"`
    - (e) missing `.claude/` dir → `{ status: 'PASS' }` (consistent with stale-plans.ts)
    - (f) malformed YAML in one agent → NOTE for that file, check does not throw; returned status reflects real violations only
  - Verify: 6 tests RED (file does not exist).
  - Depends on: 2.2, 0.4 (check-number choice)
  - Risk: Low

- [ ] **Step 4.2**: Implement `capability-alignment.ts` using the shared library (S)
  - File: `scripts/lib/medik-checks/capability-alignment.ts` (NEW)
  - Approach: thin adapter. Calls `buildCapabilityMatrix({ cwd: ctx.cwd })`, then `findViolations(matrix)`, then aggregates to a single `CheckResult`:
    - `status`: worst severity wins. `FAIL` > `WARN` > `NOTE` > `PASS`. Empty violations → `PASS`.
    - `category`: `runtime` if any FAIL/WARN is `capability-mismatch` or `heuristic-tool-mismatch`; else `knowledge-hygiene`.
    - `message`: summary line `"Capability alignment: N FAIL / M WARN / K NOTE"` plus first 3 violation subjects.
    - `details`: full `Violation[]` array for mekanik to consume in Phase 2.
  - Category choice rationale: ADR-029 classifies capability mismatch as `runtime` (breaks execution) and ownership/orphan as `knowledge-hygiene`. Aggregate falls to whichever dominates by severity.
  - LOC budget: ≤30 prod LOC.
  - Verify: all 6 Step-4.1 tests GREEN. `npx tsc --noEmit` clean. Category values all match the `CheckCategory` union from `types.ts`.
  - Depends on: 4.1
  - Risk: Low — logic is trivial once Phase 2 lands.

- [ ] **Step 4.3**: Register Check #14 in `.claude/commands/medik.md` (S)
  - File: `.claude/commands/medik.md`
  - Change: in the Phase 1 checks table under `**Runtime**` or a new sub-group `**Capability alignment**`, add:
    ```
    | 14 | Capability alignment | both | `scripts/lib/medik-checks/capability-alignment.ts` | 5 violation kinds: capability-mismatch (FAIL), ownership-drift (WARN), path-drift (FAIL), command-skill-drift (FAIL), orphan-skill (NOTE), heuristic-tool-mismatch (WARN) |
    ```
  - Update line 8: "Runs 13 mechanical checks" → "Runs 14 mechanical checks".
  - Update the Note block at line 47: "Checks 10-13" → "Checks 10-14".
  - Verify: `grep "| 14 |" .claude/commands/medik.md` returns one line. Preview the table rendering in GitHub markdown or a Markdown viewer if available.
  - Depends on: 4.2
  - Risk: Low

- [ ] **Step 4.4**: Add a CLI shim for ad-hoc invocation (S)
  - File: `scripts/lib/medik-checks/capability-alignment.ts` (append)
  - Change: at bottom of the file, add:
    ```typescript
    // CLI shim — `npx tsx scripts/lib/medik-checks/capability-alignment.ts`
    // Uses import.meta.url check to avoid running on import.
    if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
      const result = runCheck({ projectHash: 'cli', cwd: process.cwd() });
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === 'FAIL' ? 1 : 0);
    }
    ```
  - LOC budget: ≤8 LOC.
  - Verify: `npx tsx scripts/lib/medik-checks/capability-alignment.ts` prints JSON with `"status": "PASS"` (assuming Phase 3 adopters are in place) and exits 0.
  - Depends on: 4.3
  - Risk: Low — Windows file-URL normalization is the only gotcha (backslash → forward slash).

## Phase 5: Dogfood and smoke

- [ ] **Step 5.1**: Dogfood against `release/v1.3` working tree — expect PASS (S)
  - File: N/A (execution only)
  - Command: `npx tsx scripts/lib/medik-checks/capability-alignment.ts`
  - Expected: status PASS, message "Capability alignment: 0 FAIL / 0 WARN / 0 NOTE" OR a small set of NOTEs for known orphan utility skills.
  - If any FAIL appears: STOP. The discovery is the value — surface to user and decide whether to fix the underlying metadata issue or refine the detector. Do NOT proceed until FAIL count is zero.
  - Verify: exit code 0, status "PASS".
  - Depends on: 4.4
  - Risk: **Medium** — the check may surface real alignment bugs on landing. That is a feature, not a regression; but it requires user decision-making to resolve.

- [ ] **Step 5.2**: Synthetic-break dogfood — remove `Task` from council's conceptual owner, expect FAIL (S)
  - File: `.claude/skills/council/SKILL.md` (temporary)
  - Change: temporarily add `owner: konstruct` to council's frontmatter (so declaredOwner resolves to a real agent without `Task` in its tools). Keep `requires_tools: [Task]`.
  - Command: `npx tsx scripts/lib/medik-checks/capability-alignment.ts`
  - Expected: status FAIL, message contains "capability-mismatch" and "Task", exit code 1.
  - Verify: exit code 1, status "FAIL", details[0].kind === 'capability-mismatch'.
  - Revert: `git checkout -- .claude/skills/council/SKILL.md` immediately after verification.
  - Verify post-revert: step 5.1 passes again (`git status` clean, step 5.1 re-runs PASS).
  - Depends on: 5.1
  - Risk: Low (temp change, immediate revert; `git status` gate before any commit).

- [ ] **Step 5.3**: Full `/medik` run end-to-end (S)
  - File: N/A
  - Command: run the command `/medik` manually (or simulate: run all 14 check commands from `.claude/commands/medik.md` table).
  - Expected: all 14 checks PASS or WARN/NOTE only; no FAIL; mekanik and kurator have no findings attributable to Check #14.
  - Verify: the user (or a smoke summary) confirms all green.
  - Depends on: 5.2
  - Risk: Low

- [ ] **Step 5.4**: Performance budget check (S)
  - File: N/A
  - Command: time the CLI shim: `time npx tsx scripts/lib/medik-checks/capability-alignment.ts`
  - Target: < 150 ms wall-clock (per ADR-029 Implementation Notes). Run 3 times; median must be < 150 ms.
  - If over budget: open a follow-up issue; do not block the plan (perf is advisory). Add a `console.time` block to prove where time is spent for future optimization.
  - Verify: median elapsed < 150 ms OR follow-up issue filed.
  - Depends on: 5.3
  - Risk: Low

## Phase 6: Documentation sync

- [ ] **Step 6.1**: Update CLAUDE.md Status line (S)
  - File: `CLAUDE.md`
  - Change: under `## Status` near end of file, update test count `957 tests` → new count after this plan's tests land (run `npx vitest run` and take reported `Test Files` total). Add "Check #14 (capability-alignment)" to the feature list line if appropriate.
  - LOC budget: ≤3 lines changed.
  - Verify: `grep -E "[0-9]+ tests" CLAUDE.md` shows updated count matching `npx vitest run` output.
  - Depends on: 5.4
  - Risk: Low

- [ ] **Step 6.2**: Update `.claude/rules/common/hooks.md` (S)
  - File: `.claude/rules/common/hooks.md`
  - Change: no hook changes — Check #14 is a /medik check, not a hook. Instead: verify the existing Check #8 entry still accurately references `lint-agent-frontmatter.ts`. If nothing in `hooks.md` mentions check numbers, skip with a `# no changes needed` annotation in the commit body.
  - Verify: `grep -c "Check #" .claude/rules/common/hooks.md` — note current count and compare post-edit.
  - Depends on: 6.1
  - Risk: Low

- [ ] **Step 6.3**: Flip ADR-029 status to accepted (S)
  - File: `docs/decisions/ADR-029-capability-alignment-audit.md`
  - Change: frontmatter `status: proposed` → `status: accepted`. Amend "Implementation Notes → Sequencing" to note the final check number (#14, not #9 as originally written) as a post-hoc clarification (short footnote, do not rewrite the ADR — ADRs are append-only once accepted).
  - Verify: `grep "^status:" docs/decisions/ADR-029-capability-alignment-audit.md` returns `status: accepted`.
  - Depends on: 6.2
  - Risk: Low

- [ ] **Step 6.4**: Flip plan-029 status to accepted and commit (S)
  - File: `docs/plans/plan-029-capability-alignment-audit.md`
  - Change: frontmatter `status: pending` → `status: accepted`.
  - Run `/chekpoint` (full tier — production TS + .claude/rules + docs): feniks TDD workflow already established, typescript-reviewer + spektr + kody review, commit with `Reviewed: full` footer.
  - Verify: `git log -1 --format='%s%n%n%b'` contains conventional commit message and `Reviewed: full` footer.
  - Depends on: 6.3
  - Risk: Low

## Testing Strategy

- **Unit**:
  - `tests/lib/capability-matrix.test.ts` — 17+ tests covering frontmatter parsing (6), matrix building (4), heuristic scan (4), violation detection (7), end-to-end integration (1).
  - `tests/lib/medik-checks/capability-alignment.test.ts` — 6 tests covering the `runCheck` adapter (PASS, each severity class, missing `.claude/`, malformed YAML).
- **Integration**:
  - Phase 5 dogfood: real `release/v1.3` tree → PASS; synthetic break → FAIL; revert; re-PASS.
  - Full `/medik` smoke on Phase 5.3.
- **E2E**: none required — this is a lib + check module, not a user-facing workflow.
- **Regression**:
  - Existing `lint-agent-frontmatter.ts` tests must remain green (Check #8 is orthogonal).
  - All 4 existing plan-028 check modules' tests must remain green.
  - Pre-existing project test total: 957. Post-plan-029 target: 957 + ~24 new tests.

## Risks & Mitigations

- **Risk**: Parallel VSCode session still editing `scripts/lib/medik-checks/` → clobber. **Mitigation**: Phase 0 gate (Step 0.1) explicitly blocks plan execution until `git status --porcelain scripts/lib/medik-checks/` is empty. The most important gate in the plan.
- **Risk**: Check number collision — ADR nominally says #9 but #9 is taken. **Mitigation**: Step 0.4 verifies the slot; plan renumbers to #14 and flags the discrepancy in ADR-029 status amendment (Step 6.3).
- **Risk**: Heuristic false positives WARN-spam new contributors. **Mitigation**: heuristic is WARN-only, never FAIL; declaration is opt-in; emitted message includes the matching line for ~5s manual verification. ADR-029 §Risks explicitly accepted this.
- **Risk**: Performance budget overrun. **Mitigation**: Step 5.4 times the check; follow-up issue if > 150 ms; non-blocking.
- **Risk**: Dogfood reveals real alignment bugs in the current repo. **Mitigation**: THIS IS THE POINT. Surface to user, fix underlying metadata, land plan-029 only once `release/v1.3` is clean.
- **Risk**: `owner:` field not currently supported by the skill loader → adding it for testing could break something. **Mitigation**: Step 5.2 temp change is reverted before commit; no `owner:` field ships in production. Matrix builder falls back to "agent whose `skills:` list contains this skill" when `declaredOwner` is absent.
- **Risk**: Regex-based Command-Level Skills table parser breaks if the table format changes. **Mitigation**: parser is encapsulated in `parseCommandLevelSkillsTable()`; unit test (step 1.3 test h) pins the contract; change detection via `/medik` re-running the test suite.

## Success Criteria

- [ ] All Phase 0 gates passed; branch `feature/capability-alignment-check` forked from fresh `release/v1.3`.
- [ ] `scripts/lib/capability-matrix.ts` exists, exports `buildCapabilityMatrix`, `findViolations`, `parseAgentFrontmatter`, `parseSkillFrontmatter`, `scanHeuristicTools`.
- [ ] `scripts/lib/medik-checks/capability-alignment.ts` exists, implements the `runCheck(ctx) → CheckResult` contract from `types.ts`.
- [ ] `tests/lib/capability-matrix.test.ts` has ≥17 tests, all GREEN.
- [ ] `tests/lib/medik-checks/capability-alignment.test.ts` has ≥6 tests, all GREEN.
- [ ] Council skill declares `requires_tools: [Task]`; deep-research declares `requires_tools: [Task, WebFetch]`.
- [ ] `/medik` run on `release/v1.3` reports Check #14 as PASS (or clean WARN/NOTE — no FAIL).
- [ ] Synthetic break: removing `Task` from council's resolvable owner causes Check #14 to FAIL.
- [ ] Performance: CLI shim median runtime < 150 ms on a warm run.
- [ ] `npx vitest run` passes (total count documented in CLAUDE.md Status line).
- [ ] `npx tsc --noEmit` clean.
- [ ] ADR-029 status flipped to `accepted`; plan-029 status flipped to `accepted`.
- [ ] Commit `Reviewed: full` footer; PR opened against `release/v1.3`; all `/chekpoint` gates green.
