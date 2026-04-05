---
name: postgres-patterns
description: PostgreSQL, Supabase, and pgvector best practices — indexes, RLS, upserts, vector search, JSONB, data types, queue processing. Use this skill whenever writing SQL queries, designing schemas, adding indexes, configuring Row Level Security, implementing similarity search with pgvector, or working on ToratNetz embeddings. Also use when the user mentions "query", "index", "RLS", "vector", "embedding", "Supabase", or "postgres". Covers the patterns that orakle agent checks for.
---

# PostgreSQL Patterns

PostgreSQL best practices for Supabase and pgvector.

## When to Use
- Designing database schemas
- Writing or optimizing queries
- Implementing pgvector similarity search
- Configuring Row Level Security (RLS)
- Troubleshooting slow queries

## Data Type Quick Reference

| Use Case | Correct Type | Avoid |
|----------|-------------|-------|
| IDs | `bigint` (sequential) or `uuid` | `int` (overflows) |
| Strings | `text` | `varchar(255)` (arbitrary limit) |
| Timestamps | `timestamptz` | `timestamp` (no timezone) |
| Money | `numeric(10,2)` | `float` (rounding errors) |
| Flags | `boolean` | `varchar`, `int` |
| Documents | `jsonb` | `json` (not indexable) |

## Index Cheat Sheet

| Query Pattern | Index Type | Example |
|--------------|------------|---------|
| `WHERE x = ?` (exact) | B-tree (default) | `CREATE INDEX idx ON t (x)` |
| `WHERE x > ?` (range) | B-tree | `CREATE INDEX idx ON t (x)` |
| `WHERE a = ? AND b > ?` | Composite | `CREATE INDEX idx ON t (a, b)` |
| `WHERE jsonb @> '{}'` | GIN | `CREATE INDEX idx ON t USING gin (col)` |
| `WHERE tsv @@ query` | GIN on tsvector | `CREATE INDEX idx ON t USING gin (col)` |
| Time-series ranges | BRIN | `CREATE INDEX idx ON t USING brin (created_at)` |
| Vector similarity | IVFFlat or HNSW | See pgvector section |

### Composite Index Order
```sql
-- Equality columns first, then range columns
CREATE INDEX idx ON orders (status, created_at);
-- Works for: WHERE status = 'pending' AND created_at > '2024-01-01'
```

### Covering Index
```sql
CREATE INDEX idx ON users (email) INCLUDE (name, created_at);
-- Avoids table lookup for SELECT email, name, created_at
```

### Partial Index
```sql
CREATE INDEX idx ON users (email) WHERE deleted_at IS NULL;
-- Smaller index, only includes active users
```

## Common Patterns

### Upsert
```sql
INSERT INTO sessions (id, project_hash, started_at)
VALUES ($1, $2, NOW())
ON CONFLICT (id) DO UPDATE SET
  project_hash = EXCLUDED.project_hash;
```

### Cursor Pagination
```sql
SELECT * FROM instincts
WHERE created_at < $1
ORDER BY created_at DESC
LIMIT 20;
-- O(1) vs OFFSET which is O(n)
```

### RLS Policy (Optimized)
```sql
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own sessions"
  ON sessions FOR SELECT
  USING ((SELECT auth.uid()) = user_id);  -- Wrap in SELECT for performance
```

### Queue Processing
```sql
UPDATE jobs SET status = 'processing'
WHERE id = (
  SELECT id FROM jobs WHERE status = 'pending'
  ORDER BY created_at LIMIT 1
  FOR UPDATE SKIP LOCKED
) RETURNING *;
-- Atomic job pickup, safe for concurrent workers
```

## pgvector

```sql
-- Create extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column
ALTER TABLE chunks ADD COLUMN embedding vector(1536);

-- Create index (IVFFlat for large datasets)
CREATE INDEX ON chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Similarity search
SELECT *, 1 - (embedding <=> $1) AS similarity
FROM chunks
ORDER BY embedding <=> $1
LIMIT 5;
```

## Anti-Pattern Detection Queries

```sql
-- Find unindexed foreign keys
SELECT conrelid::regclass, a.attname
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
  );

-- Find slow queries (requires pg_stat_statements)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- Check table bloat
SELECT relname, n_dead_tup, last_vacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

## Gotchas
- Always use `timestamptz` over `timestamp` -- timezone-naive timestamps cause silent bugs in multi-timezone deployments
- `text` is preferred over `varchar(n)` -- PostgreSQL handles them identically internally, and arbitrary limits cause migration headaches
- Wrap `auth.uid()` in a subquery `(SELECT auth.uid())` in RLS policies -- without the wrap, it evaluates per-row instead of once
- IVFFlat indexes need re-creation when data distribution changes significantly. HNSW is more stable but uses more memory
- `EXPLAIN ANALYZE` is your friend -- always test queries before deploying
- Connection pooling (Supavisor/PgBouncer) is essential for serverless -- direct connections exhaust `max_connections`

## Rules
- Always index foreign keys
- Use JSONB over JSON (indexable, faster)
- Set appropriate LIMIT on all queries
- Use parameterized queries -- never string concatenation
- Test queries with EXPLAIN ANALYZE before deploying

## no_context Application
Before writing queries, read the actual schema (schema.sql or Supabase dashboard). Never assume table structure or column names.
