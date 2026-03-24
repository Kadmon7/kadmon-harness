---
name: database-migrations
description: Use when modifying database schemas or creating new tables
---

# Database Migrations

Safe schema evolution for SQLite and Supabase.

## When to Use
- Adding new tables or columns
- Modifying existing schemas
- Preparing for Supabase sync (v2)

## How It Works

### SQLite (v1)
Schema lives in `scripts/lib/schema.sql`. Changes are applied via `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` — idempotent by design.

### Supabase (v2, future)
Migrations live in `supabase/migrations/NNN_description.sql`. Forward-only, sequential numbering.

### Migration Checklist
1. Add new table/column with IF NOT EXISTS
2. Add indexes for foreign keys and common queries
3. Test with :memory: SQLite
4. Update TypeScript interfaces in types.ts
5. Update state-store.ts with new CRUD functions
6. Write tests for new operations

## Examples

### Adding a new column to instincts
```sql
-- In schema.sql (idempotent)
ALTER TABLE instincts ADD COLUMN tags TEXT DEFAULT '[]';
-- Note: SQLite ALTER TABLE is limited — may need to recreate table
```

### Supabase migration (v2)
```sql
-- supabase/migrations/002_add_instinct_tags.sql
ALTER TABLE instincts ADD COLUMN tags JSONB DEFAULT '[]';
CREATE INDEX idx_instincts_tags ON instincts USING GIN (tags);
```

## Rules
- Always use IF NOT EXISTS for SQLite
- Test migrations against :memory: database
- Update TypeScript interfaces when schema changes
- Never modify existing migration files — create new ones

## no_context Application
Before modifying a schema, read the current schema.sql and types.ts to understand the existing structure. Never add columns that duplicate existing fields.