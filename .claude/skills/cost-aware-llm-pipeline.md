---
name: cost-aware-llm-pipeline
description: Optimize token usage and API costs — model routing (opus/sonnet/haiku), prompt sizing, session budgeting. Use this skill whenever choosing which model to use for a task, reviewing cost trends via /dashboard, when a session seems expensive, or when the user asks about "cost", "tokens", "pricing", "budget", or "which model should I use". Also use when the cost-tracker hook reports high session costs or when planning multi-session projects that need cost estimates.
---

# Cost-Aware LLM Pipeline

Optimize token usage and API costs without sacrificing quality.

## When to Use
- Planning which model to use for a task
- Reviewing session cost trends
- Optimizing prompt length
- Budgeting for project phases

## How It Works

### Model Pricing (per 1M tokens)
| Model | Input | Output | Best For |
|-------|-------|--------|----------|
| Haiku | $0.80 | $4.00 | Docs, formatting, simple tasks |
| Sonnet | $3.00 | $15.00 | Implementation, review, testing |
| Opus | $15.00 | $75.00 | Architecture, complex planning |

### Cost Optimization Strategies
1. **Route by complexity** — Do not use Opus for simple edits
2. **Compact strategically** — Reduce context before it gets expensive
3. **Cache research** — Read once, reference many times
4. **Batch operations** — Multiple small edits in one session vs many sessions
5. **Track costs** — The cost-tracker hook logs every session cost

### Cost Tracking
The cost-tracker hook runs at session end and records:
- Model used
- Input/output tokens
- Estimated cost (USD)
- Stored in SQLite cost_events table

## Rules
- Monitor cost trends via harness-optimizer agent
- Flag sessions that exceed $1.00 for review
- Default to Sonnet unless task clearly requires Opus

## no_context Application
Cost calculations use actual token counts from the session, not estimates. The cost-calculator.ts module uses published pricing rates.