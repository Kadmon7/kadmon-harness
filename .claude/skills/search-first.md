---
name: search-first
description: Research existing code before writing new code — search, explore, then act. Use this skill whenever about to write a new function, add a dependency, design a new pattern, implement something unfamiliar, modify code in an unfamiliar module, debug across multiple files, or enter a new area of the codebase. Also use when the no-context-guard hook blocks an edit — it means you skipped the research step. The foundation of the no_context principle: if you haven't searched for it, you might be reinventing the wheel. Reading one file tells you WHAT; reading its neighbors tells you WHY.
---

# Search First

Research before coding. The foundation of the no_context principle.

## When to Use
- Before writing any new function or module
- Before adding a dependency
- Before designing a new pattern
- When asked to implement something unfamiliar
- Before modifying code in an unfamiliar module
- When debugging across multiple files

## Phase 1: Search
Find what already exists.

1. **Search the codebase** — Grep/Glob for existing implementations
2. **Search dependencies** — Check if a library already solves this
3. **Search documentation** — Use /docs or almanak agent for API details
4. **Evaluate** — Can you reuse? Adapt? Or must you build new?

## Phase 2: Explore
Build a mental model of the code area before touching it.

1. **Identify the cluster** — which files are related? Think: types, implementation, persistence layer, tests
2. **Read 3+ files** consecutively before switching to Edit, Bash, or Write
3. **Build context** — understand interfaces, dependencies, data flow, and naming patterns
4. **Then act** — now that you see how pieces connect, your edit will fit naturally

The key insight: reading one file tells you WHAT a function does, but reading its neighbors tells you WHY it does it that way and WHAT depends on it.

## Phase 3: Act
Only implement after Phase 1 and Phase 2 are complete.

## Examples

### Example 1: Adding UUID generation
```
Phase 1 (Search): Grep for "uuid" or "generateId"
   Found: scripts/lib/utils.ts exports generateId() using crypto.randomUUID()
   Result: reuse existing function, no new dependency
```

### Example 2: Fixing a bug in session-manager
```
Phase 1 (Search): Grep for the function name, check callers
Phase 2 (Explore):
   Read scripts/lib/types.ts              -> SessionSummary interface shape
   Read scripts/lib/session-manager.ts    -> the function with the bug
   Read scripts/lib/state-store.ts        -> how it persists to SQLite
   Read tests/lib/session-manager.test.ts -> expected behavior and edge cases
Phase 3 (Act): Edit the fix with full context
```

### Example 3: Adding a new hook
```
Phase 2 (Explore):
   Read .claude/hooks/scripts/observe-pre.js -> existing hook pattern
   Read .claude/hooks/scripts/parse-stdin.js -> stdin parsing helper
   Read .claude/settings.json                -> how hooks are wired to triggers
Phase 3 (Act): Write the new hook following the pattern
```

## Rules
- Always search before coding — enforced by the no-context-guard hook
- If you find existing code that does 80% of what you need, adapt it
- If no existing solution: document why in a comment
- Never assume a library API — use almanak agent
- Read the target file AND its neighbors before editing

## Automatic Detection
The `evaluate-session.js` hook tracks two patterns:
- "Search before writing new code" — Grep/Glob before Edit/Write
- "Explore multiple files before taking action" — clusters of 3+ consecutive Read calls

## no_context Application
This skill IS the no_context methodology. The no-context-guard hook enforces it at the tool level: you cannot Write/Edit a file without having Read files in the same directory first.
