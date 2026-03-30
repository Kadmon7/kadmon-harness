---
description: Extract patterns from current session and create instincts
---

## Purpose
Analyze the current session's observations and create or reinforce instincts based on recurring patterns.

## Steps
1. Read observations JSONL for current session from temp directory
2. Identify recurring patterns (e.g., "always reads before editing")
3. For each pattern found:
   - Check if similar instinct already exists
   - If exists: reinforce (increase confidence)
   - If new: create instinct (confidence: 0.3)
4. Show instincts created/updated with confidence scores

## Output
List of instincts with pattern, action, and confidence score.

## Example
```
Instincts updated:
- [0.5] "Read files before editing" → reinforced (+0.1)
- [0.3] "Run tsc after TypeScript edits" → NEW
Total: 1 reinforced, 1 created
```