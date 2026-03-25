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
| architect | opus | /kplan for architectural tasks, explicit design review request | /kplan |
| planner | opus | /kplan for implementation planning, multi-file tasks | /kplan |
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

## When to Invoke
- ALWAYS invoke security-reviewer for code touching: authentication, encryption, API keys, user input, exec/spawn, file paths, SQL queries
- ALWAYS invoke code-reviewer before any commit via /checkpoint
- ALWAYS invoke typescript-reviewer when editing .ts or .tsx files
- ALWAYS invoke database-reviewer when editing SQL, schema definitions, or Supabase client code
- ALWAYS invoke planner for tasks involving multiple files or uncertain approach
- ALWAYS invoke docs-lookup when referencing unfamiliar APIs or when no_context principle requires verification
- ALWAYS invoke build-error-resolver when TypeScript compilation or Vitest tests fail
- NEVER invoke architect for routine bug fixes or small features
- NEVER invoke harness-optimizer without explicit /evolve command
- NEVER invoke e2e-runner without explicit /e2e command (tests are expensive)
- NEVER invoke refactor-cleaner without explicit /refactor-clean command

## Communication
- Agents return structured output (markdown with sections)
- MUST include severity levels in reviews (BLOCK/WARN/NOTE or CRITICAL/HIGH/MEDIUM/LOW)
- NEVER let an agent modify code without explicit approval from the user
