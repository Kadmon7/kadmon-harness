---
name: eval-harness
description: Use when evaluating agent or skill quality through structured evaluation criteria
---

# Eval Harness

Structured evaluation framework for measuring agent and skill effectiveness.

## When to Use
- After modifying an agent or skill
- When /eval command is invoked
- Assessing instinct quality before promotion

## How It Works
1. **Define criteria** — what does success look like?
2. **Create test cases** — inputs with expected outputs
3. **Run evaluation** — execute against test cases
4. **Score** — pass/fail per criterion
5. **Report** — summary with pass rate

## Rules
- Evaluations must be reproducible
- Score against defined criteria, not subjective impression
- Track eval results over time

## no_context Application
Evaluations are evidence-based: scores come from test results, not impressions.