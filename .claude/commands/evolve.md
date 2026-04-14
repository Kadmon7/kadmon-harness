---
description: Run harness self-optimization analysis — full evolution coverage across hooks, instincts, skills, agents, commands, and rules
agent: alchemik
---

## Purpose
Invoke alchemik agent to analyze every harness component and propose evolution paths.

## Steps
1. Invoke alchemik agent (opus)
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
11. NEVER auto-apply — arkitect approves all changes

12. **Step 6 "Generate" (EXPERIMENTAL — refining heuristics through 2026-04-28)** — CWD-aware artifact generation from ClusterReports:
   - Alchemik emits `GenerateProposal[]` in a `json-generate-proposals` fence (see alchemik.md step 6)
   - Command-level Claude parses the fence and calls `runEvolveGenerate({ projectHash, cwd, reportsDir })` to validate shape and build `EvolveGeneratePreview`
   - Render approval gate (table format matching /forge step 6): one row per proposal with `#`, type, name, target path, complexity, confidence, source clusters
   - Await user input: `all` / `none` / `1,3,5` (subset) / `abort`
   - For approved subset:
     - For `suggestedCategory === "PROMOTE"` (type: skill) — invoke `skill: "skill-creator:skill-creator"` with the proposal's `SkillSpec`
     - For all other types — `applyEvolveGenerate(preview, { approvedIndices }, { projectHash, cwd })` writes markdown directly from templates at `scripts/lib/evolve-generate-templates/*.md`
   - Collision handling: `applyEvolveGenerate` aborts the ENTIRE batch transactionally if ANY target path exists (ADR-008:62). User must resolve collisions manually before re-running.
   - Fallback if `skill-creator:skill-creator` plugin invocation fails: command emits the `SkillSpec` as inline markdown for manual use (ADR-008 Q2)
   - Report written files + plugin results summary to user

## Output
Evolution report with 5 categories of actionable recommendations, priority levels, expected impact, AND (when step 6 runs) a list of generated artifacts with their target paths.

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