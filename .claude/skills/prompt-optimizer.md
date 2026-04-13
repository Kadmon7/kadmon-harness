---
name: prompt-optimizer
description: Analyze raw prompts, identify intent and gaps, match harness components (skills/commands/agents), and output a ready-to-paste optimized prompt. Advisory only — never executes the task itself. Use this skill whenever the user says "optimize this prompt", "improve my prompt", "rewrite this prompt", "how should I ask Claude to", "help me prompt", "what's the best way to request X", "ECC prompt", or pastes a draft prompt asking for feedback. Do NOT use when the user wants direct execution ("just do it"), when the user says "optimize this code" / "optimize performance" (those are refactor/perf tasks, not prompt work), or when the user is configuring the harness itself.
---

# Prompt Optimizer

Analyze a draft prompt, critique it, match it to Kadmon Harness components, and output a complete optimized prompt the user can paste and run. **Advisory only — do not execute the underlying task.**

## When to Use

- User says "optimize this prompt", "improve my prompt", "rewrite this prompt"
- User says "what's the best way to ask Claude Code to X"
- User pastes a draft prompt and asks for feedback or enhancement
- User asks "how should I structure this request"

### Do Not Use When

- User wants the task done directly ("just do it")
- User says "optimize this code" or "optimize performance" — those are refactor/perf tasks
- User is configuring the harness itself (settings.json, hooks)
- User wants a skill inventory — use `skill-stocktake` instead

## Operating Rule

**Advisory only.** Do NOT write code, create files, run commands, or take any implementation action. The only output is an analysis plus an optimized prompt. If the user says "just do it, don't optimize", tell them this skill produces optimized prompts and they should make a normal task request for execution.

## 6-Phase Analysis Pipeline

### Phase 0 — Project Detection

Before analyzing the prompt, detect the current project context:

1. Check for `CLAUDE.md` in the working directory — read it for project conventions
2. Detect tech stack from project files:
   - `package.json` → Node.js / TypeScript / React / Next.js
   - `pyproject.toml` / `requirements.txt` → Python
   - `tsconfig.json` → TypeScript project
   - `supabase/` → Supabase project (RLS, migrations, pgvector)
3. Note detected stack for use in Phases 3-4

If no project files found, flag "tech stack unknown" and ask the user to specify.

### Phase 1 — Intent Detection

Classify the user's task into one or more categories:

| Category | Signal Words | Example |
|---|---|---|
| New Feature | build, create, add, implement | "Build a login page" |
| Bug Fix | fix, broken, not working, error | "Fix the auth flow" |
| Refactor | refactor, clean up, restructure | "Refactor the API layer" |
| Research | how to, what is, explore, investigate | "How to add SSO" |
| Testing | test, coverage, verify | "Add tests for the cart" |
| Review | review, audit, check | "Review my PR" |
| Documentation | document, update docs | "Update the API docs" |
| Infrastructure | deploy, CI, docker, database | "Set up CI/CD" |
| Design | design, architecture, plan | "Design the data model" |

### Phase 2 — Scope Assessment

| Scope | Heuristic | Orchestration |
|---|---|---|
| TRIVIAL | Single file, <50 lines | Direct execution |
| LOW | Single component or module | Single command or skill |
| MEDIUM | Multiple components, same domain | /abra-kdabra + /chekpoint |
| HIGH | Cross-domain, 5+ files | /abra-kdabra with arkitect (Route A) |
| EPIC | Multi-session, multi-PR, architectural shift | /abra-kdabra Route A + phased plans |

### Phase 3 — Harness Component Matching

Map intent + scope + tech stack to specific Kadmon components.

#### By Intent Type

| Intent | Commands | Skills | Agents |
|---|---|---|---|
| New Feature | /abra-kdabra, /chekpoint | tdd-workflow, verification-loop, eval-harness | arkitect (if arch signals), konstruct, feniks, kody |
| Bug Fix | /medik, /chekpoint | systematic-debugging, tdd-workflow | mekanik, feniks |
| Refactor | /medik clean, /chekpoint | coding-standards, verification-loop | kurator, kody |
| Research | /almanak, /abra-kdabra | search-first, deep-research | almanak |
| Testing | /abra-kdabra (TDD), /chekpoint | tdd-workflow, e2e-testing, eval-harness | feniks, kartograf |
| Review | /chekpoint | coding-standards, receiving-code-review | kody + specialists |
| Documentation | /doks, /chekpoint | docs-sync | doks |
| Infrastructure | /abra-kdabra, /medik | database-migrations, api-design | arkitect, orakle, spektr |
| Design | /abra-kdabra (Route A) | architecture-decision-records, api-design | arkitect + konstruct |

