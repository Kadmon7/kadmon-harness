---
description: Audit current context window usage and suggest optimizations
---

## Purpose
Analyze what is consuming context window tokens and recommend what to unload.

## Steps
1. Count currently loaded files and their approximate sizes
2. Identify largest context consumers
3. Check if any loaded files are no longer relevant to current task
4. Suggest files to unload or sections to compact
5. Report total estimated usage vs capacity

## Output
Context usage report with recommendations.

## Example
```
Context Usage:
- CLAUDE.md: ~800 tokens
- types.ts: ~600 tokens
- state-store.ts: ~2000 tokens (largest)
- 3 test files: ~1500 tokens

Total: ~5000 tokens (~5% of context)
Recommendation: unload test files if not currently testing
```