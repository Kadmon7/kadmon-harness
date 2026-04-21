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

## Step 0: Write User Journeys

Before writing tests, describe the behavior from the user's perspective:

```
As a [role], I want to [action], so that [benefit]

Example:
As a developer, I want instincts sorted by confidence,
so that I can see the most reliable patterns first.
```

This grounds your tests in real requirements, not implementation details.

## Step 1: RED — Write a failing test

Describe the desired behavior in a test. Run it. It MUST fail. A test that passes immediately proves nothing — it means either the behavior already exists (search-first missed it) or the test is wrong.

**RED gate validation**: Before modifying production code, verify:
- The test compiles and executes (not just written but never run)
- The failure is caused by missing/wrong business logic, not broken test setup
- A compile-time failure counts as RED only if the test exercises the buggy code path

### Git checkpoint (optional)
```bash
git add -A && git commit -m "test: add reproducer for <feature or bug>"
```

## Step 2: GREEN — Write the minimum code

Make the test pass with the simplest possible implementation. Resist the urge to generalize or optimize. The goal is a green checkmark, not elegant code. Elegance comes in step 3.

### Git checkpoint (optional)
```bash
git add -A && git commit -m "fix: <feature or bug>"
```

## Step 3: REFACTOR — Clean up while green

Improve names, extract helpers, remove duplication — but change no behavior. Run tests after each refactoring move. If a test breaks, you changed behavior, not structure. Undo and try again.

### Git checkpoint (optional)
```bash
git add -A && git commit -m "refactor: clean up after <feature> implementation"
```

## Test Types

| Type | What to Test | Framework |
|------|-------------|-----------|
| Unit | Individual functions in isolation | Vitest (TS), pytest (Python) |
| Integration | DB operations, hook chains, session lifecycle | Vitest with :memory: SQLite |
| E2E (harness) | Full workflows: session -> instinct -> hook chain | Vitest |
| E2E (web) | Browser flows, UI interactions | Playwright |
| Hook | Hook scripts via execFileSync with stdin | Vitest (execFileSync) |

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
  try {
    execFileSync('node', ['commit-format-guard.js'], {
      input, cwd: '.claude/hooks/scripts', encoding: 'utf8',
      env: { ...process.env, PATH: `${process.env.PATH}:/c/Program Files/nodejs` }
    });
    expect.unreachable('Should have thrown');
  } catch (e: unknown) {
    expect((e as { status: number }).status).toBe(2);
  }
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

## Common Mistakes

### WRONG: Testing implementation details
```typescript
// Breaks on every refactor even when behavior is unchanged
expect(component.state.count).toBe(5)
```

### RIGHT: Test user-visible behavior
```typescript
expect(screen.getByText('Count: 5')).toBeInTheDocument()
```

### WRONG: Brittle selectors
```typescript
await page.click('.css-class-xyz')
```

### RIGHT: Semantic selectors
```typescript
await page.click('button:has-text("Submit")')
await page.click('[data-testid="submit-button"]')
```

### WRONG: Tests depend on each other
```typescript
test('creates user', () => { /* ... */ })
test('updates same user', () => { /* depends on previous test */ })
```

### RIGHT: Independent tests
```typescript
test('creates user', () => {
  const user = createTestUser()  // each test sets up its own data
})
```

## Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| Test after code | Tests become confirmation bias | Write the test first; let it define the contract |
| Testing implementation details | Tests break on every refactor | Test inputs and outputs, not internal method calls |
| Skipping the refactor phase | Code accumulates duplication | Budget refactor time after every green; it is not optional |
| Testing too much at once | Cannot tell which behavior is broken | One assertion per behavior; split large tests |
| Mocking everything | Tests pass but real system fails | Prefer real :memory: SQLite over mocking state-store |
| Using .skip without tracking | Skipped tests become invisible broken windows | Never commit .skip without a TODO comment and issue reference |

## Gotchas
- On Windows, hook tests need `PATH` extended with `/c/Program Files/nodejs` for Node.js resolution
- `npx tsx -e` produces no output on Windows -- use temp script files for inline TypeScript execution
- Stop hooks only fire on clean session termination -- crashes do NOT trigger session-end-all
- When using `execFileSync` for hook tests, non-zero exit codes throw -- wrap in try/catch and check `.status`

## Integration

- **/abra-kdabra command** (with needs_tdd: true): Launches the feniks agent, which enforces the red-green-refactor cycle step by step
- **/chekpoint command**: Runs typecheck + tests + lint + review. Run after every green and refactor step
- **feniks agent** (sonnet): Walks you through each TDD phase, challenges premature implementation
- **post-edit-typecheck hook**: Catches type errors immediately after edits -- fast feedback during green phase
- **session-end-all hook** (pattern evaluation phase): Tracks "TDD discipline" pattern

## Rules
- Target 80%+ coverage on new code
- Every exported function must have at least one test
- Use `:memory:` SQLite for all database tests -- never touch production DB
- Use execFileSync with input option for hook tests (Windows-safe)
- Test happy path, error path, and at least one edge case per function
- Run the full test suite before committing. Command depends on target project toolchain (ADR-020):

  | Toolchain | Command |
  |-----------|---------|
  | TypeScript | `npx vitest run` |
  | Python | `pytest` |

## no_context Application
TDD is the no_context principle applied to code itself. A test is evidence that behavior works — not an assumption, not a guess. When you write the test first, you prove you understand the requirement before you implement it. When the test passes, you have proof the code meets the requirement. No test means no evidence — and no_context demands evidence.
