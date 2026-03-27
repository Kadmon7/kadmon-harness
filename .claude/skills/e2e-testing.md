---
name: e2e-testing
description: Full workflow testing with real dependencies — session lifecycle, instinct lifecycle, hook chains, SQLite integration. Use this skill whenever writing tests that span multiple components, testing hook stdin/stdout/exit codes, verifying database operations end-to-end, or when the user says "E2E", "integration test", "full workflow test", or "test the whole flow". Also use when deciding what to mock vs use real (the decision matrix inside covers SQLite, file system, Supabase, GitHub, hooks).
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

### Mock vs Real Decision Matrix
| Component | Use Real | Use Mock | Reason |
|-----------|---------|---------|--------|
| state-store (SQLite) | ALWAYS (`:memory:`) | NEVER | Core persistence — must test real queries |
| File system | When testing I/O reliability | When testing logic only | Real FS catches permission/path issues |
| Supabase API | NEVER in E2E | ALWAYS | External service — mock with fixtures |
| GitHub API | NEVER in E2E | ALWAYS | External service — mock responses |
| Hook scripts | ALWAYS (execFileSync) | NEVER | Must test real stdin/stdout/exit codes |

### Lifecycle Rules
- MUST set up `:memory:` SQLite in beforeEach — never share DB between tests
- MUST clean up in afterEach: close DB connections, remove temp files, reset state
- NEVER share test state between describe blocks
- MUST test full workflow paths: create → modify → verify → cleanup
- MUST verify observable outcomes (SQLite records, files created, exit codes)
- NEVER mock the local state-store — test against real `:memory:` DB
- MUST use `execFileSync` with `input` option for hook testing (Windows-safe)

## no_context Application
E2E tests verify actual system behavior, not assumed behavior.