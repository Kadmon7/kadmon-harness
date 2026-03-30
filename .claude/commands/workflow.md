---
description: Show available workflow chains or guide through a specific workflow step by step
---

## Purpose
Make workflow chains discoverable. Instead of remembering which commands to run in what order, use `/workflow` to see the available chains and `/workflow <name>` to start one.

## Arguments
- (none) — list all available workflows
- `dev` — full development cycle
- `qa` — quality assurance pipeline
- `instinct` — instinct lifecycle management
- `evolve` — harness self-optimization

## Workflows

### dev — Full Development Cycle
For implementing features or fixing bugs from planning through commit.
```
/kplan        -> Plan the implementation (architect + planner)
/tdd          -> Write failing test, then implement
/verify       -> Run build, typecheck, tests, lint
/code-review  -> Review code quality and security
/checkpoint   -> Commit and push
/update-docs  -> Sync documentation
/instinct learn -> Extract patterns from session
```

### qa — Quality Assurance Pipeline
For thorough quality validation before merge or release.
```
/verify full     -> Full verification with security scan
/test-coverage   -> Check coverage per file (target 80%+)
/code-review     -> Agent-driven code review
/e2e             -> End-to-end workflow tests
```

### instinct — Instinct Lifecycle
For managing learned patterns after a productive session.
```
/instinct learn   -> Extract patterns from current session
/instinct eval    -> View instincts with quality recommendations
/instinct promote -> Promote high-confidence instincts to skills
/instinct prune   -> Archive weak or contradicted instincts
```

### evolve — Harness Self-Optimization
For periodic harness health checks and improvements.
```
/dashboard        -> Check current harness state
/evolve           -> Run full optimization analysis
/instinct eval    -> Review instinct quality
/instinct promote -> Promote best instincts
/instinct export  -> Backup instinct state
```

## Steps
1. If no argument: display all 4 workflows with their command sequences
2. If argument provided: display the selected workflow and ask "Start from step 1?"
3. Guide through each step interactively, showing progress

## Output
Workflow listing or step-by-step guided execution.
