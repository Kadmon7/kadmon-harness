---
alwaysApply: true
---

# Agent Usage Rules

## Routing
- MUST use opus model for: architect, planner, security-reviewer, database-reviewer, harness-optimizer
- MUST use sonnet model for: code-reviewer, typescript-reviewer, tdd-guide, build-error-resolver, refactor-cleaner, docs-lookup, e2e-runner
- MUST use sonnet model for doc-updater (documentation generation)
- NEVER use haiku for code review, security analysis, or documentation updates

## Agent Catalog (13)

| Agent | Model | Trigger | Command |
|-------|-------|---------|---------|
| architect | opus | /kplan when architecture signals detected (design, schema, migration, new system, multi-component), explicit design review | /kplan |
| planner | opus | /kplan always — after architect (Route A) or directly (Route B) | /kplan |
| code-reviewer | sonnet | /code-review, /checkpoint (auto-invoked before commit) | /code-review, /checkpoint |
| typescript-reviewer | sonnet | Auto-invoked when editing .ts/.tsx files, /code-review on TS changes | /code-review |
| database-reviewer | opus | Auto-invoked when editing SQL, schema, migration, or Supabase client files | — |
| security-reviewer | opus | Auto-invoked for auth, API keys, user input, exec/spawn, file paths, SQL | /code-review |
| tdd-guide | sonnet | /tdd command to enforce red-green-refactor cycle | /tdd |
| build-error-resolver | sonnet | Auto-invoked on TypeScript compilation failure, Vitest errors, module resolution errors | /build-fix |
| refactor-cleaner | sonnet | /refactor-clean command only (never auto-triggered) | /refactor-clean |
| docs-lookup | sonnet | /docs command, unfamiliar API references, no_context verification | /docs |
| doc-updater | sonnet | /update-docs command, suggested after commits adding agents/skills/commands | /update-docs |
| e2e-runner | sonnet | /e2e command only (expensive, on-demand) | /e2e |
| harness-optimizer | opus | /evolve command only (never auto-applies, produces recommendations) | /evolve |

## Auto-Invoke (no prompt needed)
- Code touches auth/keys/exec/file paths/SQL → security-reviewer
- Editing .ts/.tsx files → typescript-reviewer
- Editing SQL/schema/migration/Supabase client → database-reviewer
- TypeScript compilation or Vitest fails → build-error-resolver
- /kplan with architecture signals → architect before planner

## Manual Rules
- MUST invoke code-reviewer before any commit via /checkpoint
- MUST invoke planner via /kplan — runs for every /kplan invocation
- MUST invoke architect before planner when /kplan task contains architecture signals
- SHOULD invoke docs-lookup when referencing unfamiliar APIs or when no_context principle requires verification
- SHOULD invoke build-error-resolver when TypeScript compilation or Vitest tests fail (skip for obvious typos)
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
