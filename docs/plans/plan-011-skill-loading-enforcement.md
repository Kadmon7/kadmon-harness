---
number: 11
title: Skill loading enforcement — Phase 0 + audit hook rollout
date: 2026-04-14
status: superseded
superseded_by: plan-012-skill-frontmatter-syntax-fix.md
needs_tdd: false
route: A
adr: ADR-011-skill-loading-enforcement.md
---

# Plan 011: Skill loading enforcement — Phase 0 + audit hook rollout [konstruct]

## 1. Overview

Implements ADR-011 (Option 5 Hybrid). Ship two coordinated changes: (a) a uniform "Phase 0 — Load Skills" imperative block in every agent `.md` file and a "Step 0 — Load Command Skills" block in every command `.md` whose frontmatter carries `skills:` and which runs skills in the main session; (b) a non-blocking `skill-load-audit.js` PostToolUse hook matching `Task` that measures always-load compliance per sub-agent invocation, emits a stderr warning on drift, and persists `skillLoadCompliance` events via `logHookEvent()`. The 46-skill catalog becomes knowledge-in-context instead of documentation, and drift becomes observable input to `/forge` and `/evolve`. See `docs/decisions/ADR-011-skill-loading-enforcement.md` for the full alternatives matrix and rationale — this plan does not relitigate them.

`needs_tdd: false` because the bulk of the rollout is mechanical edits to `.md` files (16 agents, 7 commands after Step 1 filtering, 1 rules file). The only code surface is `skill-load-audit.js` + a 4-case Vitest test; feniks is welcome to guide that sliver TDD-style during implementation, but plan-level TDD enforcement is overkill for the docs mass.

## 2. Goals and non-goals

**Goals (implementation checkpoints tied to ADR-011).**

