---
name: continuous-learning-v2
description: How the instinct learning system works — observation, confidence scoring (0.3->0.9), promotion to skills. Use this skill whenever working with /forge (unified preview-gated pipeline: detect, reinforce, promote, prune, export), when debugging why an instinct was or wasn't created, understanding the pattern evaluation in session-end-all, or when the user asks about "instincts", "patterns", "confidence", or "how does the harness learn". Also use when promoting instincts via skill-creator.
---

# Continuous Learning v2

The instinct-based learning system. Observes sessions, creates atomic instincts with confidence scoring, and promotes proven patterns into permanent skills. The system learns from real behavior — never from assumptions.

## When to Use
- Understanding how instincts are created (/forge pipeline — learn phase)
- Checking instinct status (/forge --dry-run)
- Promoting instincts to skills (/forge pipeline — promote phase)
- Diagnosing why an instinct was contradicted or not created
- Planning which instincts to keep project-scoped vs promote globally
- Connecting instinct quality to /evolve analysis

## How It Works

### Observation Flow
1. **observe-pre hook** logs every tool call to JSONL (file append, <50ms); captures Agent, TaskCreate, and TaskUpdate metadata
2. **observe-post hook** logs tool results to the same JSONL; captures error messages on failures
3. **session-end-all hook (pattern evaluation phase)** (at Stop) analyzes observations against 12 pattern definitions in `.claude/hooks/pattern-definitions.json`
4. Matched patterns become instincts in SQLite via instinct-manager.ts

The session-end-all hook (pattern evaluation phase) is the brain of the system. It reads observation logs, matches them against pattern definitions (file_sequence, tool_arg_presence, cluster, and the legacy sequence/command_sequence types), and creates or reinforces instincts. Without it, no learning happens — and it only fires on clean session termination.

### Why Hooks, Not Skills?

Skills fire probabilistically (~50-80% based on Claude's judgment). Hooks fire 100% of the time, deterministically. This means every tool call is observed, no patterns are missed, and learning is comprehensive. This is why v2 moved observation from skills (v1) to hooks.

### Instinct Lifecycle
```
Create (confidence: 0.3, occurrences: 1)
  | reinforced (+0.1 confidence, +1 occurrence)
  | ... repeated across sessions ...
Promotable (confidence >= 0.7, occurrences >= 3, status: active)
  | /forge (promote phase, approved via gate)
Promoted (status: promoted, promotedTo: "skill-name")
```

### Contradiction
```
Active instinct
  | contradicted (+1 contradiction)
  | if contradictions > occurrences
Contradicted (status: contradicted)
  | after 7 days via /forge (prune phase)
Archived (status: archived)
```

### Confidence Scoring

| Score | Meaning | Behavior |
|-------|---------|----------|
| 0.3 | Tentative | Suggested but not enforced |
| 0.5 | Moderate | Applied when relevant |
| 0.7 | Strong | Promotable, auto-approved for application |
| 0.9 | Near-certain | Core behavior |

**Confidence increases** when:
- Pattern is repeatedly observed across sessions
- User doesn't correct the suggested behavior
- Similar instincts from other sources agree

**Confidence decreases** when:
- User explicitly corrects the behavior
- Pattern isn't observed for extended periods
- Contradicting evidence appears

### Scope Decision Guide

Instincts are **project-scoped** by default (projectHash derived from git remote). Promote to global when the pattern is universally good practice.

| Pattern Type | Scope | Examples |
|-------------|-------|---------|
| Language/framework conventions | **project** | "Use React hooks", "Follow Django patterns" |
| File structure preferences | **project** | "Tests in tests/", "Components in src/components/" |
| Code style choices | **project** | "Use functional style", "Prefer dataclasses" |
| Error handling strategies | **project** | "Use Result type for errors" |
| Security practices | **global** | "Validate user input", "Sanitize SQL" |
| General best practices | **global** | "Write tests first", "Always handle errors" |
| Tool workflow preferences | **global** | "Grep before Edit", "Read before Write" |
| Git practices | **global** | "Conventional commits", "Small focused commits" |

## Promotion Workflow
When an instinct reaches promotable status (confidence >= 0.7, occurrences >= 3):

1. Run `/forge --dry-run` to see which instincts are ready (preview gate shows `would.promote[]`)
2. Run `/forge` and approve the gate — the pipeline applies reinforce/promote/prune in one pass
3. The skill-creator:skill-creator plugin is invoked automatically for each promoted candidate — it drafts the skill, optimizes the description, and validates structure
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
Session 5: same pattern observed -> reinforced (0.7) -- now promotable
```

### Example 3: Contradiction
```
Session 6: instinct says "always lint before tests"
Session 7: user skips lint, tests pass fine -> contradiction recorded
Session 8: skipped again -> contradictions (2) > occurrences (1) -> status: contradicted
After 7 days: /forge prunes it (prune phase, gated)
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Pattern not detected | No matching definition in pattern-definitions.json | Check the 12 patterns. If your pattern type is not there, add a new definition. |
| Confidence dropped | Contradictions observed | Run `/forge --dry-run` to see contradiction counts in the preview. If genuinely wrong, let it die. |
| Instinct not created after session | Stop hooks did not fire | Stop hooks only fire on clean termination. Crashes, terminal close, and /kompact do NOT trigger them. |
| session-end-all throws errors | dist/ is stale | Run `npm run build` -- lifecycle hooks import from compiled dist/. |
| Instinct stuck at low confidence | Pattern occurs rarely | Needs to appear in multiple sessions. One session with 10 occurrences is still just 1 reinforcement. |

## Privacy
- Observations stay **local** on your machine
- Project-scoped instincts are isolated per project
- Only **instincts** (patterns) can be exported -- not raw observations
- No actual code or conversation content is shared
- You control what gets exported and promoted

## Gotchas
- One session with 10 occurrences of a pattern is still just 1 reinforcement. Confidence grows across sessions, not within a single session.
- Stop hooks only fire on clean termination. If you close the terminal or Claude Code crashes, session-end-all never runs and patterns are lost.
- `npm run build` must be run before lifecycle hooks work -- they import from `dist/`, not `scripts/lib/` directly.
- Pattern-definitions.json has 12 definitions (ADR-006 domain rewrite, 2026-04-13). If you expect a pattern to be detected but it isn't, the definition might not cover that specific sequence type.

## Integration
- **/forge** command -- unified pipeline with preview gate (Read → Extract → Reinforce/Create → Evaluate → Cluster → Gate → Apply → Report). Flags: `--dry-run` (no mutation), `export` (cross-project scaffold). See ADR-005 and `scripts/lib/forge-pipeline.ts`.
- **session-end-all** hook (pattern evaluation phase) -- fires at Stop, analyzes observations against pattern-definitions.json
- **observe-pre / observe-post** hooks -- log tool calls and results to JSONL
- **pattern-definitions.json** -- 12 pattern definitions (10 file_sequence + 1 tool_arg_presence + 1 cluster; ADR-006). `file_sequence` follow-up matching is dual-surface: it checks both `Bash.metadata.command` and `Skill.metadata.skillName`, because slash commands like `/doks`, `/forge`, `/almanak` are Skill tool calls, not Bash.
- **/evolve** command -- alchemik agent analyzes instinct quality, contradiction rates, and promotion candidates. Step 6 "Generate" (EXPERIMENTAL through 2026-04-28, shipped 2026-04-14 via ADR-008) consumes `ClusterReport` JSON from `~/.kadmon/forge-reports/` written by /forge: alchemik proposes `GenerateProposal[]`, the `/evolve` command parses the fence, renders a preview gate, and on approval invokes `skill-creator:skill-creator` for PROMOTE proposals or `applyEvolveGenerate` for CREATE_COMMAND/CREATE_AGENT/CREATE_RULE. CreateHook is deferred to Sprint B.1; OPTIMIZE stays report-only. Reports are filtered by `projectHash` and merged over a 7-day window (`KADMON_EVOLVE_WINDOW_DAYS`).
- **session-start** hook -- loads 3 recent sessions with history trajectory and active instincts
- **skill-creator:skill-creator** plugin -- required for any skill generation from promoted instincts

## Rules
- Observations are ephemeral JSONL -- summarized at session end, not kept forever
- Instincts persist in SQLite across sessions
- Promotion requires user approval (/forge always gates before mutation — never automatic)
- Contradictions are tracked -- instincts can and should die when they are wrong
- All skill creation from instincts MUST use the skill-creator:skill-creator plugin
- End sessions cleanly to ensure session-end-all fires and patterns are captured

## no_context Application
The learning system only creates instincts from observed behavior — never from assumptions. If a pattern was not observed in the JSONL, it cannot become an instinct. This is the no_context principle applied to the learning system itself: no evidence, no instinct.
