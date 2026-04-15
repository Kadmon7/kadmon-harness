---
name: codebase-onboarding
description: Analyze an unfamiliar codebase and generate a structured onboarding guide — architecture map, key entry points, conventions, and a starter `CLAUDE.md`. Use this skill whenever joining a new project, setting up Claude Code in an existing repo for the first time, being asked to "understand this codebase", "walk me through this repo", "onboard me", "generate a CLAUDE.md", or "help me get productive here". Systematic 4-phase workflow: reconnaissance → architecture map → convention detection → onboarding artifacts. Do not read every file — use Grep/Glob for signals, Read only for ambiguous cases.
---

# Codebase Onboarding

Systematically analyze an unfamiliar codebase and produce a structured onboarding guide. Designed for developers joining a new project or setting up the harness in an existing repo for the first time.

## When to Use

- First time opening a project with Claude Code
- Joining a new team or repository
- User asks "help me understand this codebase"
- User asks to generate a `CLAUDE.md` for a project
- User says "onboard me" or "walk me through this repo"
- Bootstrapping the harness into a repo that doesn't yet have `.claude/`

## 4-Phase Workflow

### Phase 1 — Reconnaissance

Gather raw signals about the project **without reading every file**. Run these checks in parallel:

```
1. Package manifest detection
   → package.json, go.mod, Cargo.toml, pyproject.toml, pom.xml, build.gradle,
     Gemfile, composer.json, mix.exs, pubspec.yaml

2. Framework fingerprinting
   → next.config.*, nuxt.config.*, vite.config.*, angular.json,
     django settings, flask app factory, fastapi main, rails config

3. Entry point identification
   → main.*, index.*, app.*, server.*, cmd/, src/main/

4. Directory structure snapshot
   → Top 2 levels of the directory tree, ignoring node_modules, vendor,
     .git, dist, build, __pycache__, .next

5. Config and tooling detection
   → .eslintrc*, .prettierrc*, tsconfig.json, Makefile, Dockerfile,
     docker-compose*, .github/workflows/, .env.example, CI configs

6. Test structure detection
   → tests/, test/, __tests__/, *_test.go, *.spec.ts, *.test.js,
     pytest.ini, jest.config.*, vitest.config.*
```

**Rule**: reconnaissance uses Glob and Grep, not Read on every file. Read selectively only for ambiguous signals.

### Phase 2 — Architecture Mapping

From the reconnaissance data, identify:

**Tech Stack**
- Language(s) and version constraints
- Framework(s) and major libraries
- Database(s) and ORMs
- Build tools and bundlers
- CI/CD platform

**Architecture Pattern**
- Monolith, monorepo, microservices, or serverless
- Frontend/backend split or full-stack
- API style: REST, GraphQL, gRPC, tRPC

**Key Directories**
Map top-level directories to their purpose. Example for a React project:

```
src/components/  → React UI components
src/api/         → API route handlers
src/lib/         → Shared utilities
src/db/          → Database models and migrations
tests/           → Test suites
scripts/         → Build and deployment scripts
```

**Data Flow**
Trace one request from entry to response:
- Where does a request **enter**? (router, handler, controller)
- How is it **validated**? (middleware, schemas, guards)
- Where is **business logic**? (services, models, use cases)
- How does it reach the **database**? (ORM, raw queries, repositories)

### Phase 3 — Convention Detection

Identify patterns the codebase already follows:

**Naming Conventions**
- File naming: kebab-case, camelCase, PascalCase, snake_case
- Component/class naming patterns
- Test file naming: `*.test.ts`, `*.spec.ts`, `*_test.go`

**Code Patterns**
- Error handling style: try/catch, Result types, error codes
- Dependency injection or direct imports
- State management approach
- Async patterns: callbacks, promises, async/await, channels

**Git Conventions**
- Branch naming from recent branches (`git branch -a`)
- Commit message style from recent commits (`git log --oneline -20`)
- PR workflow (squash, merge, rebase)
- If the repo has a shallow history (e.g., `git clone --depth 1`), skip this section and note "Git history unavailable or too shallow to detect conventions"

### Phase 4 — Generate Onboarding Artifacts

Produce two outputs:

#### Output 1: Onboarding Guide

