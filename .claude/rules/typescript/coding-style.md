---
alwaysApply: false
globs: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
---

# TypeScript/JavaScript Coding Style Rules

> This file extends [common/coding-style.md](../common/coding-style.md) with TypeScript-specific content.

## Strict Mode
- MUST enable strict mode in tsconfig.json
- NEVER use non-null assertion (!) without justification comment
- PREFER discriminated unions over boolean flags for state

## Types and Interfaces
- MUST add explicit parameter and return types to exported functions and public methods
- LET TypeScript infer obvious local variable types
- EXTRACT repeated inline object shapes into named types or interfaces
- MUST use `as const` for literal type assertions
- PREFER `unknown` over `any` for untyped values — use generics when type depends on caller
- MUST use explicit generic constraints: `<T extends object>` not `<T>`
- NEVER use type assertions (`as X`) when a type guard would work

```typescript
// WRONG: any removes type safety
function getErrorMessage(error: any) { return error.message }

// CORRECT: unknown forces safe narrowing
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unexpected error'
}
```

## Interfaces vs Type Aliases
- USE `interface` for object shapes that may be extended or implemented
- USE `type` for unions, intersections, tuples, mapped types, and utility types
- PREFER string literal unions over `enum` unless enum is required for interop

```typescript
interface User { id: string; email: string }
type UserRole = 'admin' | 'member'
type UserWithRole = User & { role: UserRole }
```

## React Props
- MUST define component props with a named `interface` or `type`
- MUST type callback props explicitly
- NEVER use `React.FC` unless there is a specific reason

```typescript
interface UserCardProps {
  user: User
  onSelect: (id: string) => void
}

function UserCard({ user, onSelect }: UserCardProps) {
  return <button onClick={() => onSelect(user.id)}>{user.email}</button>
}
```

## Modules
- MUST use .js extension in import paths (Node16 module resolution)
- MUST use `import type` for type-only imports
- NEVER use require() — use ES module imports only

## JavaScript Files
- In `.js`/`.jsx` files, use JSDoc when types improve clarity and TS migration is not practical
- Keep JSDoc aligned with runtime behavior

```javascript
/** @param {{ firstName: string, lastName: string }} user @returns {string} */
export function formatUser(user) {
  return `${user.firstName} ${user.lastName}`
}
```

## Console.log
- NEVER use `console.log` in production code
- USE proper logging libraries instead
- console-log-warn hook detects violations automatically

## Enforcement
- kody agent auto-checks strict mode, type safety, async patterns, and Node16 resolution on .ts/.tsx edits (TypeScript specialist mode)
- post-edit-typecheck hook validates TypeScript compilation after every Edit/Write (PostToolUse, exit 1 on errors)
- quality-gate hook runs lint/style checks after every Edit/Write (PostToolUse)
- console-log-warn hook warns about console.log in production code (PostToolUse)
- coding-standards skill provides TypeScript convention reference