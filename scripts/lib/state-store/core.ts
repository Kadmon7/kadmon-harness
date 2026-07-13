// Kadmon Harness — SQLite State Store: core (sql.js wrapper + singleton)
// Adapted from ECC's state-store wrapper pattern.
// camelCase interfaces ↔ snake_case SQL columns.
//
// This is the leaf module of the state-store package (AUD-37 split): it owns
// the sql.js wrapper, the DB singleton, schema apply + forward migrations, and
// the shared parseJson helper. Domain modules (sessions, instincts, …) import
// getDb + parseJson from here; nothing imports back into them, so the DAG is
// acyclic. The public facade at ../state-store.ts re-exports openDb/getDb/closeDb.

import fs from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";
import { kadmonDataDir, ensureDir } from "../utils.js";

// ─── sql.js wrapper (adapted from ECC) ───

interface WrappedDb {
  exec(sql: string): void;
  pragma(pragmaStr: string): void;
  prepare(sql: string): {
    all(...args: unknown[]): Record<string, unknown>[];
    get(...args: unknown[]): Record<string, unknown> | null;
    run(params?: Record<string, unknown>): void;
  };
  transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T;
  close(): void;
}

function wrapSqlJsDb(
  rawDb: InstanceType<Awaited<ReturnType<typeof initSqlJs>>["Database"]>,
  dbPath: string,
): WrappedDb {
  let inTransaction = false;
  // Tracks whether any mutation happened since the last disk write. Without
  // it, close() on a read-only consumer (e.g. medik-checks-cli diagnostics)
  // would overwrite the DB file with a stale in-memory snapshot and clobber
  // concurrent-session writes (orakle 2026-07-12 WARN).
  let dirty = false;

  function saveToDisk(): void {
    if (dbPath === ":memory:" || inTransaction || !dirty) return;
    const data = rawDb.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
    dirty = false;
  }

  return {
    exec(sql: string) {
      rawDb.run(sql);
      dirty = true;
      saveToDisk();
    },

    pragma(pragmaStr: string) {
      try {
        rawDb.run(`PRAGMA ${pragmaStr}`);
      } catch {
        /* ignore unsupported */
      }
    },

    prepare(sql: string) {
      return {
        all(...positionalArgs: unknown[]): Record<string, unknown>[] {
          const stmt = rawDb.prepare(sql);
          if (
            positionalArgs.length === 1 &&
            typeof positionalArgs[0] !== "object"
          ) {
            stmt.bind([positionalArgs[0] as number | string]);
          } else if (positionalArgs.length > 1) {
            stmt.bind(positionalArgs as (number | string)[]);
          }
          const rows: Record<string, unknown>[] = [];
          while (stmt.step())
            rows.push(stmt.getAsObject() as Record<string, unknown>);
          stmt.free();
          return rows;
        },

        get(...positionalArgs: unknown[]): Record<string, unknown> | null {
          const stmt = rawDb.prepare(sql);
          if (
            positionalArgs.length === 1 &&
            typeof positionalArgs[0] !== "object"
          ) {
            stmt.bind([positionalArgs[0] as number | string]);
          } else if (positionalArgs.length > 1) {
            stmt.bind(positionalArgs as (number | string)[]);
          }
          let row: Record<string, unknown> | null = null;
          if (stmt.step()) row = stmt.getAsObject() as Record<string, unknown>;
          stmt.free();
          return row;
        },

        run(namedParams?: Record<string, unknown>) {
          const stmt = rawDb.prepare(sql);
          if (
            namedParams &&
            typeof namedParams === "object" &&
            !Array.isArray(namedParams)
          ) {
            const sqlJsParams: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(namedParams)) {
              sqlJsParams[`@${key}`] = value === undefined ? null : value;
            }
            stmt.bind(sqlJsParams);
          }
          stmt.step();
          stmt.free();
          dirty = true;
          saveToDisk();
        },
      };
    },

    transaction<T>(fn: (...args: unknown[]) => T) {
      return (...args: unknown[]): T => {
        rawDb.run("BEGIN");
        inTransaction = true;
        try {
          const result = fn(...args);
          rawDb.run("COMMIT");
          inTransaction = false;
          saveToDisk();
          return result;
        } catch (error) {
          try {
            rawDb.run("ROLLBACK");
          } catch {
            /* already rolled back */
          }
          inTransaction = false;
          throw error;
        }
      };
    },

    close() {
      saveToDisk();
      rawDb.close();
    },
  };
}

// ─── Database singleton ───

let db: WrappedDb | null = null;
let dbPath: string = "";

