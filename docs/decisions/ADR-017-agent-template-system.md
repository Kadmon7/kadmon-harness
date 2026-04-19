---
number: 17
title: Agent Template System
date: 2026-04-19
status: accepted
route: A
plan: plan-017-agent-template-system.md
---

# ADR-017: Agent Template System

**Deciders**: Ych-Kadmon (architect), arkitect (agent).

## Context

The Kadmon Harness ships 16 specialist agents at `.claude/agents/*.md`, built organically over ~2 months. A structural audit of the current catalog shows real variance in which sections each agent contains and how they are worded, even though every agent is functionally the same kind of artifact (markdown file + YAML frontmatter consumed by Claude Code's native sub-agent loader, per the docs.claude.com/sub-agents contract already encoded in ADR-012 and ADR-013).

The variance is not harmful today, but it is accumulating:

- Every new agent is written by imitation of the last one. Imitation propagates drift (e.g. some agents ended up without a `no_context Rule`; some without a typed `Output Format`; only 3 have a `Security` block even though more agents fetch untrusted content; only 2 have `Red Flags` sections even though several more have implicit red-flag lists embedded in prose).
- The "bootstrap" goal (ADR-003 / plan-010 / ADR-010 — carry the harness to every new project) means a forked repo will copy these 16 files. If we fork today, we fork the variance.
- `/evolve` Generate (ADR-008, plan-008) can create new agent proposals mechanically, and the alchemik agent emits `AgentSpec` proposals. The generator needs a canonical shape to target, or it will produce yet another hand-rolled variant.
- The skill equivalent of this question was already answered externally: the `skill-creator:skill-creator` plugin enforces structure for skills. No equivalent exists for agents.

### Evidence — structural survey of all 16 agents

Grepped 2026-04-19 in `.claude/agents/`:

| Section | Count (/16) | Files with | Files without |
|---|---|---|---|
| `## Memory` | 16 | all | — |
| `## Expertise` or `Workflow`-class heading | 15 | all except doks | doks (has `## Workflow` but no `## Expertise`) |
| `## Output Format` (or variant: `Plan Format`, `Review Output Format`) | 15 | all except typescript-reviewer | typescript-reviewer (section is called `## Reference`) |
| `## no_context Rule` | 13 | most | doks, typescript-reviewer, kody |
| `## Security` | 3 | skavenger, spektr, almanak | 13 others (including orakle, which handles SQL — arguable miss) |
| `## Red Flags` | 2 | arkitect, konstruct | 14 others |
| `## Pipeline Contract (/abra-kdabra)` | 3 | konstruct, feniks, kody | 13 others (correctly — only chain participants need it) |
| `## Examples` | 1 | skavenger | 15 others |

File sizes: 134 – 332 lines. Longest is skavenger (332) — still within the 400-line preferred cap. Zero agents exceed the 400-line soft cap or the 800-line hard cap from `CLAUDE.md`.

Frontmatter variance:

- `memory:` — 15 say `project`, 1 says `user` (almanak — deliberately cross-project knowledge).
- `tools:` — comma-separated list, heterogeneous (skavenger is the only agent with `Task`; reviewers lack `Write/Edit`; alchemik is read-only intentionally).
- `model:` — only `opus` or `sonnet` values observed. No `haiku`.
- `description:` — quoting is inconsistent. Agents whose descriptions contain a colon (e.g. "Command: /foo. Severity: HIGH.") quote with `"..."`; agents without embedded colons do not quote. This matches the rule in `rules/common/agents.md` and ADR-012, but is not mechanically enforced.
- `skills:` — all 16 now use the YAML block-list form post-ADR-012. The `lint-agent-frontmatter.ts` linter (Check #8 of `/medik`) enforces this.

### Constraints

- The 16 existing agents must remain compliant without a breaking rewrite. Any new MANDATORY section that an existing agent lacks is a migration TODO, not a regression.
- Must not break the ADR-012 YAML-list contract or the ADR-013 `.claude/skills/<name>/SKILL.md` layout.
- Must not require a new MCP server or plugin (project stays lean).
- Windows Git Bash compatibility (no POSIX-only tooling in enforcement).
- Author mostly uses main-session to create/edit agents; sub-agents don't have `Write` to `.claude/agents/` by design (they propose, main writes — the same pattern as `/abra-kdabra`'s agent-proposes-command-writes).

## Options Considered

### Option A — Markdown-only template + documented rubric in `rules/common/agents.md`

Create `.claude/agents/_TEMPLATE.md` containing the canonical skeleton with placeholder comments explaining each section, WHEN to include the optional ones, and the anti-patterns to reject. Extend `rules/common/agents.md` with an "Agent Template Contract" section that lists mandatory vs optional sections and the decision tree for model choice. The `lint-agent-frontmatter.ts` linter stays focused on frontmatter syntax (its current scope); section-presence enforcement is a soft norm caught by kody during code review.

- **Pros**:
  - Cheapest to implement. Template file + ~80 lines added to `rules/common/agents.md`. No new code, no new tests.
  - Matches the current pattern for commands (`/abra-kdabra` docs the flow; no linter checks step presence).
  - Template is copy-able by a human OR by /evolve Generate's alchemik proposal path.
  - Linter stays small and focused (ADR-012 + ADR-013 scope).
  - Forward-compatible: if we add mechanical enforcement later (Option B), this template becomes the spec the enforcement reads against. Option A is a prefix of Option B.
  - Fork bootstrap (plan-010) already copies `.claude/agents/` wholesale; the template travels with it automatically.
- **Cons**:
  - Drift is possible. A new agent that forgets `## no_context Rule` will only be caught at kody review, not at commit time. Historical evidence: 3/16 agents are already missing it.
  - Relies on discipline. The same discipline that produced the current variance.
  - Migration of the 3-missing-no_context / 1-missing-Output-Format agents has no mechanical nudge.

### Option B — Template + extended linter with mandatory-section grep

Do Option A, AND extend `scripts/lib/lint-agent-frontmatter.ts` to additionally check each agent file contains:
1. `## Memory` heading.
2. `## Output Format` heading OR a project-sanctioned synonym (`## Plan Format`, `## Review Output Format`) — a tiny whitelist.
3. `## no_context Rule` heading.
4. `## Expertise` heading OR a workflow-class heading (`## Workflow`, `## Review Process`, `## Review Workflow`, `## Planning Process`, `## TDD Workflow`, `## Analysis`).

Also extend `scripts/lib/lint-agent-frontmatter.ts` to reject:
- `model: haiku` (or anything not in `{opus, sonnet}`).
- `description:` containing an unquoted colon (best-effort — a regex check).

Extend `/medik` Check #8 to report these violations. New vitest tests cover the rule set. Existing 3 missing-`no_context` agents + 1 missing-`Output Format` agent get migration fixes in the same batch.

- **Pros**:
  - Mechanical enforcement — no future agent ships without the mandatory four sections. Drift stops.
  - `/medik` already runs the linter every time; zero new invocation surface.
  - Fork repos get the linter when they get the harness (plan-010 bootstrap). Discipline travels with the code.
  - Catches `/evolve` Generate regressions — if alchemik ever proposes an under-spec'd agent, `applyEvolveGenerate`'s collision-abort path is reinforced by the linter's post-write run.
- **Cons**:
  - Additional lint rules = additional maintenance surface. Four headings to track, a synonym list to curate, and a whitelist that must evolve when we add a new agent archetype (e.g. an "investigator" shape that legitimately uses `## Investigation`).
  - Regex-based heading detection is fragile — a heading inside a fenced code block would false-positive. The linter already handles this style of check for the frontmatter block, so the complexity lift is modest but real.
  - Forces the 3 + 1 existing non-compliant agents into a single migration commit before the linter lands. Sprint-scale work, not one-shot.
  - The description-contains-unquoted-colon check is genuinely hard to get right without a real YAML parser. We'd either import one or accept false-positives on the regex.

### Option C — `agent-creator` plugin mirroring `skill-creator`

Build (or script) an `agent-creator` plugin that interviews the user (name, role, model, tools, optional sections), drafts the agent file from an embedded template, runs a self-evaluation pass, and writes to `.claude/agents/<name>.md`. Symmetric with `skill-creator:skill-creator` for skills.

- **Pros**:
  - Maximal consistency. Every new agent looks identical.
  - Aligns with the skill workflow (user already knows `Skill tool -> skill-creator`).
  - Could mechanically wire into `/evolve` Generate's CREATE_AGENT path.
- **Cons**:
  - Highest implementation cost. A plugin is a dependency with its own installation story; the harness has been deliberate about staying lean (4 plugins total, all external, zero internally-authored).
  - Plugin invocation is command-level (per the `skill-creator` pattern memorialized in `rules/common/agents.md` — "Subagent tool convention: ZERO agents have Skill in their tools frontmatter"). That means the `agent-creator` plugin would not compose naturally with alchemik's `/evolve` proposal-and-gate pattern; we'd need a second integration layer.
  - Every new agent is rare — the catalog size is 16 across 2 months. The plugin pays off over hundreds of agent creations, not tens.
  - YAGNI risk. The observed friction is "writes drift from the implicit template", not "creating new agents is cumbersome". A plugin solves the wrong problem.

## Decision

**Option A — Markdown template + documented rubric — and a forward door to Option B once we have any evidence of drift in the next 6 months.**

Specifically:

1. Create `.claude/agents/_TEMPLATE.md` as the canonical agent skeleton. Claude Code's sub-agent loader ignores files starting with `_` (convention: no agent name is an underscore-prefix), so the template is inert at runtime. The `lint-agent-frontmatter.ts` linter already iterates `readdirSync(.claude/agents).filter(f => f.endsWith('.md'))` — we extend the filter to also skip files beginning with `_` so the template isn't linted against itself.
2. Extend `.claude/rules/common/agents.md` with an **Agent Template Contract** section (~80 lines) that codifies:
   - Mandatory sections (and their exact headings).
   - Optional sections with inclusion criteria.
   - The K-naming convention as a guideline, not a mechanical rule (see below — the 3 existing exceptions are legitimate).
   - Model assignment decision tree.
   - Frontmatter schema + allowed values.
   - Anti-patterns list.
3. **Do not** extend the linter yet. The linter stays at ADR-012 / ADR-013 scope. Revisit at the 2026-10-19 review date (6 months): if two or more agents ship between now and then with a missing mandatory section, promote to Option B.
4. Flag the 4 existing migration TODOs as a separate small commit, NOT part of this ADR's rollout. They are:
   - `doks.md` — add `## Expertise` block and `## no_context Rule` block.
   - `typescript-reviewer.md` — rename `## Reference` to `## Output Format` (keeping content), add `## no_context Rule` block.
   - `kody.md` — add `## no_context Rule` block.

### Rationale

Option A wins given the constraints:

- **Observable friction is drift, not authoring cost.** The current 16 agents were written in ~2 months with reasonable average time-per-agent. The pain point is "they don't all look the same after the fact", which a template file directly addresses.
- **Option A is a strict prefix of Option B.** If drift reappears, Option B is a mechanical extension: the same template, the same rule list, same file locations — only the enforcement layer changes. Building the heavy enforcement first would invert the dependency.
- **Option C solves a problem we don't have.** Sixteen agents across two months averages less than one per week. Plugin ROI needs hundreds of creations.
- **Principle alignment**: Modularity (template lives in one file), Maintainability (predictable structure), Immutability (template is read-only reference, never mutated by agents themselves). No Big Ball of Mud, no Premature Optimization, no Golden Hammer.

The decision also respects `no_context`: WebFetch of docs.claude.com/en/docs/claude-code/sub-agents during ADR-012 research established that `name`, `description`, `tools`, `model`, and `skills` are the only frontmatter fields the native loader parses; the additional `memory:` field is harness-specific and consumed by ADR-017's upcoming push-injection (memory file), not by the native loader. No external documentation check is needed for Option A since we are not adding new runtime behavior.

### Template Contract (to be encoded in rules/common/agents.md)

**Mandatory sections** (every agent — 4 items):

1. **Frontmatter block** (YAML, enclosed in `---` fences) with exactly these keys in this order:
   - `name:` — lowercase-kebab, matches filename stem.
   - `description:` — quoted string. MUST be quoted with `"..."` whenever the value contains a colon. MUST include, where applicable, the trigger phrase (`Use PROACTIVELY when ...`), the command name (`Command: /xxx`), and severity (`Severity: ...`) so auto-invoke routing works.
   - `model:` — `opus` | `sonnet`. Never `haiku`.
   - `tools:` — comma-separated list. Choose the minimum privilege (reviewers use `Read, Grep, Glob, Bash`; writers add `Edit`/`Write`; researchers add `WebSearch, WebFetch, Task`). Never add `Skill` — plugins are command-level per `rules/common/agents.md` memorized convention.
   - `memory:` — `project` (default) or `user` (cross-project knowledge like almanak).
   - `skills:` — YAML block list, per ADR-012. Every name must resolve to `.claude/skills/<name>/SKILL.md`, per ADR-013.
2. **Opening identity paragraph** immediately after the frontmatter. One or two sentences describing the agent's role in first person ("You are ...").
3. **`## Output Format`** (or a project-sanctioned synonym: `## Plan Format`, `## Review Output Format`) — typed markdown example showing the exact shape the agent emits, ending with an `[agent-name]` tag line. If a downstream command parses the output (e.g. `/abra-kdabra` reads `docs/plans/plan-NNN-*.md`), the format block is a CONTRACT and must match what the consumer expects.
4. **`## Memory`** block — uses the canonical wording already present in all 16 agents: "Memory file: `.claude/agent-memory/<name>/MEMORY.md`. **Before starting**: Read... **After completing**: Append only if ...". Keep ≤ 200 lines. Never persist secrets.

**Strongly recommended** (justified omission requires an inline comment):

5. **`## Expertise`** — bullet list of domains the agent covers. Absent only when the agent's role is itself the expertise (doks arguably qualifies; its `## Critical Rule` + `## Documentation Files` substitute).
6. **`## Workflow`** (or `## Review Workflow` / `## Review Process` / `## Planning Process` / `## TDD Workflow` / `## Analysis`) — ordered steps the agent executes on invocation. Every agent needs one OR a very good reason.
7. **`## no_context Rule`** — short paragraph stating how the agent enforces the no_context principle within its domain. Even reviewers need this (fills the "don't assume security, trace inputs" shape in spektr; "don't guess at error causes, read the actual error message" in mekanik).

**Optional — include WHEN**:

| Section | Include when | Reference agent |
|---|---|---|
| `## Security` | Agent fetches/executes external content OR processes untrusted input as tool output | skavenger, spektr, almanak |
| `## Pipeline Contract (/command)` | Agent is part of a /command chain with a file-based hand-off (ADR input, plan output, review output) | konstruct, feniks, kody |
| `## Examples` | Workflow branches are non-obvious (Route A vs Route B; multiple modes) | skavenger (Routes A & B, `--plan`/`--verify`/`--drill` modes) |
| `## Red Flags` | There is a taxonomy of bad outputs to reject (not just fix) | arkitect, konstruct |
| Artifact template (e.g. `## ADR Template`) | Agent produces a specific artifact consumed downstream | arkitect (ADRs), konstruct (plans) |
| `## Execution Caps` / `## Depth Modes` / `## Self-Evaluation` | Agent has multiple invocation modes or bounded resource use | skavenger |

**Naming convention**:

- **K-first guideline**: 13/16 agents follow the K-initial convention (arkitect, konstruct, kody, skavenger, mekanik, kurator, arkonte, kartograf, alchemik, almanak, feniks, orakle, spektr). The 3 exceptions are intentional and legitimate:
  - `typescript-reviewer` and `python-reviewer` are generic role descriptors — K-naming would obscure the language they target.
  - `doks` uses `d` because "doks" is the role ("docs" with a K-style twist already); `kdoks` would be noise.
- **Rule**: prefer K-first when the agent has a proper "persona" name. Permit generic role descriptors when the role spans multiple codebases (reviewers) or when the K-spelling adds no clarity. Not mechanically enforced — kody reviews name choices in `/chekpoint`.

**Model assignment decision tree**:

```
Q1: Does the agent produce architectural decisions, critique code quality at scale, 
    or analyze security across systems?
  YES -> opus.  (arkitect, konstruct, spektr, alchemik, doks)
  NO  -> go to Q2.
Q2: Does the agent execute a well-defined workflow (review, debug, test, refactor, 
    research, fetch docs)?
  YES -> sonnet.  (kody, typescript-reviewer, python-reviewer, orakle, feniks, 
                   mekanik, kurator, arkonte, kartograf, skavenger, almanak)
  NO  -> revisit agent scope; it likely needs decomposition.
NEVER -> haiku (explicitly forbidden by rules/common/agents.md).
```

**Anti-patterns** (mechanically rejected by the linter today OR flagged by kody in review):

- `skills: a, b, c` — comma-separated scalar. Use a YAML block list (ADR-012, linter check).
- Skill path `.claude/skills/<name>.md` instead of `.claude/skills/<name>/SKILL.md` (ADR-013, linter check).
- `model: haiku` (rule-level reject; linter extension deferred to Option B).
- Missing `description:` field, or `description:` with unquoted embedded colons (rule-level reject; linter extension deferred to Option B).
- Missing `## Memory` block.
- Agent file > 400 lines (soft cap; refactor triggered). > 800 lines (hard cap; mandatory split).
- Agent description duplicates another agent's trigger signal (catalog-level review — kody's job during `/chekpoint` on agent edits).
- Agent adds `Skill` to its `tools:` frontmatter (plugins are command-level per the memorized convention).

