---
name: e2e-testing
description: Use when designing or running end-to-end tests that verify full system workflows
---

# E2E Testing

Test full workflows, not isolated units.

## When to Use
- Verifying session lifecycle end-to-end
- Testing instinct lifecycle
- Validating hook chains
- Integration testing with real SQLite

## How It Works
1. Set up real dependencies (`:memory:` SQLite, temp dirs)
2. Execute full workflow
3. Verify observable outcomes (SQLite records, files created)
4. Clean up

## Examples

### Session lifecycle
```typescript
it('persists session summary', async () => {
  await openDb(':memory:');
  startSession('s1', projectInfo);
  const result = endSession('s1', { filesModified: ['a.ts'], messageCount: 10 });
  expect(result.filesModified).toContain('a.ts');
  expect(result.durationMs).toBeGreaterThan(0);
});
```

### Instinct lifecycle
```typescript
it('create -> reinforce -> promote', async () => {
  await openDb(':memory:');
  const inst = createInstinct('p1', 'pattern', 'action', 's1');
  reinforceInstinct(inst.id, 's2'); // 0.4
  reinforceInstinct(inst.id, 's3'); // 0.5
  reinforceInstinct(inst.id, 's4'); // 0.6
  reinforceInstinct(inst.id, 's5'); // 0.7
  const promoted = promoteInstinct(inst.id, 'my-skill');
  expect(promoted.status).toBe('promoted');
});
```

## Rules
- Use real dependencies, not mocks
- Each test cleans up after itself

## no_context Application
E2E tests verify actual system behavior, not assumed behavior.