#### By Tech Stack

| Tech | Skills | Reviewer Agent |
|---|---|---|
| TypeScript / React | coding-standards, frontend-patterns, tdd-workflow | typescript-reviewer, kody |
| Python | python-patterns, python-testing | python-reviewer |
| Supabase / PostgreSQL | postgres-patterns, database-migrations | orakle |
| Security-sensitive | safety-guard | spektr |

### Phase 4 — Missing Context Detection

Scan the prompt for missing critical information:

- [ ] **Tech stack** — detected in Phase 0, or must user specify?
- [ ] **Target scope** — files, directories, or modules mentioned?
- [ ] **Acceptance criteria** — how to know the task is done?
- [ ] **Error handling** — edge cases and failure modes addressed?
- [ ] **Security requirements** — auth, input validation, secrets?
- [ ] **Testing expectations** — unit, integration, E2E?
- [ ] **Existing patterns** — reference files or conventions to follow?
- [ ] **Scope boundaries** — what NOT to do?

**If 3+ critical items are missing**, ask the user up to 3 clarification questions before generating the optimized prompt. Incorporate the answers.

### Phase 5 — Workflow & Model Recommendation

Default workflow stages: **Research → Plan → Implement (TDD) → Review → Verify → Commit**

For MEDIUM+ tasks, always start with `/abra-kdabra`. For EPIC, run arkitect first (Route A with architecture signals).

| Scope | Recommended Model |
|---|---|
| TRIVIAL-LOW | Sonnet 4.6 (fast, cost-efficient) |
| MEDIUM | Sonnet 4.6 (standard coding) |
| HIGH | Opus 4.6 for arkitect/konstruct planning, Sonnet 4.6 for execution |
| EPIC | Opus 4.6 for planning phases, Sonnet 4.6 for each execution phase |

## Output Format

Present analysis in this exact structure:

### Section 1 — Prompt Diagnosis
**Strengths**: what the original prompt does well.
**Issues**: table with `Issue | Impact | Suggested Fix`.
**Needs Clarification**: numbered questions the user should answer (if Phase 0 auto-detected, state the answer instead of asking).

### Section 2 — Recommended Harness Components
Table with `Type | Component | Purpose` covering commands, skills, agents, and model.

### Section 3 — Optimized Prompt (Full Version)
Complete optimized prompt inside a single fenced code block. Must be self-contained and ready to copy-paste. Include:
- Clear task description with context
- Tech stack (detected or specified)
- `/command` invocations at the right workflow stages
- Acceptance criteria
- Verification steps
- Scope boundaries (what NOT to do)

### Section 4 — Optimized Prompt (Quick Version)
Compact one-liner for experienced users. Patterns by intent:

| Intent | Quick Pattern |
|---|---|
| New Feature | `/abra-kdabra [feature]. Implement with TDD. /chekpoint.` |
| Bug Fix | `/abra-kdabra — write failing test for [bug]. Fix to green. /chekpoint.` |
| Refactor | `/medik clean [scope]. /chekpoint.` |
| Research | `/almanak [topic]. Then /abra-kdabra based on findings.` |
| Review | `/chekpoint full` |
| Docs | `/doks` |

### Section 5 — Enhancement Rationale
Table with `Enhancement | Reason` explaining what was added and why.

### Footer
> Not what you need? Tell me what to adjust, or make a normal task request if you want execution instead of prompt optimization.

## Integration

- **alchemik agent** (opus) — primary owner. alchemik uses this skill when `/evolve` wants to improve how the user phrases requests to the harness, or when auditing how well the harness's commands surface through natural language.
- **/evolve command** — entry point for harness self-improvement, including prompt quality.
- **Related skills**: `skill-stocktake` (audit skill inventory), `search-first` (research phase in optimized prompts), `strategic-compact` (long session context advice).

## no_context Application

Prompt optimization must rest on actual project state, not assumptions. Phase 0 (project detection) is mandatory because recommending `/abra-kdabra` to a user without a TypeScript project wastes their time. When the tech stack cannot be detected, the correct response is to ask — not to guess. The optimized prompt must reference real harness components (commands, skills, agents that exist in `.claude/`), never invented ones. If a recommendation cites a command or skill, it must be reachable from the current harness.
