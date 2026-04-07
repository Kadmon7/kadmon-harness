---
name: coding-standards
description: TypeScript/JavaScript conventions for Kadmon projects — naming, types, imports, error handling, immutability, validation. Use this skill whenever writing new code, reviewing code for convention compliance, or unsure about naming (camelCase vs PascalCase vs snake_case), import style (node: prefix, .js extensions), error handling patterns, Zod validation, immutability, or file organization. Also consult when onboarding to the project or when the kody agent flags TypeScript issues.
---

# Coding Standards

TypeScript/JavaScript conventions for the Kadmon Harness ecosystem. These exist because consistency across files means any contributor (human or agent) can read any module without re-learning conventions.

## When to Use
- Writing any new TypeScript code
- Reviewing code for convention compliance
- Onboarding to the project or entering an unfamiliar module
- When the kody agent flags issues — this skill explains why the rule exists

## How It Works

### TypeScript Strict Mode
Strict mode is always enabled in tsconfig.json. This catches null/undefined bugs at compile time instead of runtime. Every strictness flag exists because a real bug category hides behind it.

- No `any` types — use `unknown` and narrow with type guards, because `any` disables the compiler's ability to catch mistakes
- No `!` non-null assertions without a justification comment, because they hide null-safety bugs
- Prefer `interface` over `type` for object shapes — interfaces produce better error messages and support declaration merging
- Use discriminated unions for state machines: `{ status: 'loading' } | { status: 'done', data: T }` instead of boolean flags

### Naming
Names are documentation. A reader should understand purpose without jumping to the definition.

- camelCase for variables, functions, and object properties
- PascalCase for types, interfaces, and classes
- kebab-case for file names: `instinct-manager.ts`, not `instinctManager.ts`
- snake_case ONLY for SQL column names — conversion happens in state-store.ts mapping functions
- Descriptive names: `getActiveInstincts` not `getAI`, `isSessionExpired` not `check`

### Immutability
Never mutate objects or arrays. Mutation creates invisible coupling between distant parts of the code — one function changes an object and another function downstream sees unexpected values.

```typescript
// WRONG: mutating the argument
function addTag(instinct: Instinct, tag: string): void {
  instinct.tags.push(tag);  // caller's object is changed silently
}

// RIGHT: return a new object
function addTag(instinct: Instinct, tag: string): Instinct {
  return { ...instinct, tags: [...instinct.tags, tag] };
}

// Use readonly to enforce at the type level
interface Config {
  readonly maxRetries: number;
  readonly tags: readonly string[];
}
```

### Zod Validation
Validate all external input at system boundaries — API inputs, file reads, stdin, JSON.parse results. Zod turns runtime surprises into structured errors.

```typescript
import { z } from 'zod';

// Define the schema once, derive the type from it
const InstinctSchema = z.object({
  id: z.string().min(1),
  pattern: z.string(),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()).default([]),
});
type Instinct = z.infer<typeof InstinctSchema>;

// .parse() — use when input MUST be valid (throws ZodError on failure)
const instinct = InstinctSchema.parse(JSON.parse(rawInput));

// .safeParse() — use when you need to handle invalid input gracefully
const result = InstinctSchema.safeParse(data);
if (!result.success) {
  console.error(JSON.stringify({ ts: Date.now(), level: 'error', msg: result.error.message }));
  return null;
}
```

### Error Handling
Errors carry context. A bare `throw new Error('failed')` tells the developer nothing. Include what failed, why, and what input caused it.

- Never catch and swallow silently — always log to stderr as JSON: `{ ts, level, msg }`
- Return null or Result types for expected failures (e.g., "record not found")
- Throw for unexpected/unrecoverable errors (e.g., corrupt database)
- Use `catch (e: unknown)` and narrow — never `catch (e: any)`
- In hooks: return gracefully with exit(0) on unexpected errors to avoid crashing Claude Code

### Imports
Import order communicates dependency layers. Node builtins are stable, third-party is semi-stable, local code changes often.

