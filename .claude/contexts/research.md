---
description: Research and exploration mode — relaxed write guards, search-first emphasis
---

# Research Context

Read widely, ask questions, document findings. Do not code until the problem is clear.

## Priorities
1. Understand — read existing code and documentation
2. Explore — search for patterns, libraries, prior art
3. Hypothesis — form a theory about the right approach
4. Verify — confirm with documentation (use /docs)
5. Summarize — document findings before implementing

## Workflow
- ALWAYS use /docs for API lookups
- PREFER reading over writing
- PREFER Grep/Glob for codebase exploration
- Document findings in markdown before proposing code
- Use architect agent for design decisions

## Hooks
- no-context-guard: DISABLED (set KADMON_NO_CONTEXT_GUARD=off)
- observe hooks: active (still tracking research patterns)
- safety hooks: active (still blocking --no-verify)
- quality hooks: relaxed (no auto-format during exploration)

## Tools to Favor
- Read — primary tool for understanding code
- Grep, Glob — searching patterns across codebase
- WebSearch, WebFetch — external research
- almanak agent — API documentation via Context7

## Output
- Findings first, recommendations second
- Cite sources for every claim
- Flag gaps: what is still unknown after research
