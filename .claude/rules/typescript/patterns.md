---
alwaysApply: false
globs: ["**/*.ts", "**/*.tsx"]
---

# TypeScript Pattern Rules

## Error Handling
- PREFER Result pattern over throwing for expected errors
- MUST use typed error classes for domain errors
- NEVER use `catch (e: any)` — use `catch (e: unknown)` and narrow

```typescript
async function loadUser(userId: string): Promise<User> {
  try {
    return await riskyOperation(userId)
  } catch (error: unknown) {
    logger.error('Operation failed', error)
    throw new Error(error instanceof Error ? error.message : 'Unexpected error')
  }
}
```

## Validation
- MUST use Zod schemas for all API contracts and external data
- PREFER `.parse()` when input MUST be valid (throws on invalid)
- PREFER `.safeParse()` when graceful handling of invalid input is needed
- PREFER `z.infer<typeof schema>` to derive types from schemas

```typescript
const userSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150)
})
type UserInput = z.infer<typeof userSchema>
```

## Immutability
- PREFER `readonly` arrays and object properties where mutation is not needed
- PREFER spread operator for creating modified copies
- NEVER mutate function arguments

```typescript
// WRONG: Mutation
function updateUser(user: User, name: string): User {
  user.name = name; return user
}
// CORRECT: Spread
function updateUser(user: Readonly<User>, name: string): User {
  return { ...user, name }
}
```

## API Response Pattern
- USE generic response wrapper for API endpoints

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: { total: number; page: number; limit: number }
}
```

## Repository Pattern
- USE generic repository interface for data access layers

```typescript
interface Repository<T> {
  findAll(filters?: Filters): Promise<T[]>
  findById(id: string): Promise<T | null>
  create(data: CreateDto): Promise<T>
  update(id: string, data: UpdateDto): Promise<T>
  delete(id: string): Promise<void>
}
```

## React Custom Hooks
- EXTRACT reusable stateful logic into custom hooks

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}
```

## sql.js Typing
- MUST type all query results explicitly (sql.js returns Record<string, unknown>)
- MUST use mapping functions (mapSessionRow, mapInstinctRow) for type conversion
- NEVER trust raw sql.js output types

## Enforcement
- kody agent validates pattern compliance on .ts/.tsx edits (TypeScript specialist mode)
- database-reviewer agent validates sql.js typing and Zod validation patterns when editing database code
- kody agent checks error handling and immutability patterns via /kreview and /checkpoint
- post-edit-typecheck hook catches type errors from pattern violations immediately