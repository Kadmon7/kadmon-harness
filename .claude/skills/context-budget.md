---
name: context-budget
description: Manage Claude Code's context window to avoid performance degradation — monitor, assess, and compact at the right moment. Use this skill when responses feel slower or less accurate, when planning a long multi-file session, when switching between major tasks, or when tempted to compact mid-debugging or mid-implementation. Also use when the user mentions "context", "window", "slow", "compact", or "running out of space". Helps decide WHEN to compact, what to keep, and what is dangerous to lose.
---

# Context Budget

Manage Claude Code's context window to avoid degraded performance in long sessions.

## When to Use
- At the start of complex tasks (plan context usage)
- When responses start feeling slower or less accurate
- Before starting a new major subtask
- When switching from one major task to another
- After completing and committing a feature

## How It Works
1. **Monitor** — Use /context-budget to check context usage
2. **Assess** — Evaluate what is critical vs expendable in current context
3. **Decide when** — Use the timing guide below
4. **Compact** — Use /kompact for guided compaction with audit and safety checks
5. **Reload** — Re-read critical files after compaction (types.ts, current file)

## When to Compact

### Good times (safe)
- After a commit (work is saved)
- After completing a file implementation (tests pass)
- Before switching from library code to hook code
- After a research/analysis phase, before implementation
- Between major implementation phases

### Bad times (dangerous)
- Mid-implementation of a multi-file feature
- While holding context about cross-file dependencies
- Before committing (you'll forget what changed)
- During debugging (you'll lose the error trail)
- Mid-research when cross-file connections matter

**Rule of thumb**: if in doubt, don't compact — slightly slower is better than losing context.

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
Reading 10 source files for analysis -> compact after producing the analysis
Don't compact mid-research — you'll lose the cross-file connections
```

### Example 3: Bug investigation
```
Found bug in file A, traced cause to file B -> DO NOT compact
Fix -> test -> commit -> THEN compact safely
```

## Rules
- Compact at natural breakpoints (between features, not mid-implementation)
- Never compact while holding uncommitted work context
- After compaction, re-read critical files (types.ts, the file you're editing)
- Use /kompact for guided compaction with audit and safety checks
- Compact after commits, not before
- The pre-compact-save hook automatically saves session state before compaction

## no_context Application
Context budget management prevents the scenario where Claude "forgets" earlier context and starts inventing. By compacting strategically and re-reading critical files, no_context is maintained even in long sessions. The pre-compact-save hook preserves state, and the session-start hook restores it in the next session.