```markdown
# Onboarding Guide: [Project Name]

## Overview
[2-3 sentences: what this project does and who it serves]

## Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.x |
| Framework | Next.js | 14.x |
| Database | PostgreSQL | 16 |
| ORM | Prisma | 5.x |
| Testing | Vitest + Playwright | - |

## Architecture
[Diagram or description of how components connect]

## Key Entry Points
- **API routes**: `src/app/api/` — Next.js route handlers
- **UI pages**: `src/app/(dashboard)/` — authenticated pages
- **Database**: `prisma/schema.prisma` — data model source of truth
- **Config**: `next.config.ts` — build and runtime config

## Directory Map
[Top-level directory → purpose mapping]

## Request Lifecycle
[Trace one API request from entry to response]

## Conventions
- [File naming pattern]
- [Error handling approach]
- [Testing patterns]
- [Git workflow]

## Common Tasks
- **Run dev server**: `npm run dev`
- **Run tests**: `npx vitest run`
- **Run linter**: `npm run lint`
- **Database migrations**: `npx prisma migrate dev`
- **Build for production**: `npm run build`

## Where to Look
| I want to... | Look at... |
|---|---|
| Add an API endpoint | `src/app/api/` |
| Add a UI page | `src/app/(dashboard)/` |
| Add a database table | `prisma/schema.prisma` |
| Add a test | `tests/` matching the source path |
| Change build config | `next.config.ts` |
```

#### Output 2: Starter CLAUDE.md

Generate or update a project-specific `CLAUDE.md` based on detected conventions. If `CLAUDE.md` already exists, **read it first and enhance it** — preserve existing project-specific instructions and clearly call out what was added or changed.

```markdown
# Project Instructions

## Tech Stack
[Detected stack summary]

## Code Style
- [Detected naming conventions]
- [Detected patterns to follow]

## Testing
- Run tests: `[detected test command]`
- Test pattern: [detected test file convention]
- Coverage: [if configured, the coverage command]

## Build & Run
- Dev: `[detected dev command]`
- Build: `[detected build command]`
- Lint: `[detected lint command]`

## Project Structure
[Key directory → purpose map]

## Conventions
- [Commit style if detectable]
- [PR workflow if detectable]
- [Error handling patterns]
```

## Best Practices

1. **Don't read everything** — reconnaissance uses Glob and Grep. Read selectively.
2. **Verify, don't guess** — if a framework is detected from config but the actual code uses something different, trust the code.
3. **Respect existing CLAUDE.md** — if one already exists, enhance it rather than replacing it. Call out what's new vs existing.
4. **Stay concise** — the onboarding guide should be scannable in 2 minutes. Details belong in the code, not the guide.
5. **Flag unknowns** — if a convention cannot be confidently detected, say so rather than guessing. "Could not determine test runner" is better than a wrong answer.

## Anti-Patterns to Avoid

- Generating a `CLAUDE.md` longer than 100 lines — keep it focused
- Listing every dependency — highlight only the ones that shape how you write code
- Describing obvious directory names — `src/` doesn't need an explanation
- Copying the README — the onboarding guide adds **structural insight** the README lacks

## Examples

### Example 1: First time in a new repo
**User**: "Onboard me to this codebase"
**Action**: Run full 4-phase workflow → produce Onboarding Guide + Starter CLAUDE.md
**Output**: Onboarding Guide printed to the conversation, plus a `CLAUDE.md` written to the project root

### Example 2: Generate CLAUDE.md for existing project
**User**: "Generate a CLAUDE.md for this project"
**Action**: Run Phases 1-3, skip the Onboarding Guide, produce only `CLAUDE.md`
**Output**: Project-specific `CLAUDE.md` with detected conventions

### Example 3: Enhance existing CLAUDE.md
**User**: "Update the CLAUDE.md with current project conventions"
**Action**: Read existing `CLAUDE.md`, run Phases 1-3, merge new findings
**Output**: Updated `CLAUDE.md` with additions clearly marked

## Integration

- **konstruct agent** (opus) — primary owner. konstruct plans implementation in unfamiliar codebases; this skill gives it the initial map to plan against. When invoked via `/abra-kdabra` on a new project, konstruct runs codebase-onboarding first, then proceeds to planning with the full architecture context.
- **/abra-kdabra command** — natural entry point when the user says "help me plan something in this new repo".
- **arkitect agent** (opus) — secondary. arkitect uses the architecture map from Phase 2 as the starting state for any ADR about the project.
- **Related skills**: `workspace-surface-audit` answers "what can this environment do"; `codebase-onboarding` answers "how does this repo work". Both are Phase 0 skills for bootstrap work — run them together when starting on a fresh repo.
- **search-first skill** — complementary. `search-first` is for searching within a repo you already understand; `codebase-onboarding` is the first pass that builds that understanding.

## no_context Application

The onboarding guide must reflect what the repo **actually** is, not what the generator thinks a typical Node/Python project looks like. Every claim in the guide — "this is a monolith", "this uses Prisma", "tests live in `tests/`" — must be traceable to a file the agent actually read. When a convention cannot be confidently detected, the correct response is to flag the unknown, not to default to a guess. A guide that says "could not determine test runner" is evidence-based; a guide that says "Jest (probably)" is noise. The `no_context` principle applies especially here because the onboarding guide is the foundation for every later decision in the repo — if it is wrong, everything downstream inherits the error.
