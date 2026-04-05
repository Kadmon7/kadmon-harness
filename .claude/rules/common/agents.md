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
- MUST use skill-creator:skill-creator plugin for ALL skill work (create, edit, optimize, evaluate)
- Skills are domain knowledge — agents are the executors that USE that knowledge
- When auto-invoking an agent, also load the skills associated with its command (see catalog below)

## Routing
- MUST use opus model for: arkitect, konstruct, security-reviewer, database-reviewer, harness-optimizer
- MUST use sonnet model for: code-reviewer, typescript-reviewer, tdd-guide, build-error-resolver, refactor-cleaner, performance-optimizer, python-reviewer, almanak, e2e-runner
- MUST use opus model for doktor (documentation requires critical analysis across 4 layers)
- NEVER use haiku for code review, security analysis, or documentation updates

## Agent Catalog (15)

| Agent | Model | Trigger | Command | Skills |
|-------|-------|---------|---------|--------|
| arkitect | opus | /kplan with architecture signals | /kplan | architecture-decision-records |
| konstruct | opus | /kplan always | /kplan | architecture-decision-records |
| code-reviewer | sonnet | /checkpoint, /kreview | /checkpoint, /kreview | coding-standards, receiving-code-review |
| typescript-reviewer | sonnet | Auto on .ts/.tsx/.js/.jsx edits | /checkpoint, /kreview | coding-standards |
| database-reviewer | opus | Auto on SQL/schema/migration/Supabase | /checkpoint | database-migrations, postgres-patterns |
| security-reviewer | opus | Auto on auth/keys/input/exec/paths/SQL | /checkpoint | safety-guard |
| tdd-guide | sonnet | /ktest command | /ktest | tdd-workflow |
| build-error-resolver | sonnet | Auto on TS compilation/Vitest failures | /kfix | systematic-debugging |
| refactor-cleaner | sonnet | /kfix clean only | /kfix | coding-standards |
| performance-optimizer | sonnet | Auto on O(n^2)/slow queries/memory | /kperf | context-budget |
| python-reviewer | sonnet | Auto on .py edits | /checkpoint, /kreview | claude-api |
| almanak | sonnet | /docs, unfamiliar APIs, no_context | /docs | mcp-server-patterns |
| doktor | opus | /kdocs, after feature/structural commits | /kdocs | — |
| e2e-runner | sonnet | /ktest e2e only (expensive) | /ktest | e2e-testing |
| harness-optimizer | opus | /evolve only | /evolve | search-first |

## Auto-Invoke (no prompt needed)
- Code touches auth/keys/exec/file paths/SQL → security-reviewer
- Editing .ts/.tsx/.js/.jsx files → typescript-reviewer
- Editing .py files → python-reviewer
- Editing SQL/schema/migration/Supabase client → database-reviewer
- TypeScript compilation or Vitest fails → build-error-resolver
- Performance concerns (O(n^2), slow queries, memory patterns) → performance-optimizer
- /kplan with architecture signals → arkitect before konstruct
- Encountering unfamiliar external API or library → almanak (via /docs)

## Manual Rules
- MUST invoke code-reviewer before any commit via /checkpoint
- MUST invoke typescript-reviewer for .ts/.tsx/.js/.jsx file changes
- MUST invoke konstruct via /kplan — runs for every /kplan invocation
- MUST invoke arkitect before konstruct when /kplan task contains architecture signals
- MUST invoke almanak when referencing unfamiliar APIs or when no_context principle requires verification
- MUST invoke build-error-resolver when TypeScript compilation or Vitest tests fail (skip for obvious typos)
- MUST invoke doktor after commits that add/remove agents, skills, or commands
- MUST use skill-creator:skill-creator plugin for any skill creation, editing, or evaluation
- NEVER invoke arkitect for routine bug fixes or small features
- NEVER invoke harness-optimizer without explicit /evolve command
- NEVER invoke e2e-runner without explicit /ktest e2e command (tests are expensive)
- NEVER invoke refactor-cleaner without explicit /kfix clean command

## Parallel Execution
- SHOULD launch independent agents in parallel (single message, multiple tool calls)
- NEVER run agents sequentially when their inputs are independent

## Approval Criteria
- CRITICAL → BLOCK merge, fix immediately
- HIGH → WARN, should fix before merge
- MEDIUM/LOW → NOTE, optional

## Communication
- Agents return structured output (markdown with sections)
- MUST include severity levels in reviews (BLOCK/WARN/NOTE or CRITICAL/HIGH/MEDIUM/LOW)
- NEVER let an agent modify code without explicit approval from the user
