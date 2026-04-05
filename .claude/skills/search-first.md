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

## Workflow

```
+---------------------------------------------+
|  1. NEED ANALYSIS                           |
|     What functionality is needed?            |
|     What language/framework constraints?     |
+---------------------------------------------+
            |
            v
+---------------------------------------------+
|  2. PARALLEL SEARCH                         |
|  +---------+ +---------+ +---------+        |
|  |Codebase | |  npm /  | | GitHub/ |        |
|  |Grep/Glob| |  PyPI   | | /docs   |        |
|  +---------+ +---------+ +---------+        |
+---------------------------------------------+
            |
            v
+---------------------------------------------+
|  3. EVALUATE                                |
|     Score: functionality, maintenance,       |
|     community, docs, license, deps           |
+---------------------------------------------+
            |
            v
+---------------------------------------------+
|  4. DECIDE                                  |
|  +-------+ +--------+ +-------+             |
|  | Adopt | | Extend | | Build |             |
|  | as-is | | / Wrap | |Custom |             |
|  +-------+ +--------+ +-------+             |
+---------------------------------------------+
            |
            v
+---------------------------------------------+
|  5. EXPLORE CONTEXT                         |
|     Read 3+ files: types, impl, tests       |
|     Build mental model before acting         |
+---------------------------------------------+
```

## Decision Matrix

| Signal | Action |
|--------|--------|
| Exact match, well-maintained, MIT/Apache | **Adopt** -- install and use directly |
| Partial match, good foundation | **Extend** -- install + write thin wrapper |
| Multiple weak matches | **Compose** -- combine 2-3 small packages |
| Nothing suitable found | **Build** -- write custom, informed by research |

## Search Shortcuts by Category

### Codebase
0. Does this already exist in the repo? `rg` through relevant modules and tests first

### Development Tooling
- Linting: `eslint`, `ruff`
- Formatting: `prettier`, `black`
- Testing: `vitest`, `pytest`
- Pre-commit: `husky`, `lint-staged`

### AI/LLM Integration
- Claude SDK: use /docs (Context7) for latest API
- Prompt management: check MCP servers in settings
- Document processing: `pdfplumber`, `mammoth`

### Data & APIs
- HTTP clients: `httpx` (Python), `ky`/`got` (Node)
- Validation: `zod` (TS), `pydantic` (Python)
- Database: check for MCP servers first (Supabase, etc.)

## Phase 1: Search
Find what already exists.

1. **Search the codebase** -- Grep/Glob for existing implementations
2. **Search dependencies** -- Check if a library already solves this
3. **Search documentation** -- Use /docs for API details
4. **Evaluate** -- Can you reuse? Adapt? Or must you build new?

## Phase 2: Explore
Build a mental model before touching code.

1. **Identify the cluster** -- which files are related? Types, implementation, persistence, tests
2. **Read 3+ files** consecutively before switching to Edit, Bash, or Write
3. **Build context** -- understand interfaces, dependencies, data flow, naming patterns
4. **Then act** -- your edit will fit naturally because you see how pieces connect

The key insight: reading one file tells you WHAT a function does, but reading its neighbors tells you WHY it does it that way and WHAT depends on it.

## Phase 3: Act
Only implement after Phase 1 and Phase 2 are complete.

## Examples

### Example 1: Adding UUID generation
```
Phase 1 (Search): Grep for "uuid" or "generateId"
   Found: scripts/lib/utils.ts exports generateId() using crypto.randomUUID()
   Result: ADOPT -- reuse existing function, no new dependency
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

## Anti-Patterns

| Anti-Pattern | Why It Fails |
|---|---|
| Jumping to code | Writing a utility without checking if one exists -- reinvents the wheel |
| Ignoring MCP | Not checking if an MCP server already provides the capability |
| Over-customizing | Wrapping a library so heavily it loses its benefits |
| Dependency bloat | Installing a massive package for one small feature |
| Reading one file only | You see WHAT but miss WHY -- neighbors carry the context |

## Gotchas
- The no-context-guard hook enforces this at the tool level: you cannot Write/Edit a file without having Read files in the same directory first. If the hook blocks you, it means you skipped the research step.
- `session-end-all.js` (pattern evaluation phase) tracks "Search before writing new code" and "Explore multiple files before taking action" patterns. These feed into instinct scoring.
- When adopting a dependency, check its last publish date and open issues. A well-maintained library saves time; an abandoned one creates tech debt.

## Automatic Detection
The `session-end-all.js` hook (pattern evaluation phase) tracks two patterns:
- "Search before writing new code" -- Grep/Glob before Edit/Write
- "Explore multiple files before taking action" -- clusters of 3+ consecutive Read calls

## Rules
- Always search before coding -- enforced by the no-context-guard hook
- If you find existing code that does 80% of what you need, adapt it
- If no existing solution: document why in a comment
- Never assume a library API -- use /docs to verify
- Read the target file AND its neighbors before editing

## no_context Application
This skill IS the no_context methodology. The no-context-guard hook enforces it at the tool level: you cannot Write/Edit a file without having Read files in the same directory first.
