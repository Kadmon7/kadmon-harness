---
name: continuous-learning-v2
description: How the instinct learning system works — observation, confidence scoring (0.3→0.9), promotion to skills. Use this skill whenever working with /instinct subcommands (learn, status, promote, prune), when debugging why an instinct was or wasn't created, understanding the evaluate-session hook, or when the user asks about "instincts", "patterns", "confidence", or "how does the harness learn". Also use when promoting instincts via skill-creator.
---

# Continuous Learning v2

The instinct-based learning system. Observes sessions, creates atomic instincts with confidence scoring, and promotes them into skills.

## When to Use
- Understanding how instincts are created (/instinct learn)
- Checking instinct status (/instinct status)
- Promoting instincts to skills (/instinct promote)
- Diagnosing why an instinct was contradicted

## How It Works

### Observation Flow
1. **observe-pre hook** logs every tool call to JSONL (file append, <50ms)
2. **observe-post hook** logs results
3. **evaluate-session hook** (at Stop) analyzes observations for patterns
4. Patterns become instincts in SQLite via instinct-manager.ts

### Instinct Lifecycle
```
Create (confidence: 0.3, occurrences: 1)
  ↓ reinforced (+0.1 confidence, +1 occurrence)
  ↓ ... repeated ...
Promotable (confidence ≥ 0.7, occurrences ≥ 3, status: active)
  ↓ /instinct promote
Promoted (status: promoted, promotedTo: "skill-name")
```

### Contradiction
```
Active instinct
  ↓ contradicted (+1 contradiction)
  ↓ if contradictions > occurrences
Contradicted (status: contradicted)
  ↓ after 7 days via /instinct prune
Archived (status: archived)
```

### Scoping
- Instincts are project-scoped by default (projectHash from git remote)
- /instinct promote can elevate a project instinct to global scope
- Global instincts apply across all projects

## Examples

### Example 1: Pattern detection
```
Session observations show: Read → Read → Edit pattern 5 times
evaluate-session creates instinct:
  pattern: "Read files before editing them"
  action: "Always Read target file before Edit/Write"
  confidence: 0.3
```

### Example 2: Reinforcement across sessions
```
Session 1: instinct created (0.3)
Session 2: same pattern → reinforced (0.4)
Session 3: same pattern → reinforced (0.5)
Session 4: same pattern → reinforced (0.6)
Session 5: same pattern → reinforced (0.7) — now promotable!
```

## Rules
- Observations are ephemeral JSONL — summarized at session end, not kept forever
- Instincts persist in SQLite across sessions
- Promotion requires architect approval (/instinct promote is manual, not automatic)
- Contradictions are tracked — instincts can die
- All skill creation, editing, and optimization MUST use the skill-creator:skill-creator plugin — it handles drafting, testing, benchmarking, and description optimization

## no_context Application
The learning system only creates instincts from observed behavior — never from assumptions. If a pattern was not observed in the JSONL, it cannot become an instinct.
