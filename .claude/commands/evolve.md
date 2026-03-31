---
description: Run harness self-optimization analysis — full evolution coverage across hooks, instincts, skills, agents, commands, and rules
agent: harness-optimizer
---

## Purpose
Invoke harness-optimizer agent to analyze every harness component and propose evolution paths.

## Steps
1. Invoke harness-optimizer agent (opus)
2. Analyze: hook latency + failure rates from observations JSONL
3. Analyze: instinct quality + promotable candidates (confidence >= 0.7, occurrences >= 3)
4. Analyze: skill usage patterns — propose new agents for complex skills
5. Analyze: session patterns — propose new commands for repeated workflows
6. Analyze: recurring problems — propose new rules for persistent issues
7. Analyze: agent descriptions — flag weak auto-invoke triggers
8. Analyze: cost trends across sessions
9. Analyze: memory health — count files in project memory dir, flag `updated_at` > 30 days, verify MEMORY.md within budget limits, check for orphaned index entries
10. Produce full evolution report with 6 categories:
   - PROMOTE: instincts ready to become skills
   - CREATE AGENT: skills ready to become agents
   - CREATE COMMAND: patterns ready to become commands
   - CREATE RULE: problems ready to become rules
   - OPTIMIZE: hooks/agents/skills to improve
   - MEMORY: stale/orphaned/over-budget memory entries
11. NEVER auto-apply — architect approves all changes

## Output
Evolution report with 5 categories of actionable recommendations, priority levels, and expected impact.

## Example
```
### PROMOTE — Instincts ready to become skills
- "Read files before editing" (0.8, 6x) — promote to editing-workflow skill

### CREATE AGENT — Skills ready to become agents
(none currently)

### OPTIMIZE — Hooks/agents/skills to improve
- observe-pre: 45ms avg (target: 50ms) — OK but near limit
- cost-tracker: $0.00 all sessions — transcript estimation needed
```