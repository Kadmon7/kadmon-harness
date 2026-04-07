---
name: systematic-debugging
description: Investigate root cause before proposing fixes. Use when encountering any bug, test failure, unexpected behavior, performance problem, build failure, or integration issue. Use ESPECIALLY when under time pressure, when a "quick fix" seems obvious, when you've already tried multiple fixes, or when you don't fully understand the issue. Even simple bugs have root causes — this process is faster than guess-and-check thrashing.
---

# Systematic Debugging

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you have not completed Phase 1, you cannot propose fixes.

## The Four Phases

Complete each phase before proceeding to the next.

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully**
   - Read stack traces completely
   - Note line numbers, file paths, error codes
   - They often contain the exact solution

2. **Reproduce Consistently**
   - Can you trigger it reliably?
   - What are the exact steps?
   - If not reproducible: gather more data, don't guess

3. **Check Recent Changes**
   - `git diff`, recent commits
   - New dependencies, config changes
   - Environmental differences

4. **Gather Evidence in Multi-Component Systems**
   For each component boundary: log what enters, what exits, verify state at each layer. Run once to gather evidence showing WHERE it breaks, then investigate that specific component.

5. **Trace Data Flow**
   - Where does the bad value originate?
   - What called this with bad value?
   - Trace backward until you find the source
   - Fix at source, not at symptom

### Phase 2: Pattern Analysis

1. **Find Working Examples** — locate similar working code in the codebase
2. **Compare Against References** — read reference implementation completely, don't skim
3. **Identify Differences** — list every difference, however small
4. **Understand Dependencies** — what components, settings, config, assumptions?

### Phase 3: Hypothesis and Testing

1. **Form Single Hypothesis** — "I think X is the root cause because Y"
2. **Test Minimally** — smallest possible change, one variable at a time
3. **Verify** — worked? Phase 4. Didn't? New hypothesis, don't pile fixes
4. **When You Don't Know** — say so. Research more. Ask for help.

### Phase 4: Implementation

1. **Create Failing Test** — simplest reproduction, automated if possible. Follow TDD workflow.
2. **Implement Single Fix** — one change, no "while I'm here" improvements
3. **Verify Fix** — test passes? no regressions? issue resolved?
4. **If Fix Doesn't Work:**
   - Count fixes attempted
   - If < 3: return to Phase 1 with new information
   - If >= 3: STOP — question the architecture (see below)

### When 3+ Fixes Fail: Question Architecture

Pattern: each fix reveals new coupling, requires massive refactoring, or creates new symptoms elsewhere.

**STOP and question fundamentals:**
- Is this pattern fundamentally sound?
- Should we refactor architecture vs. continue fixing symptoms?
- Discuss with user before attempting more fixes

This is NOT a failed hypothesis — this is a wrong architecture.

## Red Flags — STOP and Return to Phase 1

If you catch yourself thinking:
- "Quick fix for now, investigate later"
- "Just try changing X and see"
- "I don't fully understand but this might work"
- "Here are the main problems:" (listing fixes without investigation)
- Proposing solutions before tracing data flow
- "One more fix attempt" (after 2+ failures)

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple" | Simple issues have root causes too |
| "Emergency, no time" | Systematic is FASTER than thrashing |
| "Just try this first" | First fix sets the pattern. Do it right. |
| "Multiple fixes saves time" | Can't isolate what worked. Causes new bugs. |
| "I see the problem" | Seeing symptoms != understanding root cause |

## Quick Reference

| Phase | Key Activities | Success Criteria |
|-------|---------------|------------------|
| 1. Root Cause | Read errors, reproduce, check changes, gather evidence | Understand WHAT and WHY |
| 2. Pattern | Find working examples, compare | Identify differences |
| 3. Hypothesis | Form theory, test minimally | Confirmed or new hypothesis |
| 4. Implementation | Create failing test, fix, verify | Bug resolved, tests pass |

## Integration

**Project commands:**
- /abra-kdabra — for creating failing test case (Phase 4, with TDD)
- /chekpoint — verify fix before claiming success (verify + review + commit)
- /medik — for build/compilation failures (delegates to mekanik)

**Project agents:**
- feniks — guides test-first discipline in Phase 4
- mekanik — specialized for TypeScript compilation and Vitest errors
