---
name: search-first
description: Research existing code before writing new code — Grep for implementations, check dependencies, verify APIs. Use this skill whenever about to write a new function, add a dependency, design a new pattern, or implement something unfamiliar. Also use when the no-context-guard hook blocks an edit — it means you skipped the research step. The foundation of the no_context principle: if you haven't searched for it, you might be reinventing the wheel.
---

# Search First

Research before coding. The foundation of the no_context principle.

## When to Use
- Before writing any new function or module
- Before adding a dependency
- Before designing a new pattern
- When asked to implement something unfamiliar

## How It Works
1. **Search the codebase** — Grep/Glob for existing implementations
2. **Search dependencies** — Check if a library already solves this
3. **Search documentation** — Use /docs or docs-lookup agent for API details
4. **Evaluate** — Can you reuse? Adapt? Or must you build new?
5. **Proceed** — Only implement after steps 1-4 complete

## Examples

### Example 1: Adding UUID generation
```
❌ Wrong: import { v4 } from 'uuid';  // adds a dependency
✅ Right: Grep for "uuid" or "generateId" first
   Found: scripts/lib/utils.ts exports generateId() using crypto.randomUUID()
   Result: reuse existing function, no new dependency
```

### Example 2: Adding a database query
```
❌ Wrong: write raw SQL inline
✅ Right: Check scripts/lib/state-store.ts for existing query patterns
   Found: upsertSession, getActiveInstincts patterns
   Result: follow the same pattern (camelCase interface → snake_case SQL)
```

## Rules
- Always search before coding — this is enforced by the no-context-guard hook
- If you find existing code that does 80% of what you need, adapt it
- If no existing solution: document why in a comment
- Never assume a library API — use docs-lookup agent

## no_context Application
This skill IS the no_context methodology. The no-context-guard hook enforces it at the tool level: you cannot Write/Edit a file without having Read files in the same directory first.
