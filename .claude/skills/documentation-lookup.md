---
name: documentation-lookup
description: Use when needing to verify API signatures, library behavior, or framework conventions
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
- Never trust training data for API signatures — always fetch live docs
- Cite the source in your response
- If docs are ambiguous, flag the ambiguity instead of guessing
- Cache nothing — APIs change between versions

## no_context Application
This skill is the no_context principle applied to API knowledge. Every API detail must be verified against current documentation, not recalled from memory.
