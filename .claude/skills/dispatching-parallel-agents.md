---
name: dispatching-parallel-agents
description: Dispatch independent tasks to parallel subagents for concurrent execution. Use when facing 2+ independent problems (different test files, subsystems, bugs) that can be investigated or fixed without shared state. Also use when multiple unrelated failures appear after refactoring, when debugging reveals separate root causes, or when implementation tasks don't depend on each other. Faster than sequential investigation.
---

# Dispatching Parallel Agents

When you have multiple unrelated problems, investigating them sequentially wastes time. Each investigation is independent and can happen in parallel.

**Core principle:** One agent per independent problem domain. Let them work concurrently.

## When to Use

- 2+ test files failing with different root causes
- Multiple subsystems broken independently
- Each problem can be understood without context from others
- No shared state between investigations

## When NOT to Use

- Failures are related (fixing one might fix others)
- Need to understand full system state first
- Agents would edit the same files
- Exploratory debugging (don't know what's broken yet)

## The Pattern

### 1. Identify Independent Domains

Group failures by what's broken:
- File A tests: Hook validation logic
- File B tests: Session persistence
- File C tests: Instinct scoring

Each domain is independent — fixing hooks doesn't affect instinct scoring.

### 2. Create Focused Agent Tasks

Each agent gets:
- **Specific scope:** One test file or subsystem
- **Clear goal:** Make these tests pass / fix this issue
- **Constraints:** Don't change code outside your scope
- **Context:** Error messages, test names, relevant file paths
- **Expected output:** Summary of root cause and changes

### 3. Dispatch in Parallel

Use the Agent tool with multiple tool calls in a single message:

```
Agent 1 → "Fix hook-validation.test.ts failures: [error details]"
Agent 2 → "Fix session-persistence.test.ts failures: [error details]"
Agent 3 → "Fix instinct-scoring.test.ts failures: [error details]"
```

All three run concurrently.

### 4. Review and Integrate

When agents return:
1. Read each summary — understand what changed
2. Check for conflicts — did agents edit same code?
3. Run /verify — full test suite to confirm all fixes work together
4. Spot check — agents can make systematic errors

## Agent Prompt Structure

Good prompts are focused, self-contained, and specific about output:

```markdown
Fix the 3 failing tests in tests/lib/instinct-manager.test.ts:

1. "should update confidence on pattern match" — expects 0.8, gets 0.3
2. "should archive low-confidence instincts" — instinct not archived
3. "should handle concurrent updates" — timeout after 5000ms

These tests pass on main. Recent changes in instinct-manager.ts may have broken them.

Your task:
1. Read the test file and implementation
2. Identify root cause (not symptoms)
3. Fix the implementation (not the tests, unless tests are wrong)
4. Verify all 3 tests pass
5. Verify no other tests break

Do NOT just adjust expected values — find the real issue.

Return: Summary of root cause and what you fixed.
```

## Common Mistakes

- **Too broad:** "Fix all tests" — agent gets lost
- **No context:** "Fix the race condition" — agent doesn't know where
- **No constraints:** Agent might refactor everything
- **Vague output:** "Fix it" — you don't know what changed

## Integration

**Project commands:**
- /verify — run after integrating all agent results

**Model routing:**
- Use sonnet for focused debugging tasks
- Use opus only if task requires architectural understanding
