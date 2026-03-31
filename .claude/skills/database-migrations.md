---
name: database-migrations
description: Safe schema evolution for SQLite and Supabase — idempotent migrations, IF NOT EXISTS guards, TypeScript interface sync, rollback strategies. Use this skill whenever adding tables, columns, or indexes to schema.sql or supabase/migrations/, when the user mentions "new table", "add column", "schema change", "migration", "ALTER TABLE", or "rollback". Also use when types.ts interfaces need to match a schema update, when preparing data for Supabase v2 sync, or when state-store.ts CRUD functions change. Even small schema tweaks benefit from this checklist because SQLite ALTER TABLE is severely limited and one wrong move can corrupt data.
---

# Database Migrations

Safe schema evolution for SQLite and Supabase. Schema changes are the riskiest operations in the harness because they touch persistent user data. A bad migration without backup can destroy sessions, instincts, and cost history permanently.

## When to Use
- Adding new tables or columns to schema.sql
- Modifying existing schemas (column types, constraints, indexes)
- Preparing for Supabase sync (v2)
- Updating TypeScript interfaces after schema changes
- Adding CRUD functions to state-store.ts for new entities

## How It Works

### SQLite (v1)
Schema lives in `scripts/lib/schema.sql`. Changes are applied via `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` — idempotent by design. The database file lives at `~/.kadmon/kadmon.db` (never in the project directory).

### SQLite ALTER TABLE Limitations
SQLite only supports `ALTER TABLE ... ADD COLUMN`. It cannot DROP columns, RENAME columns (older versions), or change column types. When you need to do any of these, use the table recreation pattern:

1. Create a new table with the desired schema
2. Copy data from the old table: `INSERT INTO new_table SELECT ... FROM old_table`
3. Drop the old table: `DROP TABLE old_table`
4. Rename: `ALTER TABLE new_table RENAME TO old_table`
5. Recreate indexes and triggers

This matters because developers coming from PostgreSQL or MySQL expect ALTER TABLE to do more than SQLite allows, leading to silent failures or runtime errors.

### Supabase (v2, future)
Migrations live in `supabase/migrations/NNN_description.sql`. Forward-only, sequential numbering. Never modify a migration that has already been applied.

### Rollback Strategy
SQLite has no built-in migration rollback mechanism. Protect yourself:
- Always back up `~/.kadmon/kadmon.db` before running a migration
- Keep a `down` migration script alongside each `up` migration for complex changes
- For simple ADD COLUMN changes, rollback is unnecessary (the column is ignored if unused)
- For table recreation, the backup IS the rollback

### Migration Checklist
1. Back up the database file (copy `~/.kadmon/kadmon.db`)
2. Add new table/column with IF NOT EXISTS guard
3. Add indexes for foreign keys and common query patterns
4. Handle existing data (see Data Migration Patterns below)
5. Test with `:memory:` SQLite — never touch production DB in tests
6. Update TypeScript interfaces in `types.ts`
7. Update `state-store.ts` with new CRUD functions and mapping functions
8. Write tests for new operations (arrange-act-assert with `:memory:`)
9. Run `npm run build` so lifecycle hooks pick up the compiled changes

## Examples

### Adding a nullable column (safe, simple)
```sql
-- In schema.sql (idempotent, no data migration needed)
ALTER TABLE instincts ADD COLUMN tags TEXT DEFAULT '[]';
```

### Adding a NOT NULL column to existing data
```sql
-- Step 1: Add as nullable with default
ALTER TABLE sessions ADD COLUMN project_name TEXT DEFAULT 'unknown';
-- Step 2: Backfill existing rows
UPDATE sessions SET project_name = 'kadmon-harness' WHERE project_name = 'unknown';
-- Never add NOT NULL without a DEFAULT on a table with existing rows.
-- SQLite will reject the ALTER TABLE entirely.
```

### Table recreation (DROP/RENAME column workaround)
```sql
CREATE TABLE instincts_new (
  id TEXT PRIMARY KEY,
  project_hash TEXT NOT NULL,
  pattern TEXT NOT NULL,
  action TEXT NOT NULL,
  confidence REAL DEFAULT 0.3
  -- dropped: old_column that is no longer needed
);
INSERT INTO instincts_new (id, project_hash, pattern, action, confidence)
  SELECT id, project_hash, pattern, action, confidence FROM instincts;
DROP TABLE instincts;
ALTER TABLE instincts_new RENAME TO instincts;
CREATE INDEX idx_instincts_project ON instincts(project_hash);
```

### Supabase migration (v2)
```sql
-- supabase/migrations/002_add_instinct_tags.sql
ALTER TABLE instincts ADD COLUMN tags JSONB DEFAULT '[]';
CREATE INDEX idx_instincts_tags ON instincts USING GIN (tags);
```

## Anti-Patterns

| Anti-Pattern | Why It Fails | Do This Instead |
|---|---|---|
| Modifying an existing migration file | Already-applied migrations will not re-run, causing schema drift | Create a new migration file |
| No backup before schema change | One bad ALTER TABLE and all user data is gone | Copy the .db file before any migration |
| Forgetting to update TypeScript interfaces | Runtime type mismatches between code and database | Update types.ts and state-store.ts mapping functions in the same commit |
| Adding NOT NULL without DEFAULT on populated table | SQLite rejects the entire ALTER TABLE statement | Add as nullable with DEFAULT, then backfill |
| Using DROP COLUMN directly | SQLite does not support it — the statement will error | Use the table recreation pattern |
| Running migrations against production DB in tests | Corrupts real user data | Always use `:memory:` in tests via KADMON_TEST_DB |
| Skipping `npm run build` after schema changes | Lifecycle hooks import from dist/ and will use stale compiled code | Run build after every schema-related change |

## Integration
- **database-reviewer agent** auto-invokes when editing SQL, schema, or Supabase client files and checks migration safety
- **state-store.ts** is the primary consumer — all schema changes must be reflected in its CRUD functions and row-mapping functions (mapSessionRow, mapInstinctRow)
- **types.ts** defines the TypeScript interfaces that must stay in sync with SQL columns (camelCase in TS, snake_case in SQL)
- **post-edit-typecheck hook** catches type mismatches between interfaces and state-store after edits

## Rules
- Always use IF NOT EXISTS for SQLite CREATE statements
- Always back up the database before destructive schema changes
- Test migrations against `:memory:` database — never production
- Update TypeScript interfaces and state-store.ts in the same commit as schema changes
- Never modify existing Supabase migration files — create new ones
- Run `npm run build` after changing scripts/lib/ so lifecycle hooks get the update
- Use parameterized queries for all data migration UPDATEs (prevent SQL injection)

## no_context Application
Before modifying a schema, read the current `schema.sql`, `types.ts`, and `state-store.ts` to understand the existing structure. Never add columns that duplicate existing fields. Never assume a column exists without checking the schema first — use `PRAGMA table_info(table_name)` to verify.
