# Architect & Alchemist Agents

> 21 nodes

## Key Concepts

- **Agent Catalog (16 agents, model/trigger/command/skills)** (18 connections) — `.claude/agents/CATALOG.md`
- **mekanik (Build Fixer, sonnet)** (9 connections) — `.claude/agents/mekanik.md`
- **arkitect (Architect, opus)** (8 connections) — `.claude/agents/arkitect.md`
- **alchemik (Evolution Analyst, opus)** (6 connections) — `.claude/agents/alchemik.md`
- **kurator (Refactoring, sonnet)** (6 connections) — `.claude/agents/kurator.md`
- **doks (Doc Sync, opus)** (5 connections) — `.claude/agents/doks.md`
- **feniks (TDD Enforcer, sonnet)** (5 connections) — `.claude/agents/feniks.md`
- **konstruct (Planner, opus)** (4 connections) — `.claude/agents/konstruct.md`
- **Evolution Categories (PROMOTE / CREATE AGENT / CREATE COMMAND / CREATE RULE / OPTIMIZE)** (2 connections) — `.claude/agents/alchemik.md`
- **Artifact-choice rubric (prefer smaller surface: PROMOTE < RULE < COMMAND < AGENT)** (2 connections) — `.claude/agents/alchemik.md`
- **ADR template (Status / Context / Options / Decision / Consequences)** (2 connections) — `.claude/agents/arkitect.md`
- **Red-green-refactor cycle (test must fail first, 80%+ coverage)** (2 connections) — `.claude/agents/feniks.md`
- **Language branch selection (Vitest for TS, pytest for Python; never mix toolchains)** (2 connections) — `.claude/agents/feniks.md`
- **Sizing and phasing (each phase independently mergeable; Phase 1 must stand alone)** (2 connections) — `.claude/agents/konstruct.md`
- **konstruct pipeline contract (reads ADR, writes plan-NNN, emits needs_tdd)** (2 connections) — `.claude/agents/konstruct.md`
- **Toolchain branching for detection (knip/ts-prune vs vulture/ruff, skip when no marker)** (2 connections) — `.claude/agents/kurator.md`
- **C-003 - /medik Phase 2 always runs** (2 connections) — `CORRECTIONS.md`
- **Auto-Invoke routing table (no prompt needed)** (1 connections) — `.claude/agents/CATALOG.md`
- **Architectural principles (Modularity, Maintainability, Security, Performance, Immutability)** (1 connections) — `.claude/agents/arkitect.md`
- **Architecture red flags (Big Ball of Mud, God Object, Tight Coupling, Leaky Abstraction)** (1 connections) — `.claude/agents/arkitect.md`
- **Minimal-changes doctrine (one root cause per iteration, deepest file first, never refactor)** (1 connections) — `.claude/agents/mekanik.md`

## Relationships

- [Agent Docs](Agent_Docs.md) (16 shared connections)
- [Agent Docs: Doks Catalog](Agent_Docs-_Doks_Catalog.md) (1 shared connections)
- [Backlog & Release Notes](Backlog_%26_Release_Notes.md) (1 shared connections)
- [Agent Docs: Alchemik Generate](Agent_Docs-_Alchemik_Generate.md) (1 shared connections)

## Source Files

- `.claude/agents/CATALOG.md`
- `.claude/agents/alchemik.md`
- `.claude/agents/arkitect.md`
- `.claude/agents/doks.md`
- `.claude/agents/feniks.md`
- `.claude/agents/konstruct.md`
- `.claude/agents/kurator.md`
- `.claude/agents/mekanik.md`
- `CORRECTIONS.md`

## Audit Trail

- EXTRACTED: 77 (93%)
- INFERRED: 6 (7%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*