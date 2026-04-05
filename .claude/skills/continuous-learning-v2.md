---
name: continuous-learning-v2
description: How the instinct learning system works — observation, confidence scoring (0.3->0.9), promotion to skills. Use this skill whenever working with /instinct subcommands (learn, status, eval, promote, prune, export), when debugging why an instinct was or wasn't created, understanding the pattern evaluation in session-end-all, or when the user asks about "instincts", "patterns", "confidence", or "how does the harness learn". Also use when promoting instincts via skill-creator.
---

# Continuous Learning v2

The instinct-based learning system. Observes sessions, creates atomic instincts with confidence scoring, and promotes proven patterns into permanent skills. The system learns from real behavior — never from assumptions.

## When to Use
- Understanding how instincts are created (/instinct learn)
- Checking instinct status (/instinct status, /instinct eval)
- Promoting instincts to skills (/instinct promote)
- Diagnosing why an instinct was contradicted or not created
- Planning which instincts to keep project-scoped vs promote globally
- Connecting instinct quality to /evolve analysis

## How It Works

### Observation Flow
1. **observe-pre hook** logs every tool call to JSONL (file append, <50ms); captures Agent, TaskCreate, and TaskUpdate metadata
2. **observe-post hook** logs tool results to the same JSONL; captures error messages on failures
3. **session-end-all hook (pattern evaluation phase)** (at Stop) analyzes observations against 13 pattern definitions in `.claude/hooks/pattern-definitions.json`
4. Matched patterns become instincts in SQLite via instinct-manager.ts

The session-end-all hook (pattern evaluation phase) is the brain of the system. It reads observation logs, matches them against pattern definitions (sequence patterns, cluster patterns, command sequences), and creates or reinforces instincts. Without it, no learning happens — and it only fires on clean session termination.

### Instinct Lifecycle
```
Create (confidence: 0.3, occurrences: 1)
  | reinforced (+0.1 confidence, +1 occurrence)
  | ... repeated across sessions ...
Promotable (confidence >= 0.7, occurrences >= 3, status: active)
  | /instinct promote
Promoted (status: promoted, promotedTo: "skill-name")
```

### Contradiction
```
Active instinct
  | contradicted (+1 contradiction)
  | if contradictions > occurrences
Contradicted (status: contradicted)
  | after 7 days via /instinct prune
Archived (status: archived)
```

### Scoping
- Instincts are **project-scoped** by default (projectHash derived from git remote)
- /instinct promote can elevate a project instinct to **global scope**
- Global instincts apply across all projects (harness, ToratNetz, KAIRON, future projects)
- Keep instincts project-scoped when they reflect project-specific conventions (e.g., "use sql.js for Kadmon Harness")
- Promote to global when the pattern is universally good practice (e.g., "read before edit", "verify before commit")

## Promotion Workflow
When an instinct reaches promotable status (confidence >= 0.7, occurrences >= 3):

1. Run `/instinct eval` to see which instincts are ready
2. Run `/instinct promote` and select the candidate
3. The skill-creator:skill-creator plugin is invoked automatically — it drafts the skill, optimizes the description, and validates structure
4. Review the generated skill file in `.claude/skills/`
5. The instinct is marked `status: promoted` with `promotedTo` pointing to the new skill name
6. The promoted instinct stops being reinforced — the skill now carries the knowledge permanently

MUST use the skill-creator:skill-creator plugin for all promotion. Direct file creation bypasses description optimization and structural validation.

## Examples

### Example 1: Pattern detection
```
Session observations show: Read -> Read -> Edit pattern 5 times
session-end-all (pattern evaluation phase) matches "Read files before editing them" (sequence pattern)
Creates instinct:
  pattern: "Read files before editing them"
  action: "Always Read target file before Edit/Write"
  confidence: 0.3
```

### Example 2: Reinforcement across sessions
```
Session 1: instinct created (0.3)
Session 2: same pattern observed -> reinforced (0.4)
Session 3: same pattern observed -> reinforced (0.5)
Session 4: same pattern observed -> reinforced (0.6)
Session 5: same pattern observed -> reinforced (0.7) — now promotable
```

### Example 3: Contradiction
```
Session 6: instinct says "always lint before tests"
Session 7: user skips lint, tests pass fine -> contradiction recorded
Session 8: skipped again -> contradictions (2) > occurrences (1) -> status: contradicted
After 7 days: /instinct prune archives it
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Pattern not detected | No matching definition in pattern-definitions.json | Check the 13 patterns in `.claude/hooks/pattern-definitions.json`. If your pattern type is not there, add a new definition. |
| Confidence dropped | Contradictions observed | Run `/instinct eval` to see contradiction counts. If the pattern is genuinely wrong, let it die. If it was a one-off, it will recover. |
| Instinct not created after session | Stop hooks did not fire | Stop hooks only fire on clean termination. Crashes, terminal close, and /kompact do NOT trigger them. End sessions cleanly. |
| session-end-all (pattern evaluation) throws errors | dist/ is stale | Run `npm run build` — lifecycle hooks import from compiled dist/. |
| Instinct stuck at low confidence | Pattern occurs rarely | The pattern needs to appear in multiple sessions. One session with 10 occurrences is still just 1 reinforcement. |

## Integration
- **/instinct** command — 6 subcommands: status (default), eval, learn, promote, prune, export
- **session-end-all** hook (pattern evaluation phase) — fires at Stop, analyzes observations against pattern-definitions.json
- **observe-pre / observe-post** hooks — log tool calls, results, errors, and task metadata to JSONL for session-end-all to analyze
- **pattern-definitions.json** — 13 pattern definitions (sequence, cluster, command_sequence types) that session-end-all (pattern evaluation phase) matches against
- **/evolve** command — alchemik agent also analyzes instinct quality, contradiction rates, and promotion candidates as part of its holistic harness review
- **session-start** hook — loads 3 recent sessions with history trajectory, pending work carry-forward, and active instincts at session start
- **skill-creator:skill-creator** plugin — required for /instinct promote (handles skill drafting and validation)

## Rules
- Observations are ephemeral JSONL — summarized at session end, not kept forever
- Instincts persist in SQLite across sessions
- Promotion requires user approval (/instinct promote is manual, never automatic)
- Contradictions are tracked — instincts can and should die when they are wrong
- All skill creation from instincts MUST use the skill-creator:skill-creator plugin
- End sessions cleanly to ensure session-end-all fires and patterns are captured

## no_context Application
The learning system only creates instincts from observed behavior — never from assumptions. If a pattern was not observed in the JSONL, it cannot become an instinct. This is the no_context principle applied to the learning system itself: no evidence, no instinct.
