---
name: api-design
description: Use when designing REST APIs, RPC endpoints, or service interfaces
---

# API Design

RESTful and RPC API design patterns for TypeScript services.

## When to Use
- Designing new API endpoints
- Reviewing existing API structure
- Planning Supabase Edge Functions
- Designing service boundaries

## How It Works

### REST Conventions
- Resources as nouns: `/sessions`, `/instincts`
- HTTP methods: GET (read), POST (create), PUT (replace), PATCH (update), DELETE (remove)
- Status codes: 200 (ok), 201 (created), 400 (bad request), 404 (not found), 500 (server error)
- Pagination: `?limit=10&offset=0`

### Response Envelope
```typescript
interface ApiResponse<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  meta?: { total: number; page: number };
}
```

### Validation
```typescript
import { z } from 'zod';
const CreateSessionSchema = z.object({
  projectHash: z.string().length(16),
  branch: z.string().min(1),
});
```

## Rules
- Validate all inputs with Zod at the boundary
- Return consistent envelope format
- Use meaningful HTTP status codes
- Version APIs when breaking changes are needed

## no_context Application
API design must reference actual data types from types.ts — never invent request/response shapes.