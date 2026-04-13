---
name: e2e-testing
description: Full workflow testing with real dependencies — session lifecycle, instinct lifecycle, hook chains, SQLite integration, Windows-safe hook stdin harness. Use this skill whenever writing tests that span multiple components, testing hook stdin/stdout/exit codes via execFileSync, verifying database operations end-to-end, testing the session -> instinct -> hook chain, testing Playwright browser flows, or when the user says "E2E", "integration test", "full workflow test", "end to end", "test the whole flow", "hook test", or "instinct promotion test". Also use when deciding what to mock vs use real — the decision matrix inside covers SQLite, file system, Supabase, GitHub API, and hooks. Do not mock the state-store — the harness learned this the hard way.
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

### Hook Testing (Windows-safe)

Hooks are `.js` scripts that read JSON from stdin and exit with a specific code. Test them as real subprocesses — never by importing the module. The harness learned this the hard way: pipes and string interpolation of stdin do not work reliably on Windows; `execFileSync` with the `input` option is the only path that works everywhere.

```typescript
import { execFileSync } from 'node:child_process';
import path from 'node:path';

it('block-no-verify blocks git commit --no-verify (exit 2)', () => {
  const input = JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: 'git commit --no-verify -m "bypass"' }
  });
  try {
    execFileSync('node', ['.claude/hooks/scripts/block-no-verify.js'], {
      input,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${process.env.PATH}:/c/Program Files/nodejs` }
    });
    expect.unreachable('hook should have blocked');
  } catch (e: unknown) {
    const err = e as { status: number; stderr: string };
    expect(err.status).toBe(2);
    expect(err.stderr).toContain('--no-verify is not allowed');
  }
});

it('block-no-verify allows a normal git commit (exit 0)', () => {
  const input = JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: 'git commit -m "feat: ok"' }
  });
  // No throw means exit 0
  execFileSync('node', ['.claude/hooks/scripts/block-no-verify.js'], {
    input, encoding: 'utf8'
  });
});
```

Read both branches: exit 0 and exit 2. A hook that only tests one path has a silent failure mode.

## Anti-Patterns

| Anti-Pattern | Why it fails | Fix |
|---|---|---|
| Sharing a DB handle between tests | State bleeds between cases — one test sees the other's rows and passes by accident | `await openDb(':memory:')` inside `beforeEach`; new DB per test |
| Mocking the state-store | The SQL layer is where most bugs live; mocking it means your test validates nothing real | Use `:memory:` SQLite — it's faster than you think and catches real query bugs |
| Tests that depend on order | Reordering or focusing a single test breaks the suite | Each `it()` arranges its own fixtures; never reuse state from a previous case |
| Missing cleanup | Temp files accumulate, DB handles leak, Windows refuses to delete locked files later | `afterEach` closes DB handles and removes any temp dirs created in the test |
| Piping hook stdin via shell `echo` | Works on macOS, silently fails or truncates on Windows Git Bash | `execFileSync('node', [script], { input: jsonString })` — let Node pipe stdin |
| Testing only the happy path for a hook | Exit 0 is trivial; exit 2 / stderr is where regressions hide | Test both the blocking case and the allowing case for every guard hook |

## Gotchas

- **Windows PATH for Node**: subprocess invocations must extend `PATH` with `/c/Program Files/nodejs` or `execFileSync` may fail to find `node` when Vitest spawns it
- **`execFileSync` throws on non-zero exit**: wrap in `try/catch` and read `.status` and `.stderr` from the error object; do not expect a return value for blocking hooks
- **`npx tsx -e` produces no output on Windows**: for inline TypeScript scripts use a temp `.ts` file and run it with `npx tsx path/to/file.ts`
- **`new URL('...').pathname` encodes spaces as `%20`**: when a test path contains spaces (e.g., `C:\Command Center\...`), use `fileURLToPath()` from `node:url` to get a filesystem-safe string
- **Stop hooks only fire on clean termination**: a crashed Claude Code session does NOT trigger `session-end-all`; tests that rely on end-of-session behavior must invoke the hook directly
- **sql.js saveToDisk in tests**: tests use `:memory:` so persistence is a no-op, but production writes require `saveToDisk()` after every mutation — verify this in integration tests that exercise the production code path

## Integration

- **kartograf agent** (sonnet) — owner of this skill. kartograf specializes in full workflow tests: Vitest for the harness itself, Playwright for web apps. Invoked via `/skanner` (Phase 1b). Never auto-invoked — E2E runs are expensive.
- **/skanner command** — runs `kartograf` in parallel with `arkonte` (performance). Phase 1b executes the critical harness workflows: session lifecycle, instinct lifecycle, hook chain, no-context-guard, cost tracking.
- **/abra-kdabra command** — when `needs_tdd: true` and the plan mentions E2E scope, feniks consults this skill during the red phase to structure workflow-level tests alongside unit tests.
- **tdd-workflow skill** — unit tests are the default; E2E is the escalation when a workflow spans multiple modules (session + hook + instinct + DB). This skill picks up where tdd-workflow stops.

## Rules
- Always set up `:memory:` SQLite in `beforeEach` and tear it down in `afterEach`
- Never share test state between `describe` blocks — each test is an island
- Always verify observable outcomes: SQLite rows, files written, exit codes, stderr text
- Always use `execFileSync` with `input` for hook tests — pipes fail on Windows
- Never mock the local `state-store` — real `:memory:` is cheaper and catches real bugs
- Test both pass and fail branches for every guard hook

## no_context Application
E2E tests verify actual system behavior, not assumed behavior. A unit test can pass while the real workflow is broken at the boundary where two modules meet; an E2E test walks the actual path a session takes through the harness. If a hook claims to block `--no-verify`, the E2E test proves it does by running the real hook with real stdin and checking the real exit code — not by reading the source and assuming. That's `no_context` at the workflow level: evidence, not assumption.