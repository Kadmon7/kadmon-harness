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
| arkonte | sonnet | Auto on O(n^2)/slow queries/memory, /skanner (profile-aware: harness\|web\|cli) | /skanner, auto-invoke | context-budget, token-budget-advisor, benchmark |
| python-reviewer | sonnet | Auto on .py edits | /chekpoint | python-patterns, python-testing, claude-api |
| almanak | sonnet | /almanak, unfamiliar APIs, no_context | /almanak | mcp-server-patterns, documentation-lookup |
| doks | opus | /doks, after feature/structural commits | /doks | docs-sync, skill-stocktake, rules-distill, code-tour |
| kartograf | sonnet | /skanner (E2E component, profile-aware: harness\|web\|cli) | /skanner | e2e-testing |
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

Three modes: **Parallel-then-Sequential** (`/chekpoint` reviewers → kody consolidate → gate; `/skanner` arkonte+kartograf → report), **Sequential** (`/abra-kdabra` arkitect→konstruct→feniks; `/medik` checks→mekanik+kurator→gate→repair→verify; `/doks`; `/evolve`), and **Direct** no-agent (`/nexus`, `/kompact`, `/almanak`, `/skavenger`, `/forge`). Full per-command flow diagrams — see **`agent-authoring` skill**.

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

Some skills are loaded directly by commands because the work is deterministic and indirection through an agent adds no value. These are **not** routing bugs — doks and audit tools treat them as intentional. Current command-level skills: `verification-loop` (loaded by `/chekpoint` Phase 1), `strategic-compact` (loaded by `/kompact`), `skill-creator:skill-creator` plugin (loaded by `/evolve` step 6 Generate for PROMOTE proposals only, per ADR-008 Q2), `council` (loaded by `/abra-kdabra` Step 1.5 + main orchestrator ad-hoc — anti-anchoring via sibling sub-agents). Full rationale per skill (why no agent owner, history, contract) — see **`agent-authoring` skill**. When adding new command-level skills, document the rationale in that skill's table.

### Skill capability declaration — `requires_tools:` frontmatter (plan-029)

Skills that invoke sub-agents (`Task`), `WebFetch`, or tools outside their owner agent's default grant SHOULD declare `requires_tools:` in frontmatter as a YAML list. `/medik` Check #14 verifies alignment against the owner agent's `tools:` field. Full pattern (YAML example, FAIL/WARN severity rules, heuristic fallback, seed adopters) — see **`agent-authoring` skill**.

## Agent Template Contract

Every new agent file MUST derive from the canonical skeleton at `.claude/agents/_TEMPLATE.md.example`. Mandatory sections (frontmatter + identity paragraph + `## Output Format` + `## Memory`), strongly recommended sections (`## Expertise`, `## Workflow`, `## no_context Rule`), optional sections by use case, K-first naming convention, opus-vs-sonnet model decision tree, anti-patterns flagged by kody and `/medik` Check #8 — full reference in the **`agent-authoring` skill** (loads on-demand when creating, editing, or reviewing an agent). Enforcement: `scripts/lib/lint-agent-frontmatter.ts` (mechanical) + kody review during `/chekpoint`.
