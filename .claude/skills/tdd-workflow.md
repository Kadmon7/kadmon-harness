---
name: tdd-workflow
description: Write the test before the code — red, green, refactor. Use this skill whenever implementing a new function, fixing a bug, adding a hook, modifying behavior, or when the user says "add", "implement", "create", or "fix". Also use when reviewing whether test coverage exists for new code. Even for small changes, the test-first discipline catches edge cases before they ship. Tests are evidence, not assumptions — they enforce the no_context principle at the code level.
---

# TDD Workflow

Red -> Green -> Refactor. Every feature starts with a failing test.

## When to Use
- Implementing any new function or module
- Fixing a bug (write a test that reproduces the bug first)
- Adding or modifying a hook script
- Changing existing behavior (write the new expected behavior as a test)
- Reviewing whether new code has adequate coverage
- Exempt: config-only changes, documentation, and trivial one-liners

## How It Works

### 1. RED — Write a failing test
Describe the desired behavior in a test. Run it. It MUST fail. A test that passes immediately proves nothing — it means either the behavior already exists (search-first missed it) or the test is wrong.

### 2. GREEN — Write the minimum code
Make the test pass with the simplest possible implementation. Resist the urge to generalize or optimize. The goal is a green checkmark, not elegant code. Elegance comes in step 3.

### 3. REFACTOR — Clean up while green
Improve names, extract helpers, remove duplication — but change no behavior. Run tests after each refactoring move. If a test breaks, you changed behavior, not structure. Undo and try again.

## Examples

### Example 1: New query function
```typescript
// RED: describe the behavior you want
it('should return instincts sorted by confidence descending', async () => {
  await openDb(':memory:');
  upsertInstinct({ id: 'a', projectHash: 'p', confidence: 0.3, pattern: 'x', action: 'y' });
  upsertInstinct({ id: 'b', projectHash: 'p', confidence: 0.8, pattern: 'x', action: 'y' });
  const result = getActiveInstincts('p');
  expect(result[0].confidence).toBe(0.8);
});
// GREEN: implement getActiveInstincts with ORDER BY confidence DESC
// REFACTOR: extract sort direction as parameter if needed elsewhere
```

### Example 2: Bug fix — reproduce first
```typescript
// The bug: saveSessionSummary crashes when observations is undefined
// RED: write the test that exposes the crash
it('should handle undefined observations without throwing', async () => {
  await openDb(':memory:');
  const summary = { id: 'sess-1', startedAt: new Date().toISOString() };
  // This must not throw — that is the assertion
  expect(() => saveSessionSummary(summary)).not.toThrow();
});
// GREEN: add a guard — observations ?? [] — in saveSessionSummary
// REFACTOR: ensure all optional fields have defaults at the boundary
```

### Example 3: Hook testing with execFileSync
```typescript
// Hook tests run the actual .js file as a subprocess — no mocking the hook runner
import { execFileSync } from 'node:child_process';

it('should block git commit without conventional format (exit 2)', () => {
  const input = JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: 'git commit -m "bad message"' }
  });
  const result = execFileSync('node', ['commit-format-guard.js'], {
    input, cwd: '.claude/hooks/scripts', encoding: 'utf8',
    env: { ...process.env, PATH: `${process.env.PATH}:/c/Program Files/nodejs` }
  });
  // execFileSync throws on non-zero exit — catch and check status
});

it('should allow properly formatted commit (exit 0)', () => {
  const input = JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: 'git commit -m "feat(hooks): add new guard"' }
  });
  // Should not throw — exit 0
  execFileSync('node', ['commit-format-guard.js'], {
    input, cwd: '.claude/hooks/scripts', encoding: 'utf8'
  });
});
```

## Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| Test after code | Tests become confirmation bias — you test what you wrote, not what you need | Write the test first; let it define the contract |
| Testing implementation details | Tests break on every refactor even when behavior is unchanged | Test inputs and outputs, not internal method calls |
| Skipping the refactor phase | Code accumulates duplication and unclear names across green steps | Budget refactor time after every green; it is not optional |
| Testing too much at once | When tests fail, you cannot tell which behavior is broken | One assertion per behavior; split large tests into focused ones |
| Mocking everything | Tests pass but the real system fails at integration points | Prefer real :memory: SQLite over mocking state-store |
| Using .skip without tracking | Skipped tests become invisible broken windows | Never commit .skip without a TODO comment and issue reference |

## Integration

- **/ktest command**: Launches the tdd-guide agent, which enforces the red-green-refactor cycle step by step. Use it for any non-trivial implementation.
- **/checkpoint command**: Runs typecheck + tests + lint + review. Run after every green and refactor step to confirm nothing regressed beyond the file you touched.
- **tdd-guide agent** (sonnet): Walks you through each TDD phase, challenges premature implementation, and blocks commits with failing tests.
- **post-edit-typecheck hook**: Catches type errors immediately after edits — acts as a fast feedback loop during the green phase.
- **session-end-all hook** (pattern evaluation phase): Tracks the "TDD discipline" pattern — whether tests preceded implementation in the session.

## Rules
- Target 80%+ coverage on new code
- Every exported function must have at least one test
- Use `:memory:` SQLite for all database tests — never touch production DB
- Use execFileSync with input option for hook tests (Windows-safe, no stdin pipe issues)
- Test happy path, error path, and at least one edge case per function
- Run the full test suite (`npx vitest run`) before committing — /checkpoint automates this

## no_context Application
TDD is the no_context principle applied to code itself. A test is evidence that behavior works — not an assumption, not a guess. When you write the test first, you prove you understand the requirement before you implement it. When the test passes, you have proof the code meets the requirement. No test means no evidence — and no_context demands evidence.
