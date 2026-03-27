# Plan: Optimize All 25 Skills with Skill-Creator

**Date:** 2026-03-26
**Scope:** Optimize descriptions and content of all 25 skills
**Tool:** skill-creator:skill-creator plugin

## Current State

| Grade | Count | Skills | Issue |
|-------|-------|--------|-------|
| A | 2 | explore-before-act, verify-before-commit | Already optimized |
| B | 10 | architecture-decision-records, continuous-learning-v2, daily-research, documentation-lookup, eval-harness, iterative-retrieval, iterative-retrieval-hebrew, safety-guard, search-first, security-review | Decent length but not "pushy" for triggering |
| C | 13 | agentic-engineering, api-design, claude-api, coding-standards, context-budget, cost-aware-llm-pipeline, database-migrations, e2e-testing, mcp-server-patterns, postgres-patterns, strategic-compact, tdd-workflow, verification-loop | Short generic descriptions, low auto-triggering |

## Strategy

**Phase 1: Quick Win — Fix 13 C-grade descriptions (this session)**
- Read each C-grade skill
- Rewrite description to be "pushy" with specific trigger contexts
- Apply skill-creator writing guidelines to body content
- Batch: do all 13 in one pass

**Phase 2: Polish 10 B-grade descriptions (next session)**
- Same process but less rewriting needed
- Focus on adding trigger contexts to existing descriptions

**Phase 3: Full Eval Loop (future sessions)**
- Run skill-creator description optimization loop (run_loop.py) for top 5 most-used skills
- This requires `claude -p` and takes ~15 min per skill

## Phase 1 Execution Order

Batch by theme to maintain context:

### Batch 1: Development Workflow (5 skills)
1. tdd-workflow (40 lines, C)
2. verification-loop (30 lines, C)
3. coding-standards (51 lines, C)
4. context-budget (46 lines, C)
5. strategic-compact (50 lines, C)

### Batch 2: Stack & Infrastructure (5 skills)
6. database-migrations (53 lines, C)
7. postgres-patterns (80 lines, C)
8. mcp-server-patterns (55 lines, C)
9. claude-api (58 lines, C)
10. cost-aware-llm-pipeline (44 lines, C)

### Batch 3: Architecture & Quality (3 skills)
11. agentic-engineering (48 lines, C)
12. api-design (48 lines, C)
13. e2e-testing (69 lines, C)

## Optimization Checklist Per Skill

For each skill:
- [ ] Read current content
- [ ] Rewrite description: 150-500 chars, include "whenever", "even if", "also use when"
- [ ] Add specific trigger phrases the user might say
- [ ] Ensure body explains WHY not just WHAT
- [ ] Keep under 500 lines
- [ ] Verify no duplication with other skills

## Verification

After all optimizations:
```bash
# Count descriptions over 100 chars
for f in .claude/skills/*.md; do desc=$(head -4 "$f" | grep "description:" | sed 's/description: //'); len=${#desc}; name=$(head -3 "$f" | grep "name:"); echo "$len $name"; done | sort -rn

# Verify all A/B grade
npm run build && npx tsc --noEmit && npx vitest run
```

## Expected Result
- 25/25 skills at A or B grade (0 C-grade)
- Better auto-triggering across all skills
- Descriptions 150-500 chars with specific contexts
