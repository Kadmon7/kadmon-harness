---
description: Look up live documentation for any library or framework
---

## Purpose
Fetch current API documentation via Context7 MCP instead of relying on training data.

## Arguments
- `<library> <topic>` — look up specific API (e.g., `/docs vitest mock function`)
- `<library>` — browse library documentation (e.g., `/docs sql-js`)

## Steps
1. Invoke docs-lookup agent with the query
2. Agent resolves library ID via Context7
3. Agent fetches documentation for the specific topic
4. If Context7 unavailable: fallback to WebSearch
5. Return: exact API signature + working example + source URL

## Output
API signature, minimal example, and documentation source.

## Example
```
User: /docs vitest mock function

Result:
vi.fn() — creates a mock function
const mock = vi.fn((x: number) => x * 2);
mock(5); // 10
expect(mock).toHaveBeenCalledWith(5);
Source: vitest.dev/api/vi#vi-fn
```