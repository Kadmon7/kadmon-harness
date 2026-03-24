---
name: postgres-patterns
description: Use when working with PostgreSQL, Supabase, or pgvector databases
---

# PostgreSQL Patterns

PostgreSQL best practices for Supabase and pgvector.

## When to Use
- Designing database schemas
- Writing queries
- Implementing pgvector similarity search
- Configuring Row Level Security (RLS)

## How It Works

### Index Cheat Sheet
| Query Pattern | Index Type |
|--------------|-----------|
| Exact match (WHERE x = ?) | B-tree (default) |
| Range (WHERE x > ?) | B-tree |
| Full text search | GIN on tsvector |
| JSON containment | GIN on JSONB |
| Vector similarity | IVFFlat or HNSW |

### Common Patterns

#### Upsert
```sql
INSERT INTO sessions (id, project_hash, started_at)
VALUES ($1, $2, NOW())
ON CONFLICT (id) DO UPDATE SET
  project_hash = EXCLUDED.project_hash;
```

#### Cursor Pagination
```sql
SELECT * FROM instincts
WHERE created_at < $1
ORDER BY created_at DESC
LIMIT 20;
```

#### RLS Policy
```sql
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own sessions"
  ON sessions FOR SELECT
  USING (auth.uid() = user_id);
```

### pgvector
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

## Rules
- Always index foreign keys
- Use JSONB over JSON (indexable, faster)
- Set appropriate LIMIT on all queries
- Use parameterized queries — never string concatenation
- Test queries with EXPLAIN ANALYZE before deploying

## no_context Application
Before writing queries, read the actual schema (schema.sql or Supabase dashboard). Never assume table structure or column names.