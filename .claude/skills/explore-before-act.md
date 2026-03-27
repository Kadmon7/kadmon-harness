---
name: explore-before-act
description: Use before making changes — read 3+ related files in clusters to build context before editing or running commands
---

# Explore Before Act

Read multiple related files before taking action. Build a mental model of the code area before changing it.

Promoted from instinct: confidence 0.9, 13 occurrences across sessions.

## When to Use
- Before editing any file in an unfamiliar module
- Before running a command that affects multiple components
- When entering a new area of the codebase
- When debugging — read the call chain before proposing fixes

## How It Works
1. **Identify the cluster** — which files are related to the task?
2. **Read 3+ files** consecutively before switching to Edit/Bash/Write
3. **Build context** — understand types, dependencies, and patterns
4. **Then act** — edit, run tests, or execute commands

## Examples

### Example 1: Fixing a bug in session-manager
```
Read scripts/lib/types.ts          → understand SessionSummary interface
Read scripts/lib/session-manager.ts → understand the function to fix
Read scripts/lib/state-store.ts     → understand how it persists
Read tests/lib/session-manager.test.ts → understand expected behavior
THEN: Edit the fix
```

### Example 2: Adding a new hook
```
Read .claude/hooks/scripts/observe-pre.js → existing hook pattern
Read .claude/hooks/scripts/parse-stdin.js → stdin parsing
Read .claude/settings.json                → how hooks are wired
THEN: Write the new hook
```

## Relationship to Other Skills
- **search-first** — general principle "research before coding". This skill is the specific pattern: "read 3+ files in clusters"
- **no-context-guard** — enforces Read before Edit at the file level. This skill goes further: read the CONTEXT (multiple files) not just the target

## Detection
The `evaluate-session.js` hook detects this pattern automatically: clusters of 3+ consecutive Read calls in tool sequences. Threshold: >= 3 clusters per session.