export async function openDb(customPath?: string): Promise<WrappedDb> {
  if (db) return db;

  dbPath = customPath ?? path.join(kadmonDataDir(), "kadmon.db");

  if (dbPath !== ":memory:") {
    ensureDir(path.dirname(dbPath));
  }

  const SQL = await initSqlJs();

  let rawDb: InstanceType<typeof SQL.Database>;
  if (dbPath !== ":memory:" && fs.existsSync(dbPath)) {
    rawDb = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    rawDb = new SQL.Database();
  }

  db = wrapSqlJsDb(rawDb, dbPath);
  // Capture the just-assigned singleton in a local const so the transaction
  // closure below does not need a non-null assertion on the module-level `db`
  // (TypeScript cannot narrow a `let db: WrappedDb | null` across closure
  // boundaries). See rules/common/coding-style.md — no `!` without justification.
  const localDb = db;
  localDb.pragma("foreign_keys = ON");
  localDb.pragma("journal_mode = WAL");

  // AUD-29 forward migration: pre-existing on-disk DBs created before the
  // tool_use_id column + 4-col natural-key index landed (Wave 3 cluster A)
  // still carry the OLD 3-col agent_invocations schema. The CREATE TABLE /
  // CREATE UNIQUE INDEX IF NOT EXISTS statements in the schema-apply step
  // below are gated by NAME only, not definition — on such a DB they would
  // silently no-op, leaving tool_use_id missing and the index 3-col. That
  // breaks the ADR-022 dedup sentinel immediately below (its
  // COALESCE(tool_use_id, '') GROUP BY throws "no such column: tool_use_id")
  // and later insertAgentInvocation()'s 4-col ON CONFLICT target. Runs
  // BEFORE the dedup sentinel so its column reference is valid, and OUTSIDE
  // the schema-apply transaction() below — a migration failure here must
  // not roll into that transaction's scope (orakle 2026-07-13 sql.js note).
  // Idempotent across all three DB states:
  //   - fresh :memory:/on-disk DB: ALTER throws "no such table" (caught);
  //     DROP INDEX IF EXISTS no-ops; schema-apply creates the 4-col table+index.
  //   - unmigrated on-disk DB: ALTER adds the column; DROP removes the
  //     stale 3-col index so CREATE UNIQUE INDEX IF NOT EXISTS below
  //     recreates it 4-col.
  //   - already-migrated DB: ALTER throws "duplicate column" (caught);
  //     DROP+recreate is a no-op replay of the same 4-col definition.
  try {
    localDb.exec(`ALTER TABLE agent_invocations ADD COLUMN tool_use_id TEXT;`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/duplicate column|no such table/i.test(msg)) {
      throw err;
    }
  }
  try {
    localDb.exec(`DROP INDEX IF EXISTS idx_agent_invocations_natural_key;`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/no such table/i.test(msg)) {
      throw err;
    }
  }

  // ADR-022 migration sentinel: existing DBs may contain duplicate rows in
  // hook_events / agent_invocations from sessions persisted before the UNIQUE
  // INDEX was added. Dedup BEFORE schema apply so `CREATE UNIQUE INDEX` does
  // not fail on pre-existing duplicates. The catch is narrowed to only swallow
  // "no such table" errors (fresh DB) — all other failures (corruption,
  // disk-full, I/O) are surfaced so upstream visibility is preserved
  // (spektr 2026-04-22 MEDIUM).
  try {
    localDb.exec(
      `DELETE FROM hook_events WHERE rowid NOT IN (
         SELECT MIN(rowid) FROM hook_events
         GROUP BY session_id, hook_name, event_type, timestamp
       );`,
    );
    localDb.exec(
      `DELETE FROM agent_invocations WHERE rowid NOT IN (
         SELECT MIN(rowid) FROM agent_invocations
         GROUP BY session_id, agent_type, timestamp, COALESCE(tool_use_id, '')
       );`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/no such table/i.test(msg)) {
      // Re-throw non-fresh-DB errors (disk full, corruption, I/O) so they
      // surface instead of silently masking a DB-health problem.
      throw err;
    }
    // Fresh DB — tables will be created by the schema apply below
  }

  // Apply schema — one saveToDisk() at commit instead of one per statement.
  // schema.sql lives one dir up (dist/scripts/lib/schema.sql, copied by the
  // build); this module is dist/scripts/lib/state-store/core.js, so resolve
  // via ".." (AUD-37 split — the ONE non-mechanical edit vs the pre-split file).
  const { fileURLToPath } = await import("node:url");
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.join(thisDir, "..", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  const stmts = schema.split(";").filter((s) => s.trim());
  localDb.transaction(() => {
    for (const stmt of stmts) {
      localDb.exec(stmt + ";");
    }
  })();

  return localDb;
}

export function getDb(): WrappedDb {
  if (!db) throw new Error("Database not opened. Call openDb() first.");
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ─── JSON helpers ───

export function parseJson<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined || val === "") return fallback;
  try {
    return JSON.parse(String(val)) as T;
  } catch {
    return fallback;
  }
}
