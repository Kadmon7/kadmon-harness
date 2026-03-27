---
name: explore-before-act
description: Read 3+ related files before editing or running commands. Use this skill whenever you're about to modify code in an unfamiliar module, debug an issue across multiple files, enter a new area of the codebase, or implement a feature that touches several components. Even if the change seems small, building context from surrounding files prevents mistakes. Complements search-first (which says "search before coding") with the specific pattern of reading in clusters.
---

# Explore Before Act

The fastest way to break code is to edit a file you don't fully understand. Reading a single file shows you the function; reading its neighbors shows you the system. This skill is about building a mental model of the code area before touching it.

## How It Works

1. **Identify the cluster** — which files are related to the task? Think: types, implementation, persistence layer, tests
2. **Read 3+ files** consecutively before switching to Edit, Bash, or Write
3. **Build context** — understand interfaces, dependencies, data flow, and naming patterns
4. **Then act** — now that you see how pieces connect, your edit will fit naturally

The key insight is that reading one file tells you WHAT a function does, but reading its neighbors tells you WHY it does it that way and WHAT depends on it.

## Examples

**Fixing a bug in session-manager:**
```
Read scripts/lib/types.ts              → SessionSummary interface shape
Read scripts/lib/session-manager.ts    → the function with the bug
Read scripts/lib/state-store.ts        → how it persists to SQLite
Read tests/lib/session-manager.test.ts → expected behavior and edge cases
THEN: Edit the fix with full context
```

**Adding a new hook:**
```
Read .claude/hooks/scripts/observe-pre.js → existing hook pattern
Read .claude/hooks/scripts/parse-stdin.js → stdin parsing helper
Read .claude/settings.json                → how hooks are wired to triggers
THEN: Write the new hook following the pattern
```

## Why This Matters

The no-context-guard hook enforces reading the TARGET file before editing it. But that's the minimum — reading just the target is like reading one page of a book. This skill goes further: read the chapter. When you understand the surrounding context (types, callers, tests, dependencies), your changes are more likely to be correct the first time, reducing debugging cycles.

## Automatic Detection

The `evaluate-session.js` hook tracks this pattern: clusters of 3+ consecutive Read calls in the tool sequence. When 3+ such clusters appear in a session, the pattern instinct is reinforced.