- G1: Every agent file has a Phase 0 block that lists 1–2 always-load skills with STOP-before-work wording; hard cap of 2 always-load skills per agent.
- G2: Every conditional-load skill has a concrete trigger (keyword, file type, or task-signal phrase). Vague triggers are a defect.
- G3: Every command in the Step 1 verified list has a Step 0 block that Reads its command-level `skills:` frontmatter entries before delegation. Commands that delegate entirely to one sub-agent are excluded (they rely on that sub-agent's Phase 0).
- G4: `skill-load-audit.js` ships registered under `PostToolUse` with matcher `Task`, passes 4 Vitest cases, and never exits 2.
- G5: `.claude/rules/common/agents.md` "Skill Loading" section is rewritten from aspirational MUST to enforced convention with a pointer to ADR-011 and the new hook.
- G6: Full Vitest suite remains green post-change (549 → ~553 passing with the 4 new cases).

**Non-goals (mirrored from ADR-011).**

- No `PreAgentUse` hook (Claude Code exposes none).
- No inlining of skill content into agent files (ADR-011 Option 3 rejected).
- No pre-reading into Task prompts (ADR-011 Option 4 rejected).
- No blocking enforcement (`exit 2`). Skipping Phase 0 is a quality issue, not a safety issue.
- No schema changes to YAML `skills:` frontmatter; `agent-metadata-sync` still treats it as the declarative catalog source of truth.
- No edits to the 4 command-level skills (`verification-loop`, `strategic-compact`, `skill-creator:skill-creator` plugin) — they remain direct-loaded per `rules/common/agents.md` "Command-Level Skills" section.
- No skill content edits. Catalog stays at 46.
- No validation that sub-agents correctly *apply* skill guidance — only that they Read the declared files. Application quality is `agent-eval` (via `/evolve`) and `/chekpoint` territory.

## 3. Prerequisites

- ADR-011 approved and in `status: accepted` or `status: proposed` with user sign-off for rollout.
- Baseline inventory: 16 specialist agents in `.claude/agents/`, 12 slash commands in `.claude/commands/`, 46 skills in `.claude/skills/`. Verified 2026-04-14.
- 549 tests passing (Vitest), 54 test files. Confirmed by current CLAUDE.md status line.
- No changes to Claude Code's hook API required. All work fits inside existing `PostToolUse` matcher system.

## 4. Always-load vs conditional-load framework

**Rule of thumb.**

- **Always-load** (1–2 skills max per agent): the skill defines the agent's core methodology and applies to every invocation. If more than two "feel core", pick the two most universal and push the rest to conditional.
- **Conditional-load** (0–N skills): situational. Every entry MUST have a concrete trigger phrased "If <specific signal>, Read <skill>". No vague triggers.

**Definitive table for all 16 agents.** Sourced from current frontmatter (`grep ^skills: .claude/agents/*.md`, 2026-04-14). Step 2 is the "finalize and review" checkpoint for this table.

| Agent | Always-load (max 2) | Conditional-load with triggers |
|---|---|---|
| kody | `coding-standards`, `receiving-code-review` | `git-workflow` (if commit/branch/PR context), `github-ops` (if `gh` CLI involved), `regex-vs-llm-structured-text` (if task parses unstructured text via regex or LLM) |
| typescript-reviewer | `coding-standards` | `frontend-patterns` (if diff touches `.tsx`/`.jsx` or React code) |
| python-reviewer | `python-patterns` | `python-testing` (if diff touches `tests/` or test files), `claude-api` (if diff uses Anthropic SDK) |
| orakle | `database-migrations`, `postgres-patterns` | `content-hash-cache-pattern` (if diff introduces a cache layer over hashed content) |
| spektr | `security-review`, `safety-guard` | `security-scan` (if a scanner CLI or dependency audit is in scope) |
| arkitect | `architecture-decision-records`, `api-design` | `hexagonal-architecture` (if task mentions ports/adapters/boundaries), `docker-patterns` (if task mentions Docker, container, Dockerfile, compose) |
| konstruct | `architecture-decision-records`, `codebase-onboarding` | `eval-harness` (if plan requires eval setup or test fixtures), `council` (if multiple viable approaches and arbitration is needed) |
| feniks | `tdd-workflow` | `python-testing` (if target is `.py`), `eval-harness` (if task requires eval fixtures), `ai-regression-testing` (if task touches prompts/model behavior) |
| mekanik | `systematic-debugging` | `agent-introspection-debugging` (if the failing target is a sub-agent or hook, not user code) |
| kurator | `coding-standards` | (none — single-skill agent) |
| arkonte | `context-budget`, `token-budget-advisor` | `benchmark` (if task calls for a perf benchmark or timing harness) |
| almanak | `documentation-lookup` | `mcp-server-patterns` (if task mentions MCP server, MCP tool, or Context7 server setup). Note: `deep-research` was moved to kerka (ADR-009); if still in almanak's frontmatter, Step 4 PR-D removes it. |
| doks | `docs-sync` | `skill-stocktake` (if task touches `.claude/skills/`), `rules-distill` (if task touches `.claude/rules/`), `code-tour` (if task asks for a walkthrough or onboarding doc) |
| kartograf | `e2e-testing` | (none — single-skill agent) |
| alchemik | `search-first`, `continuous-learning-v2` | `skill-stocktake` (if step involves skill catalog audit), `agent-eval` (if step involves agent quality review), `prompt-optimizer` (if step tunes a prompt), `skill-comply` (if step is a skill quality check), `workspace-surface-audit` (if step inventories the harness), `cost-aware-llm-pipeline` (if step analyzes cost or model routing) |
| kerka | `deep-research` | (none — deep-research IS the methodology) |

**Notes.**

- kurator, kartograf, kerka are single-skill agents. Their "always-load" is just the one skill; their conditional list is empty. The Phase 0 template still applies — the STOP-before-work phrasing matters even at `n=1`.
- alchemik is the heaviest agent (8 declared skills). The hard cap of 2 always-load turns it into 2 always-load + 6 conditional — the biggest context win of the whole rollout.
- The almanak row includes a cleanup: per ADR-009, `deep-research` moved to kerka. If the live `almanak.md` frontmatter still lists it, Step 4 PR-D removes it at the same time as the Phase 0 rewrite.

## 5. Phase 0 template

**Agent template** (replaces existing passive "Skill Reference" section, positioned immediately after the role statement and BEFORE any workflow/review/planning step):

```markdown
## Phase 0 — Load Skills (mandatory, before any analysis)

STOP. Before doing ANY work on the task, use the Read tool to load these files in order:

**Always load:**
1. `.claude/skills/<always-load-skill-1>.md`
2. `.claude/skills/<always-load-skill-2>.md`  (if applicable)

**Conditional — load ONLY if the trigger applies:**
- If <trigger 1>, Read `.claude/skills/<conditional-skill-1>.md` before proceeding.
- If <trigger 2>, Read `.claude/skills/<conditional-skill-2>.md` before proceeding.

Do not proceed to Phase 1 until the always-load reads complete. If a Read fails, report the failure and abort the task. Conditional reads may be skipped when their trigger does not apply.

## Phase 1 — <agent's existing first workflow step>
...
```

**Command template** (Step 0 block for command files with `skills:` frontmatter that run skills in the main session):

```markdown
## Step 0 — Load Command Skills (mandatory, before invoking agents)

Before delegating to any agent or running any phase, use the Read tool to load the command's declared skills:

- `.claude/skills/<skill-from-frontmatter-1>.md`
- `.claude/skills/<skill-from-frontmatter-2>.md`

These skills guide the orchestration itself. Agents invoked in later steps will perform their own Phase 0 loads for their agent-specific skills.

## Step 1 — <command's existing first step>
...
```

## 6. Implementation steps

Sequential order. Sizes: S (trivial), M (multi-file or nontrivial logic), L (cross-cutting). Every step names files touched and verification.

### Step 1 — Verify command scope (S)

Grep `.claude/commands/*.md` for `^skills:` in frontmatter. Current verified output (2026-04-14):

- `abra-kdabra.md` — `architecture-decision-records, tdd-workflow, eval-harness` — multi-agent chain (arkitect→konstruct→feniks→kody). Main session runs orchestration logic. **Needs Step 0.**
- `chekpoint.md` — `verification-loop, coding-standards, receiving-code-review, safety-guard` — multi-agent chain (5 reviewers). `verification-loop` is a command-level skill (see `rules/common/agents.md` Command-Level Skills section) loaded directly by the command's Phase 1. **Needs Step 0** for the remaining three.
- `forge.md` — `continuous-learning-v2` — direct (no agent). **Needs Step 0.**
- `kompact.md` — `context-budget` — direct (no agent). `context-budget` + `strategic-compact` are the decision-matrix guides for compaction. **Needs Step 0.**
- `medik.md` — `systematic-debugging, coding-standards` — multi-agent chain (mekanik, kurator). Main session runs 7 health checks before delegation. **Needs Step 0.**
- `skanner.md` — `context-budget, e2e-testing` — multi-agent chain (arkonte, kartograf). Main session runs the assessment. **Needs Step 0.**
- `research.md` — `deep-research` — single-agent delegation (kerka). kerka's Phase 0 will load `deep-research` itself. **SKIP Step 0** — the sub-agent's Phase 0 fires and double-loading wastes context.

Commands that lack `skills:` frontmatter entirely (`almanak.md`, `doks.md`, `evolve.md`, `kadmon-harness.md`) are out of scope for Step 0 because they have no command-level skills to load. Their sub-agents still fire Phase 0 for agent-level skills.

**Final Step 5 rollout list: 6 commands** (`abra-kdabra`, `chekpoint`, `forge`, `kompact`, `medik`, `skanner`). `research` is excluded by delegation.

- File: `.claude/commands/*.md` (read-only grep)
- Verify: the bullet list above matches `grep -n '^skills:' .claude/commands/*.md` output exactly.
- Depends on: none.
- Risk: Low.

### Step 2 — Finalize the always/conditional table (M)

Review the table in Section 4 above against the current state of each agent file. For each row, confirm:

- Always-load column has 1 or 2 skills only (hard cap).
- Every conditional entry has a concrete trigger (no "if relevant", no "if needed").
- All listed skills exist in `.claude/skills/` (no 404s).
- The row reflects the current frontmatter declaration (detects the deep-research migration edge case for almanak).

- File: this plan file (Section 4 table), no code changes.
- Verify: `ls .claude/skills/<name>.md` succeeds for every named skill; `grep -n '^skills:' .claude/agents/<agent>.md` matches the row's union of always + conditional.
- Depends on: Step 1.
- Risk: Low.

### Step 3 — Pilot on kody (S)

Apply the agent template to `.claude/agents/kody.md`. Replace the existing "## Skill Reference" paragraph (lines 10–12) with the Phase 0 block. Always-load: `coding-standards`, `receiving-code-review`. Conditional: `git-workflow` (if commit/branch/PR context), `github-ops` (if `gh` CLI involved), `regex-vs-llm-structured-text` (if parsing unstructured text). Reposition before "## Review Process".

Invoke kody via a real `/chekpoint lite` against a small test-only diff. Open the sub-agent's observations log at `%TMP%/kadmon/<sessionId>/observations.jsonl` and confirm the first two tool calls are `Read` events on `.claude/skills/coding-standards.md` and `.claude/skills/receiving-code-review.md` — before any `Bash git diff` or analysis call.

If the reads don't fire, iterate on the imperative wording (stronger STOP cues, explicit file paths, numbered order) and retest on the same diff until compliance passes. Only proceed to Step 4 after a clean pilot.

- File: `.claude/agents/kody.md`
- Verify: observations.jsonl shows `{toolName: "Read", filePath: ".claude/skills/coding-standards.md"}` and `.../receiving-code-review.md` as the first two sub-agent tool calls. Full Vitest suite still green.
- Depends on: Steps 1–2.
- Risk: Medium (the whole rollout hinges on this template actually working in practice).

### Step 4 — Roll out to remaining 15 agents (M)

Apply the template mechanically to the other 15 agent files, grouped into 4 PRs to keep review load bounded:

- **PR-A (reviewers):** `typescript-reviewer.md`, `python-reviewer.md`, `orakle.md`, `spektr.md`.
- **PR-B (architecture):** `arkitect.md`, `konstruct.md`, `feniks.md`.
- **PR-C (build/repair):** `mekanik.md`, `kurator.md`, `arkonte.md`, `kartograf.md`.
- **PR-D (research/evolve):** `almanak.md` (+ cleanup: remove stale `deep-research` from frontmatter if still present per ADR-009), `kerka.md`, `doks.md`, `alchemik.md`.

Each PR uses `/chekpoint lite` with ts-reviewer only — the rule "docs-only → skip" is overridden here because these files shape runtime behavior and template drift must be caught. Reviewed footer: `Reviewed: lite (ts-reviewer)`.

- File: 15 files across `.claude/agents/*.md`.
- Verify: `grep -l "Phase 0 — Load Skills" .claude/agents/*.md` returns all 16 agent files. `npx tsc --noEmit` green. `npx vitest run` green.
- Depends on: Step 3 pilot passes.
- Risk: Medium (template drift across 15 edits; R5 mitigation below).

### Step 5 — Apply Step 0 to commands (S)

Single PR applying the command template to the 6 commands identified in Step 1: `abra-kdabra`, `chekpoint`, `forge`, `kompact`, `medik`, `skanner`. For `chekpoint`, the Step 0 block lists `coding-standards`, `receiving-code-review`, `safety-guard` only — `verification-loop` is already loaded inline as a command-level skill per `rules/common/agents.md` and should not be duplicated.

`/chekpoint skip` with a manual `git diff` review is the appropriate tier (commands are routing metadata and the edit is mechanical). Reviewed footer: `Reviewed: skip (verified mechanically)`.

- File: 6 files across `.claude/commands/*.md`.
- Verify: `grep -l "Step 0 — Load Command Skills" .claude/commands/*.md` returns exactly 6 files (not `research.md`). Full Vitest suite green.
- Depends on: Step 4.
- Risk: Low.

### Step 6 — Build `skill-load-audit.js` + Vitest test (M)

Write `.claude/hooks/scripts/skill-load-audit.js`:

- PostToolUse hook, matcher `Task`.
- Uses `parseStdin()` from `parse-stdin.js` for Windows-safe JSON parsing.
- Reads `tool_input.subagent_type` to get the invoked agent name.
- Reads the sub-agent's session-scoped observations file at `%TMP%/kadmon/<sessionId>/observations.jsonl` (reuse the reader pattern from `ts-review-reminder.js`).
- Maintains a hard-coded per-agent always-load map (16 entries) keyed by agent name. Source of truth: the table in Section 4 of this plan. Comment at the top of the file cross-references plan-011 so future edits know where to update.
- Extracts `Read` tool calls from observations and normalizes to skill filenames.
- Computes `missed = alwaysLoad - read`.
- If `missed.length > 0`: emits stderr JSON `{ warn: "skill-load-audit", agent, declared, read, missed }`, calls `logHookEvent()` with `skillLoadCompliance: { declared, read, missed }` in the event payload, and exits 1. Never exits 2.
- If agent not in map (e.g., third-party sub-agent type): exits 0 without warning.
- If observations file missing: exits 0 (gracefully).
- Wraps the whole body in try/catch and exits 0 on any unexpected error (per `rules/common/hooks.md` safety rule).
- Captures `start = Date.now()` at entry and passes `durationMs: Date.now() - start` to every `logHookEvent()` call (per Sprint C instrumentation convention and ADR-007).
- Reuses the frontmatter parser from `agent-metadata-sync.js` if the hook needs to validate that a declared skill actually exists (optional — simpler alternative is to trust the hard-coded map).

Write `tests/hooks/skill-load-audit.test.ts` with 4 cases (use `execFileSync` with `input` option for Windows-safe stdin, per `rules/typescript/testing.md`):

1. **Happy path:** agent=`kody`, observations contain Reads for `coding-standards.md` and `receiving-code-review.md` → exit 0, no stderr warning.
2. **Drift case:** agent=`kody`, observations contain only `coding-standards.md` → exit 1, stderr matches `{"warn":"skill-load-audit","agent":"kody","missed":["receiving-code-review"]`.
3. **No observations file:** agent=`kody`, tmp dir empty → exit 0 (graceful).
4. **Unknown agent:** agent=`some-third-party-agent`, observations present but agent not in map → exit 0, no warning.

- File: `.claude/hooks/scripts/skill-load-audit.js` (new), `tests/hooks/skill-load-audit.test.ts` (new).
- Verify: `npx vitest run tests/hooks/skill-load-audit.test.ts` — 4 passing. Full suite 549 → 553 passing.
- Depends on: Step 4 (needs the always-load table finalized).
- Risk: Medium.

### Step 7 — Register hook in `.claude/settings.json` (S)

Add a `PostToolUse` entry for `skill-load-audit` with `matcher: "Task"`, using the same `PATH="$PATH:/c/Program Files/nodejs"` prefix and `node .claude/hooks/scripts/skill-load-audit.js` command pattern used by every other hook in the file.

- File: `.claude/settings.json`
- Verify: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"` — no parse error. Invoke kody via Task in a small manual test; confirm `hook-events.jsonl` for the session contains a `skill-load-audit` event row.
- Depends on: Step 6.
- Risk: Low.

### Step 8 — Update `.claude/rules/common/agents.md` Skill Loading section (S)

Rewrite lines 16–20 (current "Skill Loading" section) from aspirational MUST to enforced convention. New content:

- Document the Phase 0 convention (agent template) and the Step 0 convention (command template).
- Cite `ADR-011-skill-loading-enforcement.md` as the authoritative source.
- Reference the `skill-load-audit` hook as the feedback loop and link to `rules/common/hooks.md` where the hook catalog row will also be added.
- Keep the existing "Skill Loading" MUST for commands but reframe it as "enforced by Step 0 convention; measured by `skill-load-audit` hook".
- Add one sentence on the always/conditional split with the hard cap of 2 always-load skills per agent.

Also bump `rules/common/hooks.md` catalog count (20 → 21 → 22) and add a row for `skill-load-audit` under "PostToolUse — all tools" (or add a new "PostToolUse — Task matcher" subsection if cleaner).

- File: `.claude/rules/common/agents.md`, `.claude/rules/common/hooks.md`.
- Verify: `grep -n "skill-load-audit" .claude/rules/common/*.md` returns hits in both files. `grep -n "ADR-011" .claude/rules/common/agents.md` returns one hit. CLAUDE.md hook count line updated (21 → 22).
- Depends on: Step 7.
- Risk: Low.

### Step 9 — Wire drift into `/forge` (M, OPTIONAL follow-up)

Add a pattern definition in `.claude/hooks/pattern-definitions.json` that matches repeated `skillLoadCompliance.missed` entries per agent within a rolling window and proposes it as an instinct. This closes the Observe → Evolve loop so that chronic drift feeds `/forge` → `/evolve` automatically.

**This step MAY ship separately after Steps 1–8 land clean.** It is optional because (a) it requires real telemetry to validate, (b) pattern-definitions.json edits should follow the `file_sequence` / `tool_arg_presence` / `cluster` schema which requires a careful matcher design, and (c) the rollout value is captured by Steps 1–8 alone — Step 9 is iteration.

- File: `.claude/hooks/pattern-definitions.json`.
- Verify: `npx vitest run tests/lib/patterns.test.ts` (or equivalent) green; new pattern fires on a synthetic ClusterReport fixture containing 5 missed-skill events for one agent.
- Depends on: Steps 1–8 merged; 1+ week of live telemetry from the audit hook.
- Risk: Medium.

## 7. Critical files

### Read-only reference (understand existing patterns before editing)

- `.claude/agents/kody.md` — pilot target for Step 3. Current passive "Skill Reference" section at lines 10–12 is exactly what gets replaced.
- `.claude/agents/alchemik.md` — most complex agent (8 declared skills, 6 conditional after the hard cap).
- `.claude/agents/kerka.md` — simplest agent (single skill, empty conditional list).
- `.claude/commands/chekpoint.md` — example command with `skills:` frontmatter + multi-agent delegation.
- `.claude/commands/research.md` — single-agent delegation; the reason Step 1 excludes it from Step 5.
- `.claude/rules/common/agents.md` lines 16–20 — aspirational MUST being promoted to enforced in Step 8.
- `.claude/hooks/scripts/ts-review-reminder.js` — reference implementation for a warning-only PostToolUse hook that reads observations.jsonl and emits structured stderr JSON. Closest analog to the new `skill-load-audit.js`.
- `.claude/hooks/scripts/no-context-guard.js` — additional reader reference for session-scoped observations path.
- `.claude/hooks/scripts/log-hook-event.js` — `logHookEvent()` API. Note: `durationMs` is REQUIRED per Sprint C instrumentation; capture `start = Date.now()` at hook entry.
- `.claude/hooks/scripts/parse-stdin.js` — Windows-safe stdin helper.
- `.claude/hooks/scripts/agent-metadata-sync.js` — existing YAML frontmatter parser that can be reused instead of re-implementing if the audit hook wants to validate declared skill names against the frontmatter at runtime.

### Modified

- `.claude/agents/kody.md` (Step 3)
- `.claude/agents/typescript-reviewer.md`, `python-reviewer.md`, `orakle.md`, `spektr.md` (Step 4 PR-A)
- `.claude/agents/arkitect.md`, `konstruct.md`, `feniks.md` (Step 4 PR-B)
- `.claude/agents/mekanik.md`, `kurator.md`, `arkonte.md`, `kartograf.md` (Step 4 PR-C)
- `.claude/agents/almanak.md`, `kerka.md`, `doks.md`, `alchemik.md` (Step 4 PR-D)
- `.claude/commands/abra-kdabra.md`, `chekpoint.md`, `forge.md`, `kompact.md`, `medik.md`, `skanner.md` (Step 5)
- `.claude/settings.json` (Step 7)
- `.claude/rules/common/agents.md` (Step 8)
- `.claude/rules/common/hooks.md` (Step 8)
- `CLAUDE.md` (Step 8: bump hook count 21 → 22, update status line)

### New

- `.claude/hooks/scripts/skill-load-audit.js` (Step 6)
- `tests/hooks/skill-load-audit.test.ts` (Step 6)

### Unchanged (explicit)

- YAML `skills:` frontmatter schema across all 16 + 7 files. Still the declarative catalog source; `agent-metadata-sync` still honors it.
- All 46 skill files in `.claude/skills/`. No content edits, no renames, no new skills.
- The 4 command-level skills (`verification-loop`, `strategic-compact`, `skill-creator:skill-creator` plugin) per `rules/common/agents.md` "Command-Level Skills" section.
- `~/.kadmon/kadmon.db` schema. No migration. `hook_events.metadata` is already a JSON blob and accepts the new `skillLoadCompliance` field without a schema change.

## 8. Reused utilities

- `parseStdin()` from `.claude/hooks/scripts/parse-stdin.js` — Windows-safe JSON stdin parsing.
- `logHookEvent()` from `.claude/hooks/scripts/log-hook-event.js` — hook event persistence. `durationMs` required per ADR-007.
- Observations JSONL reader pattern from `ts-review-reminder.js` lines 25–54 — path resolution, read, line-by-line JSON parse with try/catch skip on malformed.
- YAML frontmatter parser from `agent-metadata-sync.js` — only if the audit hook chooses to validate declared skill names at runtime. The simpler path is a hard-coded map regenerated from this plan's Section 4 table.
- `isDisabled()` from `parse-stdin.js` — honor `KADMON_DISABLED_HOOKS=skill-load-audit` for test bypass.
- `execFileSync` pattern with `input` option for Vitest hook tests (Windows-safe) — see existing `tests/hooks/*.test.ts` for any current hook test.

## 9. Verification strategy

**End-to-end test (Step 3 pilot + Step 7 wiring).**

1. Apply Phase 0 template to `kody.md` (Step 3).
2. Run `/chekpoint lite` on a trivial test-only diff that invokes kody.
3. Open `%TMP%/kadmon/<sessionId>/observations.jsonl`.
4. Confirm the first two sub-agent tool calls are `Read` events on `.claude/skills/coding-standards.md` and `.claude/skills/receiving-code-review.md`, before any `Bash git diff` or analysis tool call.
5. After Step 7, remove `receiving-code-review.md` from kody's always-load template temporarily and repeat the invocation. Confirm `hook-events.jsonl` for the session contains a `skill-load-audit` event with `missed: ["receiving-code-review"]` and exit code 1. Revert the template change.

**Unit test (Step 6).**

`tests/hooks/skill-load-audit.test.ts` covers four cases: happy path, drift case, missing observations file, unknown agent. Target 4 new passing tests; full suite 549 → 553.

**Regression.**

- `npx vitest run` — full suite green after Step 6 merge.
- `npx tsc --noEmit` — green after every step that touches a `.ts` or `.js` file.
- `grep -l "Phase 0 — Load Skills" .claude/agents/*.md | wc -l` returns 16 after Step 4.
- `grep -l "Step 0 — Load Command Skills" .claude/commands/*.md | wc -l` returns 7 after Step 5.

**Compliance dashboard check (post-merge).**

After 3–5 days of real use, query `hook_events` for rows where `hookName = "skill-load-audit"`. Group by `agent` (from `metadata.skillLoadCompliance.agent`), compute `missed > 0` rate. Target: **< 30% drift per agent over a rolling 7-day window**. If any agent exceeds 30%, return to Step 3 logic: iterate on the Phase 0 wording for that specific agent (stronger STOP cues, reordered placement, explicit numbered list). Track iteration as a follow-up sub-PR.

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| R1: Sub-agents ignore Phase 0 even with imperative wording. | Pilot on kody first (Step 3). Audit hook surfaces real drift. Iterate wording before full rollout. Escalate to blocking only if 3-month review (2026-07-14) shows chronic drift > 30% per agent. |
| R2: Context bloat from over-generous always-load. | Hard cap of 2 always-load skills per agent; everything else conditional with an explicit trigger. alchemik (8 skills) turns into 2 always + 6 conditional. |
| R3: Conditional triggers too vague to ever fire. | Every conditional entry in Section 4 specifies a concrete keyword, file type, or task signal. Validated in Step 2. `/skanner` agent-eval runs catch silent never-firing triggers. |
| R4: Audit hook false positives on legitimate skips (trivial invocation where the skill does not apply). | Hook is warning-only (exit 1); single-run misses are ignored; only repeated drift per agent per week feeds `/evolve` proposals. |
| R5: Template drift across 16 parallel edits. | Apply edits mechanically from the single Section 5 template string. `/chekpoint lite` with ts-reviewer per PR catches YAML/frontmatter breakage. `grep -l "Phase 0"` count check after each PR. |
| R6: A command that delegates entirely to one sub-agent double-loads skills (command Step 0 + agent Phase 0). | Step 1 explicitly excludes `research.md` because it delegates fully to kerka. No other command is fully delegated: the other 7 either run skills in main session or use multi-agent chains where the main session still orchestrates. |
| R7: Claude Code ships a `PreAgentUse` hook after this ADR lands, making Phase 0 partially redundant. | Revisit at 2026-07-14 review date. The audit hook and the always/conditional table remain useful independently of any future runtime loader. |
| R8: Stale `deep-research` entry in almanak's frontmatter surfaces during the rollout. | Step 4 PR-D removes it as part of the almanak Phase 0 rewrite. Cross-reference ADR-009 in the PR body. |
| R9: `skill-load-audit.js` hard-coded map drifts from the Section 4 table over time. | Comment at the top of the hook file links to plan-011 Section 4 as source of truth. Optional follow-up: generate the map from `.claude/agents/*.md` frontmatter at startup via the `agent-metadata-sync.js` parser — defer to after real drift is observed. |

## 11. Rollout sequence and commits

Ordered commits. Each is independently revertible. All use conventional commit format with `Reviewed: <tier>` footer.

1. **Step 3 pilot** — `feat(agents): Phase 0 skill loading on kody (pilot for plan-011)`
   - Files: `.claude/agents/kody.md`
   - Reviewed: lite (ts-reviewer)
2. **Step 4 PR-A** — `feat(agents): Phase 0 skill loading on reviewer agents`
   - Files: `.claude/agents/{typescript-reviewer,python-reviewer,orakle,spektr}.md`
   - Reviewed: lite (ts-reviewer)
3. **Step 4 PR-B** — `feat(agents): Phase 0 skill loading on architecture agents`
   - Files: `.claude/agents/{arkitect,konstruct,feniks}.md`
   - Reviewed: lite (ts-reviewer)
4. **Step 4 PR-C** — `feat(agents): Phase 0 skill loading on build/repair agents`
   - Files: `.claude/agents/{mekanik,kurator,arkonte,kartograf}.md`
   - Reviewed: lite (ts-reviewer)
5. **Step 4 PR-D** — `feat(agents): Phase 0 skill loading on research/evolve agents`
   - Files: `.claude/agents/{almanak,kerka,doks,alchemik}.md` (includes ADR-009 deep-research cleanup on almanak)
   - Reviewed: lite (ts-reviewer)
6. **Step 5** — `feat(commands): Step 0 skill loading on 6 commands`
   - Files: `.claude/commands/{abra-kdabra,chekpoint,forge,kompact,medik,skanner}.md`
   - Reviewed: skip (verified mechanically)
7. **Steps 6 + 7** — `feat(hooks): skill-load-audit PostToolUse hook + Vitest test`
   - Files: `.claude/hooks/scripts/skill-load-audit.js` (new), `tests/hooks/skill-load-audit.test.ts` (new), `.claude/settings.json` (register hook).
   - Reviewed: full (ts-reviewer + spektr — touches observation log read + stderr output)
8. **Step 8** — `docs(rules): promote Skill Loading to enforced + update hook catalog (plan-011)`
   - Files: `.claude/rules/common/agents.md`, `.claude/rules/common/hooks.md`, `CLAUDE.md` (hook count 21 → 22)
   - Reviewed: skip (docs + metadata only)
9. **Step 9 follow-up (optional, separate sprint)** — `feat(forge): detect skill-load drift pattern for /evolve`
   - Files: `.claude/hooks/pattern-definitions.json`, optional test update.
   - Reviewed: full (pattern definitions touch the evolve pipeline)

Target total: 8 commits for core rollout, 1 optional follow-up. Sprint-sized work (~1–2 focused days).

## 12. Follow-ups after merge

- **Review date: 2026-07-14** (3 months post-acceptance per ADR-011). Pull `hook_events` for `skill-load-audit`, compute per-agent drift over a rolling 7-day window. Success: all 16 agents < 30% drift. If any agent exceeds 30%, iterate on Phase 0 wording for that agent specifically; if multiple agents exceed 30%, revisit template structure globally.
- **Escalation path if compliance < 70%:** (a) tighten Phase 0 wording (stronger STOP cues, Reads-as-numbered-list with explicit "before any other tool call" phrasing); (b) add concrete Phase 0 examples in each agent body; (c) escalate to blocking enforcement only if soft drift persists past 2026-07-14 AND user signs off on a new ADR.
- **Step 9 wiring into `/forge` pattern definitions** (optional). Ship after 1+ week of live telemetry so the pattern's window size and drift threshold can be tuned from real data. Open as a separate plan if it grows.
- **Bootstrap distribution.** plan-003 bootstrap must carry the new agent/command templates, the new hook, the new settings.json entry, and the rules update to all future projects. Verify in the first post-merge bootstrap test run.
- **Superseded rule line.** `.claude/rules/common/agents.md` lines 16–20 are superseded by Step 8's rewrite. The ADR-011 reference lives there as the authoritative source.

## Success criteria

- [ ] All 16 agents show `## Phase 0 — Load Skills` block with STOP-before-work wording and hard cap of 2 always-load skills.
- [ ] All 7 in-scope commands show `## Step 0 — Load Command Skills` block.
- [ ] `research.md` explicitly excluded from Step 5 (single-agent delegation to kerka).
- [ ] `.claude/hooks/scripts/skill-load-audit.js` registered in `.claude/settings.json` under `PostToolUse` with matcher `Task`. Never exits 2.
- [ ] 4 new Vitest cases passing (`tests/hooks/skill-load-audit.test.ts`).
- [ ] Full Vitest suite green (549 → 553).
- [ ] `npx tsc --noEmit` green.
- [ ] kody pilot shows both always-load skills read before any other tool call in observations.jsonl.
- [ ] `.claude/rules/common/agents.md` "Skill Loading" section rewritten to enforced + links to ADR-011.
- [ ] CLAUDE.md hook count updated to 22.
- [ ] 3-month review scheduled for 2026-07-14.