## Consequences

### What changes

- A new file `.claude/agents/_TEMPLATE.md` (the canonical skeleton, ~180 lines). Ignored by the loader due to underscore prefix; explicitly skipped by the linter via a one-line filter.
- The `lint-agent-frontmatter.ts` linter gains a 1-line filter: `!f.startsWith('_')`. Zero behavior change for the 16 existing agents.
- `.claude/rules/common/agents.md` gains an "Agent Template Contract" section (~80 lines) containing: the Mandatory/Recommended/Optional table, the naming convention rule, the model decision tree, the anti-patterns list, and a pointer to `_TEMPLATE.md`.
- 4 migration TODO entries tracked in `plan-017`:
  - doks: add `## Expertise` + `## no_context Rule`.
  - typescript-reviewer: rename `## Reference` -> `## Output Format`, add `## no_context Rule`.
  - kody: add `## no_context Rule`.
- `/evolve` Generate's CREATE_AGENT proposal template (ADR-008) gains a reference to `_TEMPLATE.md` so alchemik's emitted `AgentSpec` JSON can point at the skeleton. No code change required in `runEvolveGenerate` — the template path is a string constant alchemik cites in prose.

### Migration path

- **Phase 1** — ship the template file and the rules addition. One commit. No behavior change.
- **Phase 2** — apply the 4 migration TODOs. One commit. Adds three headings across three files; renames one heading in one file. Zero test impact.
- **Phase 3** (deferred, 2026-10-19 review) — if drift observed, promote to Option B: extend linter with mandatory-section grep + reject haiku. Tracked as a future ADR, not this one.

