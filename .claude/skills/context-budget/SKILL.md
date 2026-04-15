---
name: context-budget
description: Manage Claude Code's context window to avoid performance degradation — monitor, assess, and compact at the right moment. Use this skill when responses feel slower or less accurate, when planning a long multi-file session, when switching between major tasks, or when tempted to compact mid-debugging or mid-implementation. Also use when the user mentions "context", "window", "slow", "compact", or "running out of space". Helps decide WHEN to compact, what to keep, and what is dangerous to lose.
---

# Context Budget

Manage Claude Code's context window to avoid degraded performance in long sessions. Context is finite — every file you read, every command you run, and every response you generate consumes it. Planning how to spend it is as important as planning the code itself.

## When to Use
- At the start of complex tasks (plan context usage)
- When responses start feeling slower or less accurate
- Before starting a new major subtask
- When switching from one major task to another
- After completing and committing a feature
- When a session has exceeded 200+ tool calls

## Token Estimation
Rough guide for planning how much context a task will consume:

| Content | Approximate Tokens |
|---------|-------------------|
| 1 KB of text | ~250 tokens |
| Typical .ts file (50-150 lines) | 500-2,000 tokens |
| Large module (300+ lines) | 3,000-6,000 tokens |
| Full test file | 1,000-3,000 tokens |
| A skill document (~80 lines) | ~800 tokens |
| Each tool call + response | 200-1,000 tokens |
| A git diff (medium PR) | 2,000-5,000 tokens |

Use these estimates to decide whether you can afford to read "one more file" or if you should compact first.

## How It Works
1. **Monitor** — Use /kompact audit to check context usage
2. **Assess** — Evaluate what is critical vs expendable in current context
3. **Decide when** — Use the timing guide below
4. **Compact** — Use /kompact for guided compaction with audit and safety checks
5. **Reload** — Re-read critical files after compaction

## Pre-Session Planning
Before starting a complex task, estimate which files you will need and in what order. This prevents mid-task compaction, which is the most dangerous kind.

```
Task: "Add a new instinct export format"
Files needed:
  - scripts/lib/types.ts (interface shapes)     ~800 tokens
  - scripts/lib/instinct-manager.ts (existing logic) ~1500 tokens
  - tests/lib/instinct-manager.test.ts (test patterns) ~2000 tokens
  - scripts/lib/state-store.ts (query layer)     ~2000 tokens
Estimated total: ~6300 tokens for reading alone
Plan: read types first, then instinct-manager, then write test, then implement
```

## Multi-File Session Strategy
When working across many files, batch your work to minimize context pressure:

1. **Group related files** — read types.ts + implementation + test together, not scattered
2. **Complete one module before starting another** — finish, test, commit, then move on
3. **Commit between modules** — this creates safe compaction points
4. **Defer unrelated reads** — if you see something interesting in another module, note it but do not read it yet

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
- Before committing (you will forget what changed)
- During debugging (you will lose the error trail)
- Mid-research when cross-file connections matter

**Rule of thumb**: if in doubt, do not compact — slightly slower is better than losing context.

## Reload Priority After Compaction
After compacting, you lose all file contents. Re-read in this order because each layer builds on the previous:

1. **types.ts** — interface shapes that everything depends on (always first)
2. **The file you are actively editing** — restore working context
3. **The test file for that module** — remember what behavior is expected
4. **Adjacent files** — only if cross-file dependencies matter for the current task

Do NOT re-read files you are done with. The whole point of compaction is to shed context you no longer need.

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

## Anti-Patterns
- **Compacting mid-debug** — You traced a bug through 4 files and now compact to "free up space." You just erased the trail. Fix first, compact after.
- **Reading every file "just in case"** — Each unnecessary read burns context. Use Grep to find the right file, then read only that file.
- **Never compacting** — Eventually quality degrades. Compact proactively at safe points rather than waiting for degradation.
- **Re-reading everything after compaction** — Only reload what the current task needs. Compaction is an opportunity to shed old context.

## Integration
- **/kompact** command implements this skill (full flow: audit + safety + summarize + compact guidance)
- **/kompact audit** subcommand for quick context usage checks without compacting
- **pre-compact-save** hook automatically saves session state and pending tasks before compaction
- **session-start** hook restores 3 recent sessions with history trajectory and pending work carry-forward
- **/context-budget** command audits current context window usage

## Rules
- Compact at natural breakpoints (between features, not mid-implementation)
- Never compact while holding uncommitted work context
- After compaction, re-read critical files (types.ts, the file you are editing)
- Use /kompact for guided compaction with audit and safety checks
- Compact after commits, not before
- Plan context usage before starting complex multi-file tasks

## no_context Application
Context budget management prevents the scenario where Claude "forgets" earlier context and starts inventing. By compacting strategically and re-reading critical files, the no_context principle is maintained even in long sessions. The pre-compact-save hook preserves state and pending tasks, and the session-start hook restores 3 recent sessions with trajectory and pending work in the next session.
