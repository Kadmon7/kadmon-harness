---
name: subagent-driven-development
description: Execute implementation plans by dispatching fresh subagents per task with two-stage review. Use when you have a plan from /kplan with independent tasks to execute in the current session. Also use when the user says "execute the plan", "implement the tasks", or when multiple independent implementation steps need parallel execution with quality gates.
---

# Subagent-Driven Development

Execute plan by dispatching a fresh subagent per task, with two-stage review after each: spec compliance first, then code quality.

**Why subagents:** Fresh context per task prevents confusion. You construct exactly what each agent needs — they never inherit session history. This preserves your context for coordination.

**Core principle:** Fresh subagent per task + two-stage review (spec then quality) = high quality, fast iteration.

## When to Use

- Have an implementation plan (from /kplan or written plan)
- Tasks are mostly independent
- Want to stay in the current session (vs. worktree execution)

## The Process

1. Read plan, extract all tasks with full text, create task tracking
2. For each task:
   a. Dispatch implementer subagent with full task text + context
   b. If implementer asks questions: answer, re-dispatch
   c. Implementer implements, tests, commits, self-reviews
   d. Dispatch spec reviewer subagent (verify code matches spec)
   e. If spec issues: implementer fixes, re-review
   f. Dispatch code-reviewer agent for code quality
   g. If quality issues: implementer fixes, re-review
   h. Mark task complete
3. After all tasks: dispatch final code-reviewer for entire implementation
4. Verify all tests pass with /verify

## Model Selection

Use the project's agent routing rules:
- **Mechanical tasks** (1-2 files, clear spec): sonnet model
- **Integration tasks** (multi-file, patterns): sonnet model
- **Architecture/design/review**: opus model

## Implementer Subagent Prompt

```markdown
You are implementing Task N: [task name]

## Task Description
[FULL TEXT of task from plan — paste it, don't make subagent read the file]

## Context
[Where this fits, dependencies, architectural context]

## Before You Begin
If anything is unclear about requirements, approach, or dependencies — ask now.

## Your Job
1. Implement exactly what the task specifies
2. Write tests first (TDD: red → green → refactor)
3. Verify implementation works
4. Commit your work
5. Self-review: completeness, quality, YAGNI, test coverage
6. Report back

## Report Format
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented
- What you tested and results
- Files changed
- Any issues or concerns
```

## Handling Implementer Status

- **DONE:** Proceed to spec review
- **DONE_WITH_CONCERNS:** Read concerns, address if about correctness, then review
- **NEEDS_CONTEXT:** Provide missing info, re-dispatch
- **BLOCKED:** Assess: context problem → more context; too complex → more capable model; too large → break down; plan wrong → escalate to user

Never ignore escalation or retry without changes.

## Spec Compliance Review

Dispatch a reviewer subagent to verify the implementer built what was requested:

```markdown
You are reviewing whether an implementation matches its specification.

## What Was Requested
[FULL TEXT of task requirements]

## What Implementer Claims
[From implementer's report]

## CRITICAL: Do Not Trust the Report
Read the actual code. Compare to requirements line by line.

Check:
- Missing requirements (skipped, not implemented)
- Extra/unneeded work (over-engineering, unrequested features)
- Misunderstandings (wrong interpretation)

Report:
- Pass: Spec compliant (verified by code inspection)
- Fail: Issues found [list with file:line references]
```

## Code Quality Review

Only after spec compliance passes. Dispatch project's code-reviewer agent:
- Review changes between base and head commits
- Check: single responsibility per file, testability, project conventions
- Returns: Critical/Important/Minor issues with assessment

## Red Flags

Never:
- Skip either review stage (spec compliance AND code quality required)
- Start code quality review before spec compliance passes
- Dispatch multiple implementers in parallel (they conflict)
- Make subagent read the plan file (provide full text)
- Ignore subagent questions
- Accept "close enough" on spec compliance
- Move to next task while review has open issues

## Integration

**Project commands used:**
- /verify — run after all tasks complete
- /tdd — subagents should follow TDD for each task
- /code-review — code quality review stage

**Project agents used:**
- code-reviewer — dispatched for code quality stage
- tdd-guide — referenced by subagents for test-first discipline
