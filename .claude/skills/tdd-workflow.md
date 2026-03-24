---
name: tdd-workflow
description: Use when implementing any new feature or fixing bugs — always write tests first
---

# TDD Workflow

Red → Green → Refactor. Every feature starts with a failing test.

## When to Use
- Implementing any new function or module
- Fixing a bug (write test that reproduces it first)
- Adding a new hook script
- Modifying existing behavior

## How It Works
1. **RED** — Write a test that describes the desired behavior. Run it. It must fail.
2. **GREEN** — Write the minimum code to make the test pass. No more.
3. **REFACTOR** — Clean up the code without changing behavior. Tests must still pass.

## Examples

### Example 1: Adding a new instinct query
```typescript
it('should return instincts sorted by confidence', async () => {
  await openDb(':memory:');
  upsertInstinct({ id: 'a', projectHash: 'p', confidence: 0.3, pattern: 'x', action: 'y' });
  upsertInstinct({ id: 'b', projectHash: 'p', confidence: 0.8, pattern: 'x', action: 'y' });
  const result = getActiveInstincts('p');
  expect(result[0].confidence).toBe(0.8);
});
```

## Rules
- Target: 80%+ coverage on new code
- Every exported function must have at least one test
- Use `:memory:` SQLite for database tests
- Use execFileSync with input option for hook tests (Windows-safe)

## no_context Application
TDD is a no_context enforcement mechanism: you cannot implement something you have not specified in a test.