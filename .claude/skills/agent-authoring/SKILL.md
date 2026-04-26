---
name: agent-authoring
description: Reference contract for creating, editing, or reviewing Kadmon Harness agent files (`.claude/agents/*.md`). Covers the mandatory/recommended/optional section taxonomy, the opus-vs-sonnet model decision tree, K-first naming convention, anti-patterns enforced by `/medik` Check #8 + kody, the Command-Level Skills exception table (verification-loop, strategic-compact, skill-creator plugin, council), the `requires_tools:` capability declaration pattern, and the 11-command orchestration patterns (parallel/sequential/direct). USE WHEN creating a new agent. USE WHEN editing agent frontmatter (model/tools/skills). USE WHEN deciding agent model (opus vs sonnet). USE WHEN reviewing agent template compliance. USE WHEN naming a new agent (K-first convention). Make sure to load this skill whenever the user mentions agent template, mandatory sections, model decision tree, K-naming, agent anti-patterns, command-level skills, requires_tools frontmatter, or orchestration patterns — even if they don't explicitly say "agent-authoring". Do NOT skip this skill if the task touches `.claude/agents/_TEMPLATE.md.example` or any new agent definition.
requires_tools: []
---

# Agent Authoring Reference

Authoritative reference for the agent contract used in the Kadmon Harness. The orchestrator and `kody` (during `/chekpoint`) consult this skill when creating, editing, or reviewing agent files. Content here was previously inlined in `.claude/rules/common/agents.md` and moved to on-demand loading 2026-04-26 to reduce auto-load footprint (see plan at `~/.claude/plans/se-puede-algo-entre-sunny-crayon.md`).

## Orchestration Patterns (11 commands)

#### Parallel then Sequential (mixed)
```
/chekpoint  verify → [ts-reviewer, py-reviewer, spektr, orakle] → kody (consolidate) → gate → commit
/skanner    [arkonte (perf), kartograf (e2e)] → report
```

#### Sequential (agents run in order)
```
/abra-kdabra   arkitect (if arch) → konstruct → feniks (if tdd)
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

---

Source rule file: `.claude/rules/common/agents.md` — sections moved here 2026-04-26 to reduce auto-load footprint. See plan at `~/.claude/plans/se-puede-algo-entre-sunny-crayon.md` for context.
