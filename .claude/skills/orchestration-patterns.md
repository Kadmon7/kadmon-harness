---
name: orchestration-patterns
description: Dispatch subagents with full objective context, evaluate their results before accepting, run independent tasks in parallel, and execute plans via fresh-agent-per-task with two-stage review. Use this skill whenever dispatching Agent tool calls for research, implementation, debugging, or planning. Applies to every subagent dispatch — whether single, parallel, or plan-driven. If you are about to use the Agent tool, this skill tells you how to do it well.
---

# Orchestration Patterns

Subagents save context but lose semantic understanding. They receive only what you put in the prompt — not why you need it, what you already know, or what comes next. These patterns close that gap.

## When to Use

- Dispatching any subagent for research, exploration, or implementation
- Facing 2+ independent problems that can run concurrently
- Executing a plan from /kplan with multiple tasks
- Evaluating whether subagent output is complete before acting on it

## 1. Context-Rich Dispatch

Every subagent prompt must include TWO things:

1. **The specific query** -- what to find, search, analyze, or implement
2. **The objective context** -- why you need it and how the result will be used

```
BAD:  "Find all files that use the instinct-manager module"
GOOD: "Find all files that use the instinct-manager module.
       Objective: I'm refactoring reinforceInstinct() to accept
       a batch of session IDs. I need to know every call site
       so I can update them all. For each call site, note the
       arguments passed and whether it's in a loop."
```

The objective sentence transforms a generic search into a targeted investigation. The subagent now knows to report call signatures, not just file paths.

