---
name: v0.3 command consolidation
description: Commands reduced from 19 to 17 — /context-budget absorbed into /kompact, /instincts absorbed into /instinct
type: project
---

Commands reduced from 19 to 17 as of 2026-03-30.

**Why:** Consolidation pass to reduce surface area — /context-budget folded into /kompact audit subcommand, and /instincts (plural) folded into /instinct (singular) with status/eval subcommands.

**How to apply:** When auditing docs or writing command references:
- /context-budget → /kompact audit
- /instincts → /instinct status
- /instincts eval → /instinct eval
- /learn → /instinct learn
- /instinct-status → /instinct status
- /instinct-export → /instinct export
- /promote → /instinct promote
- /prune → /instinct prune
- /quality-gate → /verify full
- /sessions → removed (use /dashboard)
- /learn-eval → /instinct eval

Current state: 17 commands, 14 agents (typescript-reviewer deleted, merged into code-reviewer as TypeScript Specialist Mode), 20 skills.
Counts: 5 opus agents, 9 sonnet agents.

Skill consolidation (2026-03-30):
- documentation-lookup skill → absorbed into docs-lookup agent
- security-review skill → absorbed into security-reviewer agent
- cost-aware-llm-pipeline skill → absorbed into harness-optimizer agent
- agentic-engineering skill → absorbed into planner agent
- subagent-retrieval + subagent-driven-development + dispatching-parallel-agents → consolidated into orchestration-patterns skill
