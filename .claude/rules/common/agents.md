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
- MUST use opus model for: architect, planner, security-reviewer, database-reviewer, harness-optimizer
- MUST use sonnet model for: code-reviewer, tdd-guide, build-error-resolver, refactor-cleaner, performance-optimizer, python-reviewer, docs-lookup, e2e-runner
- MUST use sonnet model for doc-updater (documentation generation)
- NEVER use haiku for code review, security analysis, or documentation updates

## Agent Catalog (14)

| Agent | Model | Trigger | Command | Skills |
|-------|-------|---------|---------|--------|
| architect | opus | /kplan with architecture signals | /kplan | architecture-decision-records |
| planner | opus | /kplan always | /kplan | architecture-decision-records |
| code-reviewer | sonnet | /code-review, /checkpoint, auto on .ts/.tsx | /code-review | coding-standards, receiving-code-review |
| database-reviewer | opus | Auto on SQL/schema/migration/Supabase | — | database-migrations, postgres-patterns |
| security-reviewer | opus | Auto on auth/keys/input/exec/paths/SQL | /code-review | safety-guard |
| tdd-guide | sonnet | /tdd command | /tdd | tdd-workflow |
| build-error-resolver | sonnet | Auto on TS compilation/Vitest failures | /build-fix | systematic-debugging |
| refactor-cleaner | sonnet | /refactor-clean only | /refactor-clean | coding-standards |
| performance-optimizer | sonnet | Auto on O(n^2)/slow queries/memory | — | — |
| python-reviewer | sonnet | Auto on .py edits | — | — |
| docs-lookup | sonnet | /docs, unfamiliar APIs, no_context | /docs | — |
| doc-updater | sonnet | /update-docs, after structural commits | /update-docs | — |
| e2e-runner | sonnet | /e2e only (expensive) | /e2e | e2e-testing |
| harness-optimizer | opus | /evolve only | /evolve | — |

## Auto-Invoke (no prompt needed)
- Code touches auth/keys/exec/file paths/SQL → security-reviewer
- Editing .ts/.tsx files → code-reviewer (TypeScript specialist mode)
- Editing .py files → python-reviewer
- Editing SQL/schema/migration/Supabase client → database-reviewer
- TypeScript compilation or Vitest fails → build-error-resolver
- Performance concerns (O(n^2), slow queries, memory patterns) → performance-optimizer
- /kplan with architecture signals → architect before planner
- Encountering unfamiliar external API or library → docs-lookup (via /docs)

## Manual Rules
- MUST invoke code-reviewer before any commit via /checkpoint
- MUST invoke planner via /kplan — runs for every /kplan invocation
- MUST invoke architect before planner when /kplan task contains architecture signals
- MUST invoke docs-lookup when referencing unfamiliar APIs or when no_context principle requires verification
- MUST invoke build-error-resolver when TypeScript compilation or Vitest tests fail (skip for obvious typos)
- MUST invoke doc-updater after commits that add/remove agents, skills, or commands
- MUST use skill-creator:skill-creator plugin for any skill creation, editing, or evaluation
- NEVER invoke architect for routine bug fixes or small features
- NEVER invoke harness-optimizer without explicit /evolve command
- NEVER invoke e2e-runner without explicit /e2e command (tests are expensive)
- NEVER invoke refactor-cleaner without explicit /refactor-clean command

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