**Always provide:**
- Specific scope (one test file, one subsystem, one task)
- Clear goal (make tests pass, implement feature, find root cause)
- Constraints (don't change code outside your scope)
- Context (error messages, test names, relevant file paths, architectural decisions)
- Expected output format (summary of root cause, status report, list of findings)

## 2. Evaluate Before Accepting

When a subagent returns, ask three questions before using the result:

1. **Coverage** -- Did it find everything expected? Are there gaps?
2. **Depth** -- Is there enough detail for the next step? Can I act on this?
3. **Relevance** -- Did it answer the actual question, or a nearby one?

If all three pass, accept the result. If any fail, follow up.

### Follow-Up Rules (Max 3 Cycles)

Use `SendMessage` to the same agent with a targeted follow-up:

```
Cycle 1: "Your results cover X and Y but I also need Z.
          Specifically, [what's missing and why it matters]."

Cycle 2: "The Z results are helpful. One more thing:
          [remaining gap with specific guidance]."

Cycle 3: (Final) Accept what you have or escalate to user.
```

- Be specific about what is missing -- "tell me more" wastes a cycle
- Reference what the agent already found -- build on its context
- Each follow-up should narrow the gap, not restart the search
- After 3 cycles, accept the best available result

**Skip follow-up** for simple factual queries, sufficient direct answers, or well-scoped mechanical tasks (run tests, build). **Always follow up** when the subagent explored unfamiliar code, the result drives architectural decisions, multiple subagents need cross-referencing, or the summary is suspiciously short relative to search scope.

## 3. Parallel Dispatch

When you have multiple unrelated problems, investigating them sequentially wastes time. Each investigation is independent and can happen in parallel.

**Core principle:** One agent per independent problem domain. Let them work concurrently.

**Use parallel when:** 2+ test files failing with different root causes, multiple subsystems broken independently, no shared state between investigations, implementation tasks that don't depend on each other.

**Do NOT use parallel when:** failures are related (fixing one might fix others), you need to understand full system state first, agents would edit the same files, or you are doing exploratory debugging.

### Steps

1. **Identify independent domains** -- group by what is broken
2. **Create focused agent tasks** -- scope, goal, constraints, context, expected output
3. **Dispatch in parallel** -- multiple Agent tool calls in a single message
4. **Review and integrate** -- read summaries, check for conflicts, run /verify, spot-check

### Agent Prompt Example

```markdown
Fix the 3 failing tests in tests/lib/instinct-manager.test.ts:

1. "should update confidence on pattern match" -- expects 0.8, gets 0.3
2. "should archive low-confidence instincts" -- instinct not archived
3. "should handle concurrent updates" -- timeout after 5000ms

These tests pass on main. Recent changes in instinct-manager.ts may have broken them.

Your task:
1. Read the test file and implementation
2. Identify root cause (not symptoms)
3. Fix the implementation (not the tests, unless tests are wrong)
4. Verify all 3 tests pass
5. Verify no other tests break

Do NOT just adjust expected values -- find the real issue.
Return: Summary of root cause and what you fixed.
```

## 4. Plan Execution via Subagents

Execute implementation plans by dispatching a fresh subagent per task, with two-stage review after each.

**Why fresh agents:** Fresh context per task prevents confusion. You construct exactly what each agent needs -- they never inherit session history. This preserves your context for coordination.

### The Process

1. Read plan, extract all tasks with full text, create task tracking
2. For each task:
   a. Dispatch implementer subagent with full task text + context
   b. If implementer asks questions: answer, re-dispatch
   c. Implementer implements, tests, commits, self-reviews
   d. Dispatch spec reviewer (verify code matches spec)
   e. If spec issues: implementer fixes, re-review
   f. Dispatch code-reviewer agent for code quality
   g. If quality issues: implementer fixes, re-review
   h. Mark task complete
3. After all tasks: dispatch final code-reviewer for entire implementation
4. Run /verify for full suite validation

### Implementer Prompt Template

```markdown
You are implementing Task N: [task name]

## Task Description
[FULL TEXT of task from plan -- paste it, don't make subagent read the file]

## Context
[Where this fits, dependencies, architectural context]

## Your Job
1. If anything is unclear -- ask before starting
2. Write tests first (TDD: red -> green -> refactor)
3. Implement exactly what the task specifies
4. Verify, commit, self-review (completeness, YAGNI, coverage)

## Report Format
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented
- What you tested and results
- Files changed
- Any issues or concerns
```

### Handling Implementer Status

| Status | Action |
|--------|--------|
| DONE | Proceed to spec review |
| DONE_WITH_CONCERNS | Read concerns, address if about correctness, then review |
| NEEDS_CONTEXT | Provide missing info, re-dispatch |
| BLOCKED | Assess: context problem -> more context; too complex -> more capable model; too large -> break down; plan wrong -> escalate to user |

Never ignore escalation or retry without changes.

### Two-Stage Review

**Stage 1 -- Spec Compliance:** Verify implementer built what was requested. Read actual code, compare to requirements line by line. Check for missing requirements, extra/unneeded work, misunderstandings.

**Stage 2 -- Code Quality:** Only after spec compliance passes. Dispatch code-reviewer agent. Check single responsibility, testability, project conventions. Returns severity-rated issues.

### Model Selection

- Mechanical tasks (1-2 files, clear spec): sonnet model
- Integration tasks (multi-file, patterns): sonnet model
- Architecture/design/review: opus model

## Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| Fire-and-forget | Accept first result without reading it | Always read and evaluate against coverage/depth/relevance |
| Query-only dispatch | No objective context in prompt | Add objective context to every dispatch |
| Vague follow-up | "Can you look deeper?" | Specify exactly what is missing and why |
| Infinite loop | 4+ follow-up cycles | Hard stop at 3, accept or escalate |
| Duplicate work | Orchestrator re-searches what agent already found | Trust verified results, build on them |
| Too-broad agents | "Fix all tests" | One agent per independent problem domain |
| No constraints | Agent refactors everything | Specify scope boundaries and expected output |
| Skipping review stages | Code quality without spec check | Always run spec compliance first, then code quality |
| Parallel on related failures | Agents step on each other | Verify independence before parallelizing |

## no_context Application

This skill enforces the no_context principle at the orchestration layer. When dispatching subagents:
- Include what you know so the subagent does not hallucinate missing context
- Evaluate what comes back so you do not act on incomplete information
- Follow up with specifics so gaps are filled with evidence, not assumptions

## Integration

**Project commands used:**
- /verify -- run after integrating all agent results
- /tdd -- subagents should follow TDD for each task
- /code-review -- code quality review stage
- /kplan -- source of implementation plans

**Project agents used:**
- code-reviewer -- dispatched for code quality stage
- tdd-guide -- referenced by subagents for test-first discipline
- arkitect / konstruct -- produce the plans that this skill executes
