---
name: api-design
description: RESTful and RPC API design — resource naming, HTTP methods, Zod validation, error handling, versioning, authentication, pagination. Use this skill whenever designing new API endpoints, reviewing endpoint structure, planning Supabase Edge Functions, defining service boundaries, or when the user mentions "endpoint", "REST", "API route", "request/response format", "error response", "pagination", or "service interface". Also use when implementing API contracts for ToratNetz search or KAIRON voice endpoints. Even internal service interfaces benefit from these patterns to keep boundaries clean and debuggable.
---

# API Design

RESTful and RPC API design patterns for TypeScript services. Consistent API design matters because every endpoint becomes a contract — once clients depend on it, changing the shape is expensive. Get it right from the start.

## When to Use
- Designing new API endpoints or Supabase Edge Functions
- Reviewing existing API structure for consistency
- Planning service boundaries between modules
- Implementing error handling for API responses
- Adding authentication or authorization to routes
- Choosing a pagination strategy for list endpoints

## How It Works

### REST Conventions
Use resources as nouns, not verbs. The HTTP method carries the action.

- Resources as nouns: `/sessions`, `/instincts`, `/costs`
- HTTP methods: GET (read), POST (create), PUT (replace), PATCH (update), DELETE (remove)
- Status codes: 200 (ok), 201 (created), 204 (no content), 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 409 (conflict), 422 (validation error), 500 (server error)
- Nested resources for relationships: `/sessions/:id/observations`

Use 201 for successful creation (not 200) because it tells the client something was created, not just acknowledged. Use 204 for successful DELETE because there is nothing to return. Use 422 for Zod validation failures because 400 is too vague.

### Response Envelope
Wrap every response in a consistent envelope. This matters because clients can write one error handler instead of guessing per-endpoint.

```typescript
interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  meta?: { total: number; cursor?: string };
}

interface ApiError {
  code: string;       // machine-readable: "VALIDATION_ERROR", "NOT_FOUND"
  message: string;    // human-readable explanation
  details?: unknown;  // Zod issues array or field-level errors
}
```

### Error Handling
Define an error code enum so clients can switch on codes instead of parsing messages.

```typescript
const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

Format Zod errors into the envelope so clients get field-level feedback:

```typescript
const result = CreateSessionSchema.safeParse(body);
if (!result.success) {
  return { status: 422, body: {
    data: null,
    error: {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Invalid request body',
      details: result.error.issues,
    },
  }};
}
```

### Input Validation
Validate at the boundary — before any business logic runs. Zod schemas serve as both runtime validation and TypeScript type inference.

```typescript
import { z } from 'zod';
const CreateSessionSchema = z.object({
  projectHash: z.string().length(16),
  branch: z.string().min(1),
});
type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
```

### Versioning Strategy
Version the API when introducing breaking changes (removing fields, changing types, renaming endpoints). Non-breaking additions (new optional fields, new endpoints) do not require a version bump.

- Prefer URL path versioning: `/v1/sessions`, `/v2/sessions`. It is explicit, easy to route, and visible in logs.
- Header versioning (`Accept: application/vnd.kadmon.v2+json`) is an alternative when URL changes are undesirable, but harder to debug.
- Never mix versioning strategies in the same service.

### Authentication Middleware
Protect routes by validating tokens before the handler executes. This prevents business logic from running on unauthenticated requests.

```typescript
async function requireAuth(req: Request): Promise<AuthContext> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) throw new ApiError(ErrorCode.UNAUTHORIZED, 'Missing token');
  const payload = await verifyToken(token);
  if (!payload) throw new ApiError(ErrorCode.UNAUTHORIZED, 'Invalid token');
  return payload;
}
```

### Pagination
Every list endpoint must be paginated. Unpaginated lists are ticking time bombs — they work fine with 10 rows and crash the server with 10,000.

**Cursor-based** (preferred for real-time data, no offset drift):
```
GET /sessions?cursor=abc123&limit=20
Response meta: { total: 150, cursor: "def456" }
```

**Offset-based** (simpler, acceptable for stable data):
```
GET /instincts?limit=10&offset=20
Response meta: { total: 85 }
```

Use cursor-based when rows are frequently inserted or deleted (sessions, observations). Use offset-based when the dataset is stable and the client needs random page access (instincts, cost reports).

## Anti-Patterns

| Anti-Pattern | Why It Fails | Do This Instead |
|---|---|---|
| Inconsistent error formats | Clients need a different error handler per endpoint, bugs multiply | Use the ApiResponse envelope for every response |
| No input validation | Invalid data reaches the database, causes cryptic SQL errors | Validate with Zod at the boundary, before any logic |
| SELECT * in API queries | Returns internal columns (created_at, internal flags) the client should never see | Select only the columns the response needs |
| No pagination on list endpoints | Works in dev, crashes in production when data grows | Always paginate, default limit of 20-50 |
| Verbs in URLs | `/getSession/123`, `/createInstinct` breaks REST conventions | Use nouns with HTTP methods: `GET /sessions/123`, `POST /instincts` |
| Returning 200 for errors | Clients cannot distinguish success from failure by status code | Use appropriate status codes: 4xx for client errors, 5xx for server errors |
| Exposing internal error details | Stack traces and SQL errors leak implementation details to attackers | Return generic message, log details server-side |
| No versioning plan | First breaking change forces an ad-hoc, inconsistent migration | Design with /v1/ prefix from the start |

## Integration
- **code-reviewer agent** checks API patterns, response consistency, and Zod validation usage via /code-review and /checkpoint
- **architect agent** designs API boundaries and service interfaces during /kplan for multi-component systems
- **security-reviewer agent** auto-invokes for endpoints handling auth, user input, or API keys
- **types.ts** defines the TypeScript interfaces that API responses must reference — never invent ad-hoc shapes
- **Zod schemas** serve double duty: runtime validation at the boundary and `z.infer<>` for static type inference

## Rules
- Validate all inputs with Zod at the API boundary — before business logic
- Return the consistent ApiResponse envelope format for every endpoint
- Use meaningful HTTP status codes (201 for create, 422 for validation, 204 for delete)
- Version APIs with URL path prefix (/v1/) when introducing breaking changes
- Paginate every list endpoint — no exceptions
- Never expose internal error details (stack traces, SQL errors) in responses
- Protect sensitive endpoints with authentication middleware
- Select only needed columns — never SELECT * in API-facing queries
- Use `z.infer<typeof Schema>` to derive types from Zod schemas (single source of truth)

## no_context Application
API design must reference actual data types from types.ts — never invent request/response shapes. Before designing an endpoint, read the existing interfaces, state-store.ts query functions, and any existing endpoints to ensure consistency with established patterns.
