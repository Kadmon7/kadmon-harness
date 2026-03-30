---
name: subagent-retrieval
description: Evaluate subagent results before accepting them — dispatch with objective context, follow up via SendMessage if incomplete, max 3 cycles. Use this skill whenever dispatching Agent tool calls for research, exploration, or planning tasks. Especially important when the subagent lacks context the orchestrator has (which is always), when results feel thin or miss key details, or when you're about to act on subagent output without verifying completeness. If you dispatch a subagent, this skill applies.
---

# Subagent Retrieval

Subagents save context but lose semantic understanding. They know the literal query, not the PURPOSE behind it. This skill closes that gap with a dispatch-evaluate-followup loop.

## The Problem

When you dispatch a subagent, it receives only what you put in the prompt. It lacks:
- Why you need this information (the broader task)
- What you already know (prior context)
- What you plan to do with the result (downstream use)

The result: summaries that miss key details, answers that are technically correct but contextually incomplete, and wasted cycles when you have to re-research what the subagent already found but didn't report.

## How It Works

### Phase 1: Context-Rich Dispatch

Every subagent prompt must include TWO things:

1. **The specific query** — what to find, search, or analyze
2. **The objective context** — why you need it and how it will be used

```
BAD:  "Find all files that use the instinct-manager module"
GOOD: "Find all files that use the instinct-manager module.
       Objective: I'm refactoring reinforceInstinct() to accept
       a batch of session IDs. I need to know every call site
       so I can update them all. For each call site, note the
       arguments passed and whether it's in a loop."
```

The objective sentence transforms a generic search into a targeted investigation. The subagent now knows to report call signatures, not just file paths.

### Phase 2: Evaluate Before Accepting

When a subagent returns, ask three questions before using the result:

1. **Coverage** — Did it find everything I expected? Are there gaps?
2. **Depth** — Is there enough detail for my next step? Can I act on this?
3. **Relevance** — Did it answer the actual question, or a nearby one?

If all three pass, accept the result. If any fail, proceed to Phase 3.

### Phase 3: Follow-Up (Max 3 Cycles)

Use `SendMessage` to the same agent with a targeted follow-up:

```
Cycle 1: "Your results cover X and Y but I also need Z.
          Specifically, [what's missing and why it matters]."

Cycle 2: "The Z results are helpful. One more thing:
          [remaining gap with specific guidance]."

Cycle 3: (Final) Accept what you have or escalate to user.
```

Rules for follow-ups:
- Be specific about what's missing — "tell me more" wastes a cycle
- Reference what the agent already found — build on its context
- Each follow-up should narrow the gap, not restart the search
- After 3 cycles, accept the best available result

## When to Skip Follow-Up

Not every subagent result needs scrutiny. Accept immediately when:
- The query was simple and factual (file existence, line count, grep result)
- The result directly answers the question with sufficient detail
- You can verify correctness yourself faster than a follow-up cycle
- The subagent was doing a well-scoped, mechanical task (run tests, build)

## When Follow-Up Is Critical

Always evaluate carefully when:
- The subagent explored unfamiliar code (it may have missed key files)
- The result will drive architectural decisions (wrong info = wrong design)
- Multiple subagents returned — you need to cross-reference their findings
- The summary is suspiciously short relative to the search scope

## Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| Fire-and-forget | Accept first result without reading it | Always read and evaluate |
| Query-only dispatch | No objective context in prompt | Add "Objective:" to every dispatch |
| Vague follow-up | "Can you look deeper?" | Specify exactly what's missing |
| Infinite loop | 4+ follow-up cycles | Hard stop at 3, accept or escalate |
| Duplicate work | Orchestrator re-searches what agent already found | Trust verified results, build on them |

## Connection to Kadmon Harness

This skill complements the existing agent catalog:
- **Explore agents** benefit most — they search broad codebases and easily miss context
- **Plan agents** benefit when the plan needs to reference specific code patterns
- **Review agents** usually don't need follow-up (they produce structured output)

The pattern is tracked by `evaluate-session.js`: sequences of Agent dispatch followed by SendMessage indicate iterative retrieval is being practiced.
