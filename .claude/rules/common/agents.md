---
alwaysApply: true
---

# Agent Usage Rules

## Routing
- MUST use opus model for: architect, planner (complex reasoning tasks)
- MUST use sonnet model for: all other agents (speed + quality balance)
- NEVER use haiku for code review or security analysis

## When to Invoke
- ALWAYS invoke security-reviewer for code touching: authentication, encryption, API keys, user input
- ALWAYS invoke code-reviewer before any commit via /checkpoint
- ALWAYS invoke planner for tasks estimated > 1 hour
- NEVER invoke architect for routine bug fixes or small features

## Communication
- Agents return structured output (markdown with sections)
- MUST include severity levels in reviews (BLOCK/WARN/NOTE or CRITICAL/HIGH/MEDIUM/LOW)
- NEVER let an agent modify code without explicit approval from the user