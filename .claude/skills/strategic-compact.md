---
name: strategic-compact
description: Use when deciding whether and when to compact context during a session
---

# Strategic Compact

Compact at the right moment, not arbitrarily.

## When to Use
- When suggest-compact hook fires
- Between major implementation phases
- After completing a self-contained task
- Before switching to a completely different area of the codebase

## How It Works
1. **Good times to compact:**
   - After a commit (work is saved)
   - After completing a file implementation (tests pass)
   - Before switching from library code to hook code
   - After a research/analysis phase, before implementation

2. **Bad times to compact:**
   - Mid-implementation of a multi-file feature
   - While holding context about cross-file dependencies
   - Before committing (you'll forget what changed)
   - During debugging (you'll lose the error trail)

## Examples

### Example 1: Kadmon Harness implementation session
```
✅ Good: Finished state-store.ts + tests → compact → start cost-calculator.ts
❌ Bad: Mid-way through session-manager.ts which depends on state-store.ts
```

### Example 2: Bug investigation
```
❌ Bad: Found the bug in file A, traced cause to file B → compact → forgot file A
✅ Good: Found bug → fixed → tested → committed → compact
```

## Rules
- The pre-compact-save hook automatically saves session state before compaction
- After compaction, always re-read: types.ts + the file you're currently working on
- Compact after commits, not before
- If in doubt, don't compact — slightly slower is better than losing context

## no_context Application
Strategic compaction prevents the dangerous scenario where Claude compacts away critical context and then invents information to fill the gap. The pre-compact-save hook preserves state, and the session-start hook restores it in the next session.
