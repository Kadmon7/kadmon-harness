---
alwaysApply: true
---

# Agent Usage Rules

## Orchestration Chain
When a command is invoked, follow the chain defined in its frontmatter:
- `agent:` field → MUST invoke that agent (or agents) by subagent_type name
- `skills:` field → MUST load those skills before/during agent work
- Commands without agent/skills fields → execute steps directly

This chain exists so skills are ACTUALLY USED, not just documented.
If you skip the chain, the user's investment in agents and skills is wasted.

## Skill Loading

Agents declare their skills in YAML frontmatter. Claude Code's native sub-agent loader parses the `skills:` field as a YAML list, resolves each name to a file on disk, and **injects the full skill content into the sub-agent's context at spawn** (per [Anthropic docs — Skills](https://code.claude.com/docs/en/skills) and [sub-agents](https://docs.claude.com/en/docs/claude-code/sub-agents)). Sub-agents do NOT inherit skills from the parent conversation — the frontmatter is the only channel.

**Authoritative layout — subdirectory + literal `SKILL.md`** (per ADR-013):

```
.claude/skills/
├── coding-standards/
│   └── SKILL.md            ← entrypoint, literal uppercase filename
├── git-workflow/
│   └── SKILL.md
└── ...
```

Each skill is a directory, the entrypoint is always `SKILL.md` (literal uppercase), and the frontmatter must contain at minimum `name` and `description`. The project-scope path is `.claude/skills/<skill-name>/SKILL.md`. Flat files like `.claude/skills/<name>.md` are invisible to the loader — it silently injects nothing, no error.

**Authoritative syntax — YAML block list** (per ADR-012):

```yaml
---
name: kody
skills:
  - coding-standards
  - receiving-code-review
  - git-workflow
---
```

**Anti-pattern 1 — comma-separated scalar** (parses as a single string, loader silently drops it):
```yaml
skills: coding-standards, receiving-code-review, git-workflow   # BROKEN
```

**Anti-pattern 2 — flat file layout** (loader resolves to `<name>/SKILL.md` and finds nothing):
```
.claude/skills/coding-standards.md   # BROKEN — invisible to the loader
```

Rules:
- MUST declare every skill used by an agent in its `skills:` frontmatter as a YAML list (see ADR-012)
- MUST place each skill at `.claude/skills/<name>/SKILL.md` with literal uppercase `SKILL.md` filename (see ADR-013)
- MUST quote `description:` fields that contain embedded colons (e.g. `"... Command: /foo. Severity: HIGH."`) — unquoted colons break YAML parsing silently
- MUST read skill files listed in **command** frontmatter when executing the command (commands run in the main session, not a sub-agent — the agent-level injection does not apply)
- MUST use skill-creator:skill-creator plugin for ALL skill work (create, edit, optimize, evaluate). Invoke via Skill tool: `skill: "skill-creator:skill-creator"`. The plugin handles: interview, drafting, test cases, evaluation loop, and description optimization. Never create skill files manually.
- Skills are domain knowledge — agents are the executors that USE that knowledge
- The `rules/common/agents.md` catalog table below lists skills in comma-separated shorthand for human readability; the **authoritative declaration lives in each agent's frontmatter**
- Both layout and syntax are enforced by `scripts/lint-agent-frontmatter.ts` as Check #8 of `/medik`

## Routing
- MUST use opus model for: arkitect, konstruct, spektr, alchemik
- MUST use sonnet model for: kody, typescript-reviewer, feniks, mekanik, kurator, arkonte, python-reviewer, almanak, kartograf, orakle, skavenger
- MUST use opus model for doks (documentation requires critical analysis across 4 layers)
- NEVER use haiku for code review, security analysis, or documentation updates

## Agent Catalog (16)

| Agent | Model | Trigger | Command | Skills |
|-------|-------|---------|---------|--------|
| arkitect | opus | /abra-kdabra with architecture signals | /abra-kdabra | architecture-decision-records, api-design, docker-patterns, hexagonal-architecture |
| konstruct | opus | /abra-kdabra always | /abra-kdabra | architecture-decision-records, eval-harness, codebase-onboarding |
| kody | sonnet | /chekpoint | /chekpoint | coding-standards, receiving-code-review, git-workflow, github-ops, regex-vs-llm-structured-text |
| typescript-reviewer | sonnet | Auto on .ts/.tsx/.js/.jsx edits | /chekpoint | coding-standards, frontend-patterns |
| orakle | sonnet | Auto on SQL/schema/migration/Supabase | /chekpoint | database-migrations, postgres-patterns, content-hash-cache-pattern |
| spektr | opus | Auto on auth/keys/input/exec/paths/SQL | /chekpoint | safety-guard, security-review, security-scan |
| feniks | sonnet | /abra-kdabra (if needs_tdd) | /abra-kdabra | tdd-workflow, python-testing, eval-harness, ai-regression-testing |
| mekanik | sonnet | /medik Phase 2 (always), auto on TS/Vitest failures | /medik | systematic-debugging, agent-introspection-debugging |
| kurator | sonnet | /medik Phase 2 (always, parallel with mekanik) | /medik | coding-standards |
| arkonte | sonnet | Auto on O(n^2)/slow queries/memory, /skanner | /skanner, auto-invoke | context-budget, token-budget-advisor, benchmark |
| python-reviewer | sonnet | Auto on .py edits | /chekpoint | python-patterns, python-testing, claude-api |
| almanak | sonnet | /almanak, unfamiliar APIs, no_context | /almanak | mcp-server-patterns, documentation-lookup |
| doks | opus | /doks, after feature/structural commits | /doks | docs-sync, skill-stocktake, rules-distill, code-tour |
| kartograf | sonnet | /skanner (E2E component) | /skanner | e2e-testing |
| alchemik | opus | /evolve only | /evolve | search-first, continuous-learning-v2, skill-stocktake, agent-eval, prompt-optimizer, skill-comply, workspace-surface-audit, cost-aware-llm-pipeline |
| skavenger | sonnet | /skavenger, research/investigate/deep-dive intent | /skavenger | deep-research |

## Auto-Invoke (no prompt needed)
- Code touches auth/keys/exec/file paths/SQL → spektr
- Editing .ts/.tsx/.js/.jsx files → typescript-reviewer
- Editing .py files → python-reviewer
- Editing SQL/schema/migration/Supabase client → orakle
- TypeScript compilation or Vitest fails → mekanik
- Performance concerns (O(n^2), slow queries, memory patterns) → arkonte
- /abra-kdabra with architecture signals → arkitect before konstruct
- Encountering unfamiliar external API or library → almanak (via /almanak)
- User asks to research/investigate/deep-dive/compare/analyze topics beyond the current codebase → skavenger (via /skavenger)

## Manual Rules
- MUST invoke kody before any commit via /chekpoint
- MUST invoke typescript-reviewer for .ts/.tsx/.js/.jsx file changes
- MUST invoke konstruct via /abra-kdabra — runs for every /abra-kdabra invocation
- MUST invoke arkitect before konstruct when /abra-kdabra task contains architecture signals
- MUST invoke almanak when referencing unfamiliar APIs or when no_context principle requires verification
- MUST invoke mekanik when TypeScript compilation or Vitest tests fail (skip for obvious typos)
- MUST invoke doks after commits that add/remove agents, skills, or commands
- MUST use skill-creator:skill-creator plugin for any skill creation, editing, or evaluation. Invoke: `skill: "skill-creator:skill-creator"`. Never create skill files manually — the plugin handles structure, frontmatter, and description optimization.
- NEVER invoke arkitect for routine bug fixes or small features
- NEVER invoke alchemik without explicit /evolve command
- NEVER invoke kartograf without explicit /skanner command (tests are expensive)
- NEVER invoke kurator without explicit /medik clean command
- MUST invoke skavenger via /skavenger for multi-source investigation; NEVER fall back to raw WebSearch when /skavenger is the appropriate entry point

## Parallel Execution
- SHOULD launch independent agents in parallel (single message, multiple tool calls)
- NEVER run agents sequentially when their inputs are independent

### Orchestration Patterns (11 commands)

#### Parallel then Sequential (mixed)
```
/chekpoint  verify → [ts-reviewer, py-reviewer, spektr, orakle] → kody (consolidate) → gate → commit
/skanner    [arkonte (perf), kartograf (e2e)] → report
```

#### Sequential (agents run in order)
```
/abra-kdabra   arkitect (if arch) → konstruct → feniks (if tdd) → kody
/medik    direct (8 checks) → [mekanik, kurator] (parallel analysis) → gate → repair → verify
/doks     doks
/evolve   alchemik
```

#### Direct (no agent orchestration)
```
/nexus           script execution
/kompact         context compaction
/almanak         almanak (single lookup)
/skavenger       skavenger (single researcher, loads deep-research skill)
/forge           unified instinct pipeline (preview gate)
```

## Approval Criteria
- CRITICAL → BLOCK merge, fix immediately
- HIGH → WARN, should fix before merge
- MEDIUM/LOW → NOTE, optional
- **Consolidator boundary**: kody (Phase 2b of `/chekpoint`) MAY consolidate duplicate BLOCKs and MAY escalate severity, but MUST **never downgrade an upstream BLOCK** from any Phase 2a specialist (typescript-reviewer, python-reviewer, spektr, orakle). If kody disagrees with a specialist BLOCK, it reports the BLOCK as-is and appends its dissent as a separate NOTE. The `/chekpoint` Phase 3 gate runs a dual check (raw Phase 2a BLOCKs AND kody-consolidated BLOCKs) so any silent drop is detected mechanically. See `.claude/agents/kody.md` → "Upstream BLOCK Preservation".

## Communication
- Agents return structured output (markdown with sections)
- MUST include severity levels in reviews (BLOCK/WARN/NOTE or CRITICAL/HIGH/MEDIUM/LOW)
- NEVER let an agent modify code without explicit approval from the user

## Command-Level Skills (no agent owner by design)

Not every skill is owned by an agent. Some skills are loaded directly by commands because the work is deterministic and indirection through an agent adds no value. These are **not** routing bugs — doks and audit tools should treat them as intentional.

| Skill | Loaded by | Why no agent |
|---|---|---|
| `verification-loop` | `/chekpoint` (Phase 1) | Build → typecheck → lint → test is a deterministic sequence. A reviewer agent is already invoked in Phase 2; verification is the command's job. |
| `strategic-compact` | `/kompact` | The compaction-decision matrix is deterministic enough that routing through an agent adds no value. The skill is loaded directly when the user (or another skill) needs the decision guide. |
| `skill-creator:skill-creator` (plugin) | `/evolve` step 6 Generate (PROMOTE proposals only) | Alchemik proposes `SkillSpec` objects in a JSON fence but NEVER invokes the mutator or plugin itself (ADR-008 Q2). The `/evolve` command parses the fence, renders the approval gate, then invokes the skill-creator plugin for PROMOTE proposals or calls `applyEvolveGenerate` for non-skill types. This orchestration lives at command level to keep alchemik pure-analysis and to centralize collision handling. |
| `council` | `/abra-kdabra` Step 1.5 (ambiguity detected) + main orchestrator ad-hoc | The skill's core mechanism is spawning 3 fresh sibling sub-agents via `Task` for anti-anchoring. Anthropic's observable pattern is orchestrator-driven spawning; nesting `Task` inside a sub-agent is neither documented nor endorsed. Keeping council at the command/orchestrator level matches that pattern and avoids granting `Task` to planner agents (konstruct, arkitect) that don't otherwise need it. Moved here 2026-04-23 after empirical test proved konstruct's declared ownership was unexecutable (lacked `Task`). |

When adding new command-level skills, document the rationale here so future audits don't flag them as orphaned.

### Skill capability declaration — `requires_tools:` frontmatter (plan-029)

Skills that invoke sub-agents, `WebFetch`, or other tools outside their owner agent's default grant SHOULD declare a `requires_tools:` field in frontmatter as a YAML flow (`[Task]`) or block list:

```yaml
---
name: council
description: ...
requires_tools: [Task]
---
```

Purpose: `/medik` Check #14 (capability-alignment) compares each skill's `requires_tools:` against its owner agent's `tools:` field. Mismatches emit severity **FAIL** — a skill whose owner lacks a required tool is silently unexecutable (the council pre-2026-04-23 pattern). Seed adopters: `council` (`[Task]`), `deep-research` (`[Task, WebFetch, WebSearch]`).

Opt-in: when `requires_tools:` is missing, the check falls back to a heuristic body-scan (regex on `Task(`, `WebFetch`, `Bash(`) and emits severity **WARN** with a suggestion to formalize. Explicit declaration always beats heuristic.

## Agent Template Contract

Every new agent file MUST derive from the canonical skeleton at `.claude/agents/_TEMPLATE.md.example`. The template uses the `.md.example` extension so Claude Code's plugin loader and the frontmatter linter (both `.md`-only scanners) skip it — this replaces the original underscore-prefix-only convention (ADR-017, 2026-04-19), which ADR-019 dogfood 2026-04-20 proved the Claude Code plugin loader does NOT respect. The linter at `scripts/lib/lint-agent-frontmatter.ts` still filters `_`-prefix as an additional safety net.

### Mandatory sections (4) — every agent

| # | Section | Reference agent |
|---|---|---|
| 1 | Frontmatter block (YAML with `name`, `description`, `model`, `tools`, `memory`, `skills`) | all 16 |
| 2 | Opening identity paragraph (first-person, after frontmatter) | arkitect, skavenger |
| 3 | `## Output Format` (synonyms allowed: `## Plan Format`, `## Review Output Format`) | konstruct (Plan Format), kody (Review Output Format) |
| 4 | `## Memory` block with canonical Read-before/Append-after wording | all 16 |

### Strongly recommended (3) — omission requires inline justification

| # | Section | Reference agent |
|---|---|---|
| 5 | `## Expertise` (bullet list of domain competences) | arkitect, konstruct |
| 6 | `## Workflow` (synonyms: `## Review Workflow`, `## Review Process`, `## Planning Process`, `## TDD Workflow`, `## Analysis`) | konstruct (Planning Process), feniks (TDD Workflow) |
| 7 | `## no_context Rule` (short paragraph — how the agent refuses to invent evidence) | arkitect, konstruct, skavenger |

### Optional — include WHEN

| Section | Include when | Reference agent |
|---|---|---|
| `## Security` | Agent fetches/executes external content OR processes untrusted input | skavenger, spektr, almanak |
| `## Pipeline Contract (/command)` | Agent is part of a /command chain with file-based hand-off | konstruct, feniks, kody |
| `## Examples` | Workflow branches non-obvious (Routes, multiple modes) | skavenger |
| `## Red Flags` | There is a taxonomy of BAD outputs to reject | arkitect, konstruct |
| Artifact template (e.g. `## ADR Template`) | Agent produces a specific artifact consumed downstream | arkitect (ADRs), konstruct (plans) |
| `## Execution Caps` / `## Depth Modes` / `## Self-Evaluation` | Agent has multiple invocation modes or bounded resource budgets | skavenger |

### Naming convention (K-first guideline)

- Prefer K-first names when the agent has a proper "persona" (arkitect, konstruct, kody, skavenger, mekanik, kurator, arkonte, kartograf, alchemik, almanak, feniks, orakle, spektr — 13/16).
- Generic role descriptors are permitted when K-naming adds no clarity: `typescript-reviewer`, `python-reviewer` (language-targeted reviewers), `doks` (role spells itself out).
- Not mechanically enforced — kody reviews naming during `/chekpoint` on agent edits.

### Model decision tree

```
Q1: Does the agent produce architectural decisions, critique code quality at scale,
    or analyze security across systems?
  YES -> opus.  (arkitect, konstruct, spektr, alchemik, doks)
  NO  -> go to Q2.
Q2: Does the agent execute a well-defined workflow (review, debug, test, refactor,
    research, fetch docs)?
  YES -> sonnet.
  NO  -> revisit agent scope; it likely needs decomposition.
NEVER -> haiku (explicitly forbidden; rule enforced at review, not mechanically today).
```

### Anti-patterns

**Mechanically rejected today** (`lint-agent-frontmatter.ts`, Check #8 of `/medik`):
- `skills: a, b, c` — comma-separated scalar (ADR-012 requires YAML block list).
- Skill path `.claude/skills/<name>.md` instead of `.claude/skills/<name>/SKILL.md` (ADR-013).

**Flagged by kody in `/chekpoint` review** (deferred to linter until Option B review 2026-10-19):
- `model: haiku` or any value other than `opus`/`sonnet`.
- `description:` with an unquoted embedded colon.
- Missing `## Memory` block.
- Agent file > 400 lines (soft cap → refactor) / > 800 lines (hard cap → mandatory split).
- Agent description duplicates another agent's trigger signal (catalog-level review).
- `Skill` listed in the agent's `tools:` frontmatter (plugins are command-level — see "Command-Level Skills" table above).

### Enforcement

- **Mechanical**: `scripts/lib/lint-agent-frontmatter.ts` (Check #8 of `/medik`). The `_`-prefix filter skips template/example files; all other `.md` files in `.claude/agents/` are checked.
- **Human review**: kody reviews agent edits during `/chekpoint` (full tier when multiple agents change, lite tier for single-file edits — per the /chekpoint Tiers table in `development-workflow.md`).
- **Review date**: 2026-10-19 — evaluate drift evidence. Promote to Option B (mechanical section-presence checks) if two or more new agents ship missing a mandatory section between now and then.
