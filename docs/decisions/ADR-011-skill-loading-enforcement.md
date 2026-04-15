---
number: 11
title: Skill loading enforcement — Phase 0 imperative + diagnostic audit hook
date: 2026-04-14
status: proposed
route: A
plan: plan-011-skill-loading-enforcement.md
---

# ADR-011: Skill loading enforcement — Phase 0 imperative + diagnostic audit hook

> **Implementation Status:** Decision `proposed` 2026-04-14. Konstruct will follow with `plan-011-skill-loading-enforcement.md` for sequencing, PR slices, and test surfaces. No code written yet.

**Deciders**: Ych-Kadmon (architect), arkitect (agent)

## Status

Proposed — 2026-04-14. Supersedes the aspirational "Skill Loading" rule at `.claude/rules/common/agents.md:16-20` once accepted.

## Context

Kadmon Harness ships 46 reference skills in `.claude/skills/`, 16 specialist agents in `.claude/agents/`, and 12 slash commands in `.claude/commands/`. The design intent, codified in `rules/common/agents.md`, is that skills act as knowledge-in-context: an agent or command declares `skills: X, Y, Z` in its frontmatter and the runtime guarantees those files are loaded before work begins. An Explore audit on 2026-04-14 confirmed that this guarantee does not exist.

**Audit findings, anchored to files.**

1. **Frontmatter is metadata only.** Claude Code's `Task` tool uses an agent `.md` file as the sub-agent system prompt verbatim. It does NOT parse the YAML `skills:` field, does NOT Read the listed skill files, and does NOT inject their content into the sub-agent's context. Declaring `skills: coding-standards, receiving-code-review` in `.claude/agents/kody.md` has zero runtime effect today. It is catalog data for docs, dashboards, and `agent-metadata-sync` — not a loader.
2. **Body "Skill Reference" sections are passive.** Every current agent file ends with a block phrased as background prose: "When reviewing code, read `.claude/skills/coding-standards.md`." Sub-agents frequently skip those reads because the sections are not positioned as an ordered first step and contain no STOP-before-work instruction. Sub-agent observation logs (`observations.jsonl`) rarely show the declared skill files in the Read trace.
3. **7–8 of 12 commands** declare `skills:` in frontmatter but their body steps never instruct Claude to Read them. The rule at `rules/common/agents.md:16-20` ("MUST read skill files listed in command frontmatter") is aspirational language, not enforcement.
4. **No auto-loading mechanism exists.** No hook, no loader in `scripts/lib/`, no wrapper. No code path inside the harness reads a declared skill when an agent is invoked.

**Net effect.** The 46-skill catalog functions as documentation, not as knowledge-in-context. The user's investment in curating, evaluating, and promoting those skills is partially wasted. This violates the harness's Observe → Remember → Verify → Specialize → Evolve mantra: the Specialize step relies on skills being the substrate that shapes each agent's behavior, and today that substrate is silently absent for most invocations.

**Hard constraints that bound any fix.**

- Claude Code exposes no `PreAgentUse` hook. There is no runtime mechanism to inject text into a sub-agent's system prompt from outside its `.md` file.
- Skills range from 80 to 400+ lines. Eagerly reading every declared skill for every agent would burn context and violate the context-budget skill.
- Sub-agents do NOT inherit the main session's Read history. Pre-reading a skill in the orchestrator before calling `Task` does not pre-populate the sub-agent's context.
- The solution must work with existing hook types (`PreToolUse`, `PostToolUse`, `SessionStart`, `Stop`, `PreCompact`) and ship portably through the plan-003 bootstrap.

## Options Considered

### Option 1 — Imperative "Phase 0 — Load Skills" in agent/command bodies

