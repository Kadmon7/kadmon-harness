---
name: documentation-lookup
description: Fetch live documentation instead of relying on training data — Context7 MCP primary, WebSearch fallback. Use this skill whenever referencing an API you're not 100% sure about, when the user says "how does X work", "what's the API for", "check the docs", or /docs. Also use when no_context principle requires verification of function signatures, library versions, or framework conventions before writing code that depends on them.
---

# Documentation Lookup

Fetch live documentation instead of relying on training data.

## When to Use
- Before using any library API for the first time
- When unsure about function signatures, parameters, or return types
- When a library has been updated and behavior may have changed
- When writing examples that reference external APIs

## How It Works
1. **Invoke docs-lookup agent** or use /docs command
2. Agent uses Context7 MCP: resolve library → fetch docs for topic
3. If Context7 unavailable: falls back to WebSearch → WebFetch
4. Returns: exact signature, example, and source URL

## Examples

### Example 1: Supabase insert
```
/docs supabase-js insert

Result:
const { data, error } = await supabase.from('sessions').insert({ id: 'abc', project_hash: 'xyz' });
// Returns: { data: Row[] | null, error: PostgrestError | null }
// Source: supabase.com/docs/reference/javascript/insert
```

### Example 2: sql.js prepare
```
/docs sql.js prepare statement

Result:
const stmt = db.prepare("SELECT * FROM instincts WHERE project_hash = ?");
stmt.bind(["abc123"]);
while (stmt.step()) { const row = stmt.getAsObject(); }
stmt.free();
// Source: sql.js documentation
```

## Rules
- MUST use Context7 MCP as primary source — resolve library ID first, then fetch docs
- MUST fall back to WebSearch + WebFetch if Context7 is unavailable or returns empty
- NEVER fall back to training data memory — if both Context7 and WebSearch fail, report `no_context`
- MUST include library version number in lookups when available (e.g., `supabase-js@2.39.0`)
- MUST cite the source URL in every response
- MUST flag deprecated APIs with `[DEPRECATED]` tag and suggest replacement
- MUST verify return type constraints: distinguish null vs undefined, exception vs error return
- NEVER cache documentation results — APIs change between versions, always fetch fresh
- MUST report when docs are ambiguous or contradictory instead of guessing

## no_context Application
This skill is the no_context principle applied to API knowledge. Every API detail must be verified against current documentation, not recalled from memory.