Backward compatibility: total. No existing agent breaks. No hook changes. No test changes beyond whatever Phase 2's heading adjustments touch (none expected — tests don't assert on `.claude/agents/*.md` structure today).

### Risks

- **Drift continues without mechanical enforcement.** Mitigated by: (a) kody reviews `.claude/agents/*.md` edits in `/chekpoint` full tier (production `.ts`/`.js` scope applies to agents too via the "multi-file refactor" trigger when multiple agents change together; single-file edits get lite tier from typescript-reviewer which also reads markdown), (b) the 6-month review commits us to evaluate the evidence and upgrade if needed.
- **Template becomes stale if new agent archetypes emerge.** Mitigated by the "strongly recommended, justified omission allowed" tier — `## Expertise` and `## Workflow` are recommended but can be swapped for archetype-specific shapes without violating the contract.
- **Linter-skip for underscore-prefixed files might mask a typo** (e.g. an agent file accidentally named `_spektr.md`). Mitigated by the existing agents-directory audit in `/kadmon-harness` dashboard (shows agent count), which would surface a count regression immediately. Also no sub-agent with an underscore name can be spawned — the first invocation attempt fails visibly.
- **Description-colon-quoting regressions are invisible today.** Still invisible after Phase 1 (deferred to Option B). Acceptable residual: kody review is the safety net for now; 2 months of the current rule have produced no reports of this specific bug.

### Review date

**2026-10-19** — 6 months. Evaluate:
1. How many new agents were added in the interval, and did any ship missing a mandatory section at first commit (not counting iterations on the same PR)?
2. Did the 4 migration TODOs land as planned?
3. Did `/evolve` Generate emit any `AgentSpec` proposals? Did they cite `_TEMPLATE.md`? Did any ship with drift?
4. Fork distribution evidence: if plan-010 bootstrap was used on any fork, does the fork's agent catalog stay consistent with the template?

If drift count > 1, promote to Option B in a successor ADR. If drift count is 0 or 1 and attributable to a specific PR that got caught in review, Option A stands.
