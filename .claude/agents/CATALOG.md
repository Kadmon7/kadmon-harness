---
name: agents-catalog
description: Full agent catalog with triggers and skills. Read on-demand by agent-metadata-sync hook and /medik Check #14. Source-of-truth for the 16-row Agent table; rules reference this file via pointer.
---

<!-- DO NOT AUTO-LOAD: this file is read on-demand by agent-metadata-sync.js and human readers. Lives outside .claude/rules/ to avoid eager context injection. See ADR-035. -->

# Agent Catalog

## Agents (16)

| Agent | Model | Trigger | Command | Skills |
|-------|-------|---------|---------|--------|
| arkitect | opus | /abra-kdabra with architecture signals | /abra-kdabra | architecture-decision-records, api-design, docker-patterns, hexagonal-architecture |
| konstruct | opus | /abra-kdabra always | /abra-kdabra | architecture-decision-records, eval-harness, codebase-onboarding |
| kody | sonnet | /chekpoint | /chekpoint | coding-standards, receiving-code-review, git-workflow, github-ops, regex-vs-llm-structured-text |
| typescript-reviewer | sonnet | Auto on .ts/.tsx/.js/.jsx edits | /chekpoint | coding-standards, frontend-patterns |
| orakle | sonnet | Auto on SQL/schema/migration/Supabase | /chekpoint | database-migrations, postgres-patterns, content-hash-cache-pattern |
| spektr | opus | Auto on auth/keys/input/exec/paths/SQL | /chekpoint | safety-guard, security-review, security-scan |
| feniks | sonnet | /abra-kdabra (if needs_tdd) | /abra-kdabra | tdd-workflow, python-testing, eval-harness, ai-regression-testing |
| mekanik | sonnet | /medik Phase 2 (always), auto on TypeScript or test-runner failures | /medik | systematic-debugging, agent-introspection-debugging |
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
- TypeScript compilation or test runner fails → mekanik
- Performance concerns (O(n^2), slow queries, memory patterns) → arkonte
- /abra-kdabra with architecture signals → arkitect before konstruct
- Encountering unfamiliar external API or library → almanak (via /almanak)
- User asks to research/investigate/deep-dive/compare/analyze topics beyond the current codebase → skavenger (via /skavenger)