Rewrite the passive "Skill Reference" section in every agent `.md` into an ordered first phase. Split declared skills into **always-load** (1–2 per agent, the agent's core methodology) and **conditional-load** (gated by concrete triggers). Position the Phase 0 block before any workflow step with a STOP instruction.

- **Pros:** zero new infrastructure; works through the only channel Claude Code actually honors (the agent `.md` as system prompt); preserves modularity; respects context budget via the always/conditional split.
- **Cons:** depends on sub-agent compliance with imperative wording; no automatic detection of drift; one-time rewrite across 16 agent files plus ~8 command files.

### Option 2 — Nudge hook (PostToolUse on `Task`)

Write `skill-load-audit.js`: a PostToolUse hook matching `Task` that reads the invoked sub-agent's `observations.jsonl`, compares the Read trace against a per-agent always-load map, and emits a stderr warning when any always-load skill was skipped. Non-blocking (exit 1). Events persist via `logHookEvent()` and feed into `/forge` and `/evolve` as drift data.

- **Pros:** closes the Observe loop; makes compliance measurable; surfaces regressions when agent files drift; zero effect on context size.
- **Cons:** observational only — cannot prevent a skip in the current invocation; adds one hook to maintain; depends on observation logs being present at audit time.

### Option 3 — Inline skill content into agent `.md` files

Copy the text of each declared skill directly into the agent file so the system prompt carries the knowledge without any Read.

- **Pros:** guaranteed loading; no runtime dependency on compliance.
- **Cons:** destroys modularity (skills are no longer the single source of truth); creates a drift surface (agent files now contain stale skill content); bloats system prompts massively (some agents would exceed 20k tokens); violates skill-stocktake discipline. REJECTED.

### Option 4 — Command-level pre-read into Task prompt

Have the command (main session) Read the skill files before calling `Task`, then pass the content inline as part of the `prompt` parameter to the sub-agent.

- **Pros:** loads skills mechanically at the orchestrator level.
- **Cons:** fragile — sub-agents do NOT inherit main session Read history; the only way to "pass" the content is to paste it into the prompt, which bloats every Task call and duplicates the inlining anti-pattern from Option 3; does not help agents invoked by other agents. REJECTED.

### Option 5 — HYBRID: Option 1 (primary) + Option 2 (feedback loop)

Ship both together. Option 1 is the enforcement mechanism: every agent file gets a Phase 0 block with always-load and conditional-load sections. Option 2 is the observability mechanism: `skill-load-audit.js` measures real compliance, surfaces drift, and feeds the Evolve loop.

- **Pros:** combines the only available enforcement channel with a measurable feedback loop; matches the harness's own Observe → Evolve philosophy; iterates on wording via the audit hook's telemetry rather than guessing; keeps every rejection (context bloat, inlining, fragile pre-reads) rejected.
- **Cons:** two coordinated changes instead of one; requires a hard cap convention (max 2 always-load skills per agent) to keep context usage bounded; success depends on sub-agent compliance with imperative wording — the audit hook detects failure but cannot correct it in-flight.

## Decision

**Adopt Option 5 (Hybrid).** Rewrite the 16 agent `.md` files and ~8 command `.md` files with a "Phase 0 — Load Skills" imperative block (primary enforcement), and register a non-blocking `skill-load-audit` PostToolUse hook that measures always-load compliance per invocation (feedback loop).

**Rationale tied to architectural principles.**

- **Only mechanism available today.** With no `PreAgentUse` hook, the agent `.md` body is the only channel that actually shapes sub-agent behavior. Option 1 uses that channel correctly; Options 3 and 4 fight it.
- **Preserves modularity.** Skills remain the single source of truth; agent files reference them by path. Option 3 was rejected exactly to protect this invariant.
- **Respects context budget.** The hard cap of 2 always-load skills per agent, with the rest gated by concrete triggers, bounds the worst-case Phase 0 read cost. An agent like `alchemik` (8 declared skills) becomes 2 always-load + 6 conditional instead of an 8-read tax on every invocation.
- **Closes the Observe → Remember → Verify → Specialize → Evolve loop.** Phase 0 is the Specialize step. The audit hook is the Observe step for drift. `/forge` (Remember) already consumes hook events; `/evolve` (Evolve) already proposes mutations from repeated drift patterns. Adding `skillLoadCompliance` data to `hook_events` plugs directly into the existing evolution pipeline without a new subsystem.
- **Iterates on evidence, not assumption.** The ADR does not claim the imperative wording will work on the first draft. It claims it is the correct channel, pilots the template on `kody` first (Step 3 of plan-011), measures via the audit hook, and refines wording from real telemetry. This matches the same pilot-then-rollout discipline used in ADR-005 and ADR-008.

## Consequences

**What changes.**

- Every agent file gains a Phase 0 block at the top of its workflow, replacing the passive "Skill Reference" section. The block is uniform across agents (shared template) and names specific always-load and conditional-load skills per agent.
- Every command file with `skills:` frontmatter gains a Step 0 block that Reads the command-level skills before delegation (except commands that delegate entirely to one agent, which rely on that sub-agent's Phase 0 — identified during plan-011 Step 1).
- A new hook `.claude/hooks/scripts/skill-load-audit.js` registers under `PostToolUse` with matcher `Task`. The hook cross-references the sub-agent's Read trace against a per-agent always-load map, emits a stderr warning on drift, and persists `skillLoadCompliance: { declared, read, missed }` via `logHookEvent()`. Non-blocking; exit 1 on drift; exit 0 on compliance or unknown agent.
- `.claude/rules/common/agents.md` updates the "Skill Loading" section: promotes the aspirational MUST to enforced, documents the Phase 0 convention, references the audit hook, and supersedes the prior paragraph.
- `.claude/settings.json` registers the new hook under `PostToolUse` with the same `PATH` prefix and `matcher: Task` pattern used by existing hooks.

**Migration.**

Fully additive and staged. No schema changes. No dist/ rebuild required for the agent/command edits. Rollout sequence (owned by plan-011):

1. Audit the definitive command scope by grepping `^skills:` in `.claude/commands/*.md`.
2. Draft the always/conditional table for all 16 agents (hard cap 2 always-load).
3. Pilot the template on `kody`; verify the sub-agent's `observations.jsonl` shows the two always-load reads before any analysis tool call. Iterate wording if compliance fails.
4. Roll out to the remaining 15 agents in 4 small PRs (reviewer / architecture / build / evolve groupings).
5. Apply the Step 0 template to commands.
6. Build and register the audit hook with a Vitest test.
7. Update `rules/common/agents.md` and this ADR's status to `accepted`.

**Backward compatibility.** The YAML `skills:` frontmatter schema is unchanged. `agent-metadata-sync` still treats it as the declarative catalog source. The 4 command-level skills documented in `rules/common/agents.md` ("Command-Level Skills" section: `verification-loop`, `strategic-compact`, `skill-creator:skill-creator` plugin) remain direct-loaded — no Phase 0 is needed for them, by design.

**Risks and mitigations.**

| Risk | Mitigation |
|---|---|
| R1: Sub-agents ignore Phase 0 despite imperative wording. | Pilot on `kody` first; audit hook surfaces real drift; iterate wording before full rollout; escalate to blocking enforcement only if soft drift persists past the 3-month review date. |
| R2: Context bloat from over-generous always-load. | Hard cap of 2 always-load skills per agent; everything else conditional with an explicit keyword / file-type / task-signal trigger. |
| R3: Conditional triggers too vague to ever fire. | Every conditional entry must specify a concrete trigger phrase. Validated during `/skanner` agent-eval runs. |
| R4: Audit hook false positives on legitimate skips (e.g. trivial invocation where a declared skill doesn't apply). | Hook is warning-only (exit 1); single-run misses ignored; only repeated drift per agent per week feeds `/evolve` proposals. |
| R5: Template drift across 16 parallel edits. | Apply edits mechanically from a single shared template string; `/chekpoint lite` with ts-reviewer catches YAML/frontmatter breakage. |
| R6: A command that delegates entirely to one sub-agent double-loads skills (command Step 0 + agent Phase 0). | plan-011 Step 1 identifies these commands explicitly and skips Step 0 for them. |
| R7: Claude Code ships a `PreAgentUse` hook after this ADR lands, making Phase 0 partially redundant. | Revisit in the follow-up ADR at the 2026-07-14 review date. The audit hook and the always/conditional split remain useful independently of any future runtime loader. |

**Follow-ups.**

- A future ADR should revisit this decision if Anthropic ships a `PreAgentUse` hook or any runtime skill-injection mechanism. In that world, Phase 0 becomes a fallback and the audit hook becomes a verifier rather than the primary feedback channel.
- Wiring repeated `skillLoadCompliance.missed` entries into `.claude/hooks/pattern-definitions.json` as an instinct pattern closes the loop into `/forge` and `/evolve`. This is listed as optional follow-up Step 9 in plan-011 and may ship after the core rollout lands clean.
- This ADR supersedes the aspirational paragraph at `.claude/rules/common/agents.md:16-20`. Plan-011 Step 8 rewrites that section; the ADR reference lives there as the authoritative source.

## Scope

**Agents touched (16):** `.claude/agents/{kody, typescript-reviewer, python-reviewer, orakle, spektr, arkitect, konstruct, feniks, mekanik, kurator, arkonte, almanak, doks, kartograf, alchemik, kerka}.md`.

**Commands touched (up to 8, verified in plan-011 Step 1):** `.claude/commands/{chekpoint, abra-kdabra, medik, skanner, forge, evolve, doks, research}.md` — every command whose frontmatter carries a `skills:` field and which runs skills in the main session rather than delegating entirely to one sub-agent.

**New files (2):**
- `.claude/hooks/scripts/skill-load-audit.js` — PostToolUse hook.
- `tests/hooks/skill-load-audit.test.ts` — Vitest unit test covering happy path, drift case, missing observations file, unknown agent name.

**Modified configuration (2):**
- `.claude/settings.json` — register `skill-load-audit` under `PostToolUse` with matcher `Task`.
- `.claude/rules/common/agents.md` — rewrite "Skill Loading" section from aspirational MUST to enforced convention, link to this ADR.

**Unchanged by design:**
- YAML `skills:` frontmatter schema across all 16 + 8 files.
- The 4 command-level skills in `rules/common/agents.md` "Command-Level Skills" section (they remain direct-loaded).
- Skill files themselves — no content edits, no new skills.

## Non-goals

- NOT implementing a `PreAgentUse` hook (Claude Code does not expose one).
- NOT inlining skill content into agent files (rejected as Option 3).
- NOT pre-reading into Task prompts (rejected as Option 4).
- NOT validating that sub-agents correctly *apply* skill guidance — only that they Read the declared files. Application quality is `/akademy` and `agent-eval` territory.
- NOT changing the YAML `skills:` frontmatter schema; `agent-metadata-sync` still treats it as the declarative source of truth.
- NOT introducing blocking (`exit 2`) enforcement. Phase 0 skipping is a quality issue, not a safety issue — the hook exits 1 (warning) at most.
- NOT touching the 4 command-level skills (`verification-loop`, `strategic-compact`, `skill-creator:skill-creator` plugin).
- NOT bumping the skill count. Catalog stays at 46.

## Checklist Verification

- [x] **Requirements documented.** Phase 0 imperative block, always/conditional split with hard cap, audit hook contract, rules update, settings registration.
- [x] **Alternatives evaluated.** Five options considered (imperative-only, nudge-only, inline, pre-read, hybrid); three rejected with explicit reasoning.
- [x] **API contracts defined.** Audit hook input: `stdin` JSON with Task tool result. Output: stderr warning JSON `{ warn: "skill-load-audit", agent, declared, read, missed }`, exit 1 on drift, exit 0 otherwise. Event schema: `skillLoadCompliance: { declared, read, missed }` persisted via `logHookEvent()`.
- [x] **Data model specified.** No schema changes; reuses existing `hook_events` table with an additional JSON field inside `metadata`.
- [x] **Component responsibilities defined.** Command Step 0 loads command-level skills; agent Phase 0 loads agent-level skills; audit hook measures compliance; `agent-metadata-sync` remains the frontmatter catalog source.
- [x] **Error handling strategy.** Audit hook graceful-fails to exit 0 on missing observations file or unknown agent. Phase 0 reads that fail instruct the agent to abort the task and report the failure.
- [x] **Testing strategy.** Unit tests for the audit hook covering four cases. End-to-end verification on `kody` pilot via a real `/chekpoint lite` run. Regression: full Vitest suite expected green post-change.
- [x] **Migration path.** Fully additive; staged in 6–7 PRs; backward compatible with frontmatter schema.
- [x] **Performance targets.** Audit hook reads one JSONL file + one small in-memory map — well under the 500ms general hook budget. Phase 0 worst-case is 2 Reads per sub-agent invocation.
- [x] **Security requirements.** Hook uses `parseStdin()` for Windows-safe JSON parsing; no `eval`; no shell interpolation; no new path-traversal surface.
- [x] **Windows compatibility.** Hook script registered with the standard `PATH="$PATH:/c/Program Files/nodejs"` prefix; reuses `parseStdin()`, `logHookEvent()`, and the same observations-reader pattern as `no-context-guard.js`.
- [x] **Observability planned.** `skill-load-audit` events flow into `hook_events`; dashboard can group by agent and compute drift rate; repeated drift feeds `/forge` and `/evolve`.
- [x] **Rollback plan.** Revert each PR independently. Removing the hook registration from `settings.json` disables audit instantly; reverting Phase 0 blocks restores the prior passive sections without breaking frontmatter.

## Review date

**2026-07-14** — 3 months from acceptance. Success criteria: <30% always-load drift per agent measured over a rolling 1-week window, verified from `hook_events` telemetry. If drift exceeds 30% per agent, revisit Phase 0 wording, promote to blocking enforcement, or re-evaluate whether Claude Code has shipped a `PreAgentUse` hook in the interim and migrate to it.
