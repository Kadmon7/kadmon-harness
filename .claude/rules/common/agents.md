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
- MUST read skill files listed in command frontmatter when executing the command
- MUST use skill-creator:skill-creator plugin for ALL skill work (create, edit, optimize, evaluate). Invoke via Skill tool: `skill: "skill-creator:skill-creator"`. The plugin handles: interview, drafting, test cases, evaluation loop, and description optimization. Never create skill files manually.
- Skills are domain knowledge — agents are the executors that USE that knowledge
- When auto-invoking an agent, also load the skills associated with its command (see catalog below)

## Routing
- MUST use opus model for: arkitect, konstruct, spektr, alchemik
- MUST use sonnet model for: kody, typescript-reviewer, feniks, mekanik, kurator, arkonte, python-reviewer, almanak, kartograf, orakle
- MUST use opus model for doks (documentation requires critical analysis across 4 layers)
- NEVER use haiku for code review, security analysis, or documentation updates

## Agent Catalog (15)

| Agent | Model | Trigger | Command | Skills |
|-------|-------|---------|---------|--------|
| arkitect | opus | /abra-kdabra with architecture signals | /abra-kdabra | architecture-decision-records |
| konstruct | opus | /abra-kdabra always | /abra-kdabra | architecture-decision-records |
| kody | sonnet | /chekpoint | /chekpoint | coding-standards, receiving-code-review |
| typescript-reviewer | sonnet | Auto on .ts/.tsx/.js/.jsx edits | /chekpoint | coding-standards, frontend-patterns |
| orakle | sonnet | Auto on SQL/schema/migration/Supabase | /chekpoint | database-migrations, postgres-patterns |
| spektr | opus | Auto on auth/keys/input/exec/paths/SQL | /chekpoint | safety-guard |
| feniks | sonnet | /abra-kdabra (if needs_tdd) | /abra-kdabra | tdd-workflow, python-testing |
| mekanik | sonnet | /medik Phase 2 (always), auto on TS/Vitest failures | /medik | systematic-debugging |
| kurator | sonnet | /medik Phase 2 (always, parallel with mekanik) | /medik | coding-standards |
| arkonte | sonnet | Auto on O(n^2)/slow queries/memory, /skanner | /skanner, auto-invoke | context-budget |
| python-reviewer | sonnet | Auto on .py edits | /chekpoint | python-patterns, python-testing |
| almanak | sonnet | /almanak, unfamiliar APIs, no_context | /almanak | mcp-server-patterns, deep-research |
| doks | opus | /doks, after feature/structural commits | /doks | docs-sync |
| kartograf | sonnet | /skanner (E2E component) | /skanner | e2e-testing |
| alchemik | opus | /evolve only | /evolve | search-first, continuous-learning-v2 |

## Auto-Invoke (no prompt needed)
- Code touches auth/keys/exec/file paths/SQL → spektr
- Editing .ts/.tsx/.js/.jsx files → typescript-reviewer
- Editing .py files → python-reviewer
- Editing SQL/schema/migration/Supabase client → orakle
- TypeScript compilation or Vitest fails → mekanik
- Performance concerns (O(n^2), slow queries, memory patterns) → arkonte
- /abra-kdabra with architecture signals → arkitect before konstruct
- Encountering unfamiliar external API or library → almanak (via /almanak)

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

## Parallel Execution
- SHOULD launch independent agents in parallel (single message, multiple tool calls)
- NEVER run agents sequentially when their inputs are independent

### Orchestration Patterns (12 commands)

#### Parallel then Sequential (mixed)
```
/chekpoint  verify → [ts-reviewer, py-reviewer, spektr, orakle] → kody (consolidate) → gate → commit
/skanner    [arkonte (perf), kartograf (e2e)] → report
```

#### Sequential (agents run in order)
```
/abra-kdabra   arkitect (if arch) → konstruct → feniks (if tdd) → kody
/medik    direct (7 checks) → [mekanik, kurator] (parallel analysis) → gate → repair → verify
/doks     doks
/evolve   alchemik
```

#### Direct (no agent orchestration)
```
/kadmon-harness  script execution
/kompact         context compaction
/kompas          context rebuild
/almanak         almanak (single lookup)
/akademy         structured evaluation
/instinct        instinct lifecycle
```

## Approval Criteria
- CRITICAL → BLOCK merge, fix immediately
- HIGH → WARN, should fix before merge
- MEDIUM/LOW → NOTE, optional

## Communication
- Agents return structured output (markdown with sections)
- MUST include severity levels in reviews (BLOCK/WARN/NOTE or CRITICAL/HIGH/MEDIUM/LOW)
- NEVER let an agent modify code without explicit approval from the user
