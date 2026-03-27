---
name: context-budget
description: Manage Claude Code's context window to avoid performance degradation. Use this skill whenever the suggest-compact hook fires (50+ tool calls), when responses feel slower or less accurate, when planning a long multi-file session, or when switching between major tasks. Also use when the user mentions "context", "window", "slow", "compact", or "running out of space". Helps decide WHEN to compact and what to keep in context.
---

# Context Budget

Manage Claude Code's context window to avoid degraded performance in long sessions.

## When to Use
- At the start of complex tasks (plan context usage)
- When suggest-compact hook fires (>50 tool calls)
- When responses start feeling slower or less accurate
- Before starting a new major subtask

## How It Works
1. **Monitor** — The suggest-compact hook tracks tool call count
2. **Assess** — Check context usage via /context-budget command
3. **Compact strategically** — Use /compact at natural breakpoints, not mid-task
4. **Prioritize** — Keep critical context (types, interfaces, current task) in window

## Examples

### Example 1: Long implementation session
```
Session plan:
1. Implement utils.ts (small) — no compact needed
2. Implement state-store.ts (large) — compact AFTER, before next file
3. Implement session-manager.ts (medium) — uses state-store, keep in context
4. Compact before switching to hook implementation
```

### Example 2: Context-heavy research
```
Reading 10 source files for analysis → compact after producing the analysis
Don't compact mid-research — you'll lose the cross-file connections
```

## Rules
- Compact at natural breakpoints (between features, not mid-implementation)
- Never compact while holding uncommitted work context
- After compaction, re-read critical files (types.ts, the file you're editing)
- The suggest-compact hook suggests at 50+ tool calls — take the suggestion seriously

## no_context Application
Context budget management prevents the scenario where Claude "forgets" earlier context and starts inventing. By compacting strategically and re-reading critical files, no_context is maintained even in long sessions.