```typescript
// 1. Node.js builtins (always with node: prefix)
import fs from 'node:fs';
import path from 'node:path';

// 2. Third-party packages
import { z } from 'zod';

// 3. Local imports (relative paths with .js extension for Node16 resolution)
import type { SessionSummary } from './types.js';
import { openDb, saveToDisk } from './state-store.js';
```

- Use `import type` for type-only imports — this is not cosmetic; it prevents circular dependency issues at runtime
- Never use `require()` — ES module imports only
- Never create circular dependencies — if A imports B and B imports A, extract the shared piece into C

### Files
- One module per file — a file named `session-manager.ts` exports session management, nothing else
- Small files under 200 lines preferred — if a file grows past 200, look for extraction opportunities
- Co-locate tests: `scripts/lib/foo.ts` -> `tests/lib/foo.test.ts`

### Code Smells

| Smell | Threshold | Fix |
|-------|-----------|-----|
| Long functions | > 50 lines | Extract helpers with descriptive names |
| Deep nesting | > 3 levels | Use early returns to flatten |
| Magic numbers | Any unlabeled literal | Use named constants |

### JSDoc (for .js files)

In `.js`/`.jsx` files where TypeScript types are not available, use JSDoc to convey intent:

```javascript
/** @param {{ firstName: string, lastName: string }} user @returns {string} */
export function formatUser(user) {
  return `${user.firstName} ${user.lastName}`
}
```

Keep JSDoc aligned with runtime behavior. Do not use JSDoc in `.ts` files -- TypeScript types are authoritative.

### Testing (AAA Pattern)

Structure tests as Arrange-Act-Assert for clarity:

```typescript
it('should return active instincts sorted by confidence', async () => {
  // Arrange
  await openDb(':memory:');
  upsertInstinct({ id: 'a', confidence: 0.3 });
  upsertInstinct({ id: 'b', confidence: 0.8 });

  // Act
  const result = getActiveInstincts('p');

  // Assert
  expect(result[0].confidence).toBe(0.8);
});
```

## Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| Using `any` type | Disables all type checking — bugs hide until runtime | Use `unknown` and narrow with type guards or Zod |
| Using `var` | Function-scoped, hoisted, causes subtle bugs in loops | Use `const` (preferred) or `let` |
| Nested if/else chains | Hard to read, easy to miss a branch, grows unboundedly | Use early returns to flatten the logic |
| Mutable default parameters | Default arrays/objects are shared across calls — mutations leak | Use `readonly` types and spread to copy |
| String concatenation for SQL | SQL injection vulnerability | Use parameterized queries: `db.run(sql, [param])` |
| Catching errors as `any` | Loses type safety in the error handler itself | Use `catch (e: unknown)` and narrow with instanceof |
| Missing .js in local imports | Fails at runtime under Node16 module resolution | Always add `.js` extension to relative import paths |

## Integration
- **kody agent** (sonnet): Auto-invoked on .ts/.tsx edits. Checks strict mode, type safety, naming conventions, import patterns, and immutability. Runs via /chekpoint.
- **post-edit-typecheck hook**: Validates TypeScript compilation immediately after every Edit/Write operation — catches violations in real time.
- **quality-gate hook**: Runs lint and style checks after every Edit/Write operation.
- **console-log-warn hook**: Flags console.log in production code — use the structured log() utility instead.

## Rules
- Every exported function has at least one test
- No console.log in production code — use the log() utility or stderr JSON
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- Prefer early returns over nested conditionals
- Prefer `const` over `let` — use `let` only when reassignment is truly needed

## Gotchas
- `.js` extension in imports is required for Node16 module resolution -- without it, TypeScript compiles fine but runtime fails with MODULE_NOT_FOUND
- `import type` is not cosmetic -- it prevents circular dependency issues at runtime by ensuring the import is erased
- snake_case to camelCase conversion happens ONLY in state-store.ts mapping functions -- do not convert anywhere else
- console.log in production code triggers the console-log-warn hook. Use structured stderr JSON instead: `{ ts, level, msg }`

## no_context Application
Coding standards are derived from the actual codebase patterns in types.ts, state-store.ts, and utils.ts -- not from generic best practices. When in doubt, read the existing code in the module you are editing. The kody agent validates compliance, but understanding WHY a convention exists matters more than memorizing the rule.
