---
alwaysApply: true
---

# Agent Usage Rules

## Orchestration Chain
When a command is invoked, follow the chain defined in its frontmatter:
- `agent:` field → MUST invoke that agent (or agents) by subagent_type name
- `skills:` field → MUST load those skills before/during agent work
- Commands without agent/skills fields → execute steps directly

This chain exists so skills are ACTUALLY USED, not just documented.
If you skip the chain, the user's investment in agents and skills is wasted.

## Skill Loading

Agents declare their skills in YAML frontmatter. Claude Code's native sub-agent loader parses the `skills:` field as a YAML list and **injects the full skill content into the sub-agent's context at spawn** (per [Anthropic docs](https://docs.claude.com/en/docs/claude-code/sub-agents)). Sub-agents do NOT inherit skills from the parent conversation — the frontmatter is the only channel.

**Authoritative syntax — YAML block list**:
```yaml
---
name: kody
skills:
  - coding-standards
  - receiving-code-review
  - git-workflow
---
```

**Anti-pattern — comma-separated scalar** (parses as a single string, loader silently drops it):
```yaml
skills: coding-standards, receiving-code-review, git-workflow   # BROKEN
```

Rules:
- MUST declare every skill used by an agent in its `skills:` frontmatter as a YAML list (see ADR-012)
- MUST quote `description:` fields that contain embedded colons (e.g. `"... Command: /foo. Severity: HIGH."`) — unquoted colons break YAML parsing silently
- MUST read skill files listed in **command** frontmatter when executing the command (commands run in the main session, not a sub-agent — the agent-level injection does not apply)
- MUST use skill-creator:skill-creator plugin for ALL skill work (create, edit, optimize, evaluate). Invoke via Skill tool: `skill: "skill-creator:skill-creator"`. The plugin handles: interview, drafting, test cases, evaluation loop, and description optimization. Never create skill files manually.
- Skills are domain knowledge — agents are the executors that USE that knowledge
- The `rules/common/agents.md` catalog table below lists skills in comma-separated shorthand for human readability; the **authoritative declaration lives in each agent's frontmatter**

## Routing
- MUST use opus model for: arkitect, konstruct, spektr, alchemik
- MUST use sonnet model for: kody, typescript-reviewer, feniks, mekanik, kurator, arkonte, python-reviewer, almanak, kartograf, orakle, kerka
- MUST use opus model for doks (documentation requires critical analysis across 4 layers)
- NEVER use haiku for code review, security analysis, or documentation updates

## Agent Catalog (16)

| Agent | Model | Trigger | Command | Skills |
|-------|-------|---------|---------|--------|
| arkitect | opus | /abra-kdabra with architecture signals | /abra-kdabra | architecture-decision-records, api-design, docker-patterns, hexagonal-architecture |
| konstruct | opus | /abra-kdabra always | /abra-kdabra | architecture-decision-records, eval-harness, codebase-onboarding, council |
| kody | sonnet | /chekpoint | /chekpoint | coding-standards, receiving-code-review, git-workflow, github-ops, regex-vs-llm-structured-text |
| typescript-reviewer | sonnet | Auto on .ts/.tsx/.js/.jsx edits | /chekpoint | coding-standards, frontend-patterns |
| orakle | sonnet | Auto on SQL/schema/migration/Supabase | /chekpoint | database-migrations, postgres-patterns, content-hash-cache-pattern |
| spektr | opus | Auto on auth/keys/input/exec/paths/SQL | /chekpoint | safety-guard, security-review, security-scan |
| feniks | sonnet | /abra-kdabra (if needs_tdd) | /abra-kdabra | tdd-workflow, python-testing, eval-harness, ai-regression-testing |
| mekanik | sonnet | /medik Phase 2 (always), auto on TS/Vitest failures | /medik | systematic-debugging, agent-introspection-debugging |
| kurator | sonnet | /medik Phase 2 (always, parallel with mekanik) | /medik | coding-standards |
| arkonte | sonnet | Auto on O(n^2)/slow queries/memory, /skanner | /skanner, auto-invoke | context-budget, token-budget-advisor, benchmark |
| python-reviewer | sonnet | Auto on .py edits | /chekpoint | python-patterns, python-testing, claude-api |
| almanak | sonnet | /almanak, unfamiliar APIs, no_context | /almanak | mcp-server-patterns, documentation-lookup |
| doks | opus | /doks, after feature/structural commits | /doks | docs-sync, skill-stocktake, rules-distill, code-tour |
| kartograf | sonnet | /skanner (E2E component) | /skanner | e2e-testing |
| alchemik | opus | /evolve only | /evolve | search-first, continuous-learning-v2, skill-stocktake, agent-eval, prompt-optimizer, skill-comply, workspace-surface-audit, cost-aware-llm-pipeline |
| kerka | sonnet | /research, research/investigate/deep-dive intent | /research | deep-research |

## Auto-Invoke (no prompt needed)
- Code touches auth/keys/exec/file paths/SQL → spektr
- Editing .ts/.tsx/.js/.jsx files → typescript-reviewer
- Editing .py files → python-reviewer
- Editing SQL/schema/migration/Supabase client → orakle
- TypeScript compilation or Vitest fails → mekanik
- Performance concerns (O(n^2), slow queries, memory patterns) → arkonte
- /abra-kdabra with architecture signals → arkitect before konstruct
- Encountering unfamiliar external API or library → almanak (via /almanak)
- User asks to research/investigate/deep-dive/compare/analyze topics beyond the current codebase → kerka (via /research)

## Manual Rules
- MUST invoke kody before any commit via /chekpoint
- MUST invoke typescript-reviewer for .ts/.tsx/.js/.jsx file changes
- MUST invoke konstruct via /abra-kdabra — runs for every /abra-kdabra invocation
- MUST invoke arkitect before konstruct when /abra-kdabra task contains architecture signals
- MUST invoke almanak when referencing unfamiliar APIs or when no_context principle requires verification
- MUST invoke mekanik when TypeScript compilation or Vitest tests fail (skip for obvious typos)
- MUST invoke doks after commits that add/remove agents, skills, or commands
- MUST use skill-creator:skill-creator plugin for any skill creation, editing, or evaluation. Invoke: `skill: "skill-creator:skill-creator"`. Never create skill files manually — the plugin handles structure, frontmatter, and description optimization.
- NEVER invoke arkitect for routine bug fixes or small features
- NEVER invoke alchemik without explicit /evolve command
- NEVER invoke kartograf without explicit /skanner command (tests are expensive)
- NEVER invoke kurator without explicit /medik clean command
- MUST invoke kerka via /research for multi-source investigation; NEVER fall back to raw WebSearch when /research is the appropriate entry point

## Parallel Execution
- SHOULD launch independent agents in parallel (single message, multiple tool calls)
- NEVER run agents sequentially when their inputs are independent

### Orchestration Patterns (11 commands)

#### Parallel then Sequential (mixed)
```
/chekpoint  verify → [ts-reviewer, py-reviewer, spektr, orakle] → kody (consolidate) → gate → commit
/skanner    [arkonte (perf), kartograf (e2e)] → report
```

#### Sequential (agents run in order)
```
/abra-kdabra   arkitect (if arch) → konstruct → feniks (if tdd) → kody
/medik    direct (8 checks) → [mekanik, kurator] (parallel analysis) → gate → repair → verify
/doks     doks
/evolve   alchemik
```

#### Direct (no agent orchestration)
```
/kadmon-harness  script execution
/kompact         context compaction
/almanak         almanak (single lookup)
/research        kerka (single researcher, loads deep-research skill)
/forge           unified instinct pipeline (preview gate; /instinct is deprecated alias until 2026-04-20)
```

## Approval Criteria
- CRITICAL → BLOCK merge, fix immediately
- HIGH → WARN, should fix before merge
- MEDIUM/LOW → NOTE, optional

## Communication
- Agents return structured output (markdown with sections)
- MUST include severity levels in reviews (BLOCK/WARN/NOTE or CRITICAL/HIGH/MEDIUM/LOW)
- NEVER let an agent modify code without explicit approval from the user

## Command-Level Skills (no agent owner by design)

Not every skill is owned by an agent. Some skills are loaded directly by commands because the work is deterministic and indirection through an agent adds no value. These are **not** routing bugs — doks and audit tools should treat them as intentional.

| Skill | Loaded by | Why no agent |
|---|---|---|
| `verification-loop` | `/chekpoint` (Phase 1) | Build → typecheck → lint → test is a deterministic sequence. A reviewer agent is already invoked in Phase 2; verification is the command's job. |
| `strategic-compact` | `/kompact` | The compaction-decision matrix is deterministic enough that routing through an agent adds no value. The skill is loaded directly when the user (or another skill) needs the decision guide. |
| `skill-creator:skill-creator` (plugin) | `/evolve` step 6 Generate (PROMOTE proposals only) | Alchemik proposes `SkillSpec` objects in a JSON fence but NEVER invokes the mutator or plugin itself (ADR-008 Q2). The `/evolve` command parses the fence, renders the approval gate, then invokes the skill-creator plugin for PROMOTE proposals or calls `applyEvolveGenerate` for non-skill types. This orchestration lives at command level to keep alchemik pure-analysis and to centralize collision handling. |

When adding new command-level skills, document the rationale here so future audits don't flag them as orphaned.
