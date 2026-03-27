---
name: agentic-engineering
description: AI-first development methodology — eval-driven design, model routing, agent decomposition, verification loops. Use this skill whenever designing features that use Claude Code agents, building multi-step automated workflows, deciding which model tier to use (opus/sonnet/haiku), or implementing eval-driven development. Also use when the user mentions "agent", "workflow", "pipeline", "multi-step", or asks how to structure an AI-powered feature for ToratNetz or KAIRON.
---

# Agentic Engineering

AI-first development methodology for building with Claude Code.

## When to Use
- Designing features that leverage Claude Code agents
- Building multi-step automated workflows
- Implementing eval-driven development
- Optimizing agent interactions for cost and quality

## How It Works

### Principles
1. **Eval first** — Define success criteria before building
2. **Decompose** — Break complex tasks into agent-sized steps
3. **Route by complexity** — Opus for reasoning, Sonnet for implementation, Haiku for lightweight
4. **Verify** — Every agent output goes through verification loop
5. **Learn** — Extract patterns into instincts for continuous improvement

### Model Routing
| Complexity | Model | Use Case |
|-----------|-------|----------|
| High | opus | Architecture, complex planning |
| Medium | sonnet | Implementation, review, testing |
| Low | haiku | Documentation, formatting |

## Examples

### Designing a RAG pipeline (ToratNetz)
```
1. architect agent (opus): design retrieval + generation pipeline
2. planner agent (opus): break into implementation steps
3. tdd-guide agent (sonnet): write tests for each step
4. code-reviewer agent (sonnet): review implementation
5. /verify: run full verification loop
```

## Rules
- Always start with planner or architect agent for complex tasks
- Never send opus-tier tasks to haiku
- Every agent invocation should have a clear, measurable goal

## no_context Application
Agentic engineering requires that each agent receives verified context — no agent should operate on assumed or invented inputs.