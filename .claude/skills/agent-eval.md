---
name: agent-eval
description: Head-to-head evaluation of coding agents (Claude Code vs Aider vs Codex, or the same agent across model versions) on reproducible tasks, with pass rate, cost, time, and consistency metrics. Use this skill whenever comparing coding agents, measuring agent performance before adopting a new tool or switching models, running regression checks after an agent updates, producing data-backed agent selection decisions, or when the user says "which agent is better", "benchmark the agent", "compare Claude to X", "is the new model actually better", "agent eval", or "head to head". Stop running "which agent is best?" on vibes — this skill systematizes it.
---

# Agent Eval

Systematic comparison of coding agents on reproducible tasks. Every "which coding agent is best?" question ends up on vibes or screenshots. This skill teaches the method that turns those questions into measurable answers.

## When to Activate

- Comparing coding agents (Claude Code vs Aider vs Codex vs OpenCode) on your own codebase
- Measuring agent performance before adopting a new tool or switching default models
- Running regression checks when an agent updates its model, tooling, or harness
- Producing data-backed agent selection decisions for a team or contract
- Validating that the new Opus / Sonnet / Haiku version is actually better for your workload

## Core Concepts

### YAML Task Definitions

Define tasks declaratively. Each task specifies what to do, which files to touch, and how to judge success. The task file is the source of truth — results are reproducible because the inputs are pinned.

```yaml
name: add-retry-logic
description: Add exponential backoff retry to the HTTP client
repo: ./my-project
commit: abc1234  # pin to a specific commit for reproducibility
files:
  - src/http_client.ts
prompt: |
  Add retry logic with exponential backoff to all HTTP requests.
  Max 3 retries. Initial delay 1s, max delay 30s. Add jitter.
judge:
  - type: vitest
    command: npx vitest run tests/http_client.test.ts
  - type: grep
    pattern: "exponential|retry|backoff"
    files: src/http_client.ts
```

### Git Worktree Isolation

Each agent run gets its own git worktree created from the pinned commit — no Docker required. Worktrees give you:

- **Reproducibility**: every run starts from the exact same state
- **Isolation**: agents cannot interfere with each other or corrupt the base repo
- **Cleanup**: worktrees can be removed after the run without affecting the main checkout

```bash
git worktree add ../eval-run-claude abc1234
# run Claude here
git worktree remove ../eval-run-claude
```

### Metrics Collected

| Metric | What it measures | Why it matters |
|---|---|---|
| **Pass rate** | Does the agent produce code that passes the judge? | The primary quality signal |
| **Cost** | API spend per task (when available) | A 95% agent at 10× cost may be the wrong choice |
| **Time** | Wall-clock seconds to completion | UX signal; not just raw $ per task |
| **Consistency** | Pass rate across repeated runs (e.g., 3/3 = 100%) | Agents are non-deterministic; single-run results lie |

## Workflow

### 1. Define Tasks

Write 3-5 tasks representing your **real workload** in `docs/evals/agent-eval/<name>.yaml`. Use real code from your repo, not toy examples.

```bash
mkdir -p docs/evals/agent-eval
# Write task definitions
```

### 2. Run Agents

For each agent × each task × N runs (at least 3):

```
1. Create a fresh worktree from the pinned commit
2. Hand the prompt to the agent
3. When the agent finishes, run the judge criteria in the worktree
4. Record: pass/fail, cost, wall-clock time
5. Remove the worktree
```

The loop can be manual (copy the prompt, paste into the agent, run the judge) or scripted. The method is what matters — the automation is an optimization.

### 3. Compare Results

Generate a table per task, aggregating across runs:

```
Task: add-retry-logic (3 runs each)
┌──────────────┬───────────┬────────┬────────┬─────────────┐
│ Agent        │ Pass Rate │ Cost   │ Time   │ Consistency │
├──────────────┼───────────┼────────┼────────┼─────────────┤
│ claude-code  │ 3/3       │ $0.12  │ 45s    │ 100%        │
│ aider        │ 2/3       │ $0.08  │ 38s    │  67%        │
└──────────────┴───────────┴────────┴────────┴─────────────┘
```

## Judge Types

Every task should have **at least one deterministic judge**. LLM-as-judge is noisy on its own.

### Code-Based (deterministic — preferred)

```yaml
judge:
  - type: vitest
    command: npx vitest run tests/
  - type: command
    command: npm run build
  - type: typecheck
    command: npx tsc --noEmit
```

### Pattern-Based

```yaml
judge:
  - type: grep
    pattern: "class.*Retry|retry.*function"
    files: src/**/*.ts
```

### Model-Based (LLM-as-judge — use sparingly)

```yaml
judge:
  - type: llm
    prompt: |
      Does this implementation correctly handle exponential backoff?
      Check for: max retries, increasing delays, jitter on each retry.
      Return PASS or FAIL with a one-sentence reason.
```

Use LLM judges only when the outcome cannot be checked deterministically (e.g., "does the code explain itself with good variable names"). Always combine with at least one deterministic judge.

## Best Practices

1. **Start with 3-5 tasks representing real workload**, not toy examples. A task that doesn't represent your actual work produces results that don't predict your actual experience.
2. **Run at least 3 trials per agent** to capture variance. Agents are non-deterministic; single-run results can be lucky or unlucky.
3. **Pin the commit** in your task YAML so results are reproducible across days, weeks, and agent versions.
4. **Include at least one deterministic judge** (tests, build, typecheck) per task. LLM judges add noise.
5. **Track cost alongside pass rate.** A 95% agent at 10× the cost may not be the right choice for your budget.
6. **Version your task definitions.** They are test fixtures — treat them as code, commit them, review changes.
7. **Re-run after every model version bump.** An "improvement" on public benchmarks may be a regression on your specific tasks.

## Integration

- **alchemik agent** (opus) — primary owner. Invoked via `/evolve`, alchemik can run this skill to benchmark agents in the harness (kody, typescript-reviewer, spektr) against changes in the underlying model. Alchemik's job is harness self-improvement; this skill is how that improvement is measured.
- **eval-harness skill** — close sibling. `eval-harness` defines pass/fail criteria for **feature completion** (EDD). `agent-eval` measures **agent quality** against those completions. Use them together: eval-harness defines the task; agent-eval compares which agent solves it best.
- **/evolve command** — natural entry point for recurring benchmarks after model updates.
- **benchmark skill** (when imported) — complementary: `benchmark` measures code performance; `agent-eval` measures agent performance.

## no_context Application

Every metric in agent-eval must rest on observable evidence. Pass rate comes from a real judge running in a real worktree, not from "it looks done". Cost comes from the API's reported usage, not from estimates. Consistency comes from multiple runs, not a single lucky execution. When comparing two agents, the only valid statements are those that trace back to the recorded runs: "Claude passed 3/3 and Aider passed 2/3" is evidence; "Claude seems better at retries" is not. The `no_context` principle applies here literally: if you cannot cite the run, you cannot make the claim.
