// Kadmon Harness — SQLite State Store (sql.js)
// Adapted from ECC's state-store wrapper pattern.
// camelCase interfaces ↔ snake_case SQL columns.

import fs from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";
import type {
  Instinct,
  SessionSummary,
  CostEvent,
  SyncQueueEntry,
  HookEvent,
  AgentInvocation,
  ResearchReport,
} from "./types.js";
import { kadmonDataDir, generateId, nowISO, ensureDir } from "./utils.js";

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

  function saveToDisk(): void {
    if (dbPath === ":memory:" || inTransaction) return;
    const data = rawDb.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }

  return {
    exec(sql: string) {
      rawDb.run(sql);
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

  // Apply schema — one saveToDisk() at commit instead of one per statement
  const { fileURLToPath } = await import("node:url");
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.join(thisDir, "schema.sql");
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

function parseJson<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined || val === "") return fallback;
  try {
    return JSON.parse(String(val)) as T;
  } catch {
    return fallback;
  }
}

// ─── Session operations (camelCase ↔ snake_case) ───

function mapSessionRow(row: Record<string, unknown>): SessionSummary {
  return {
    id: String(row.id),
    projectHash: String(row.project_hash),
    startedAt: String(row.started_at ?? ""),
    endedAt: String(row.ended_at ?? ""),
    durationMs: Number(row.duration_ms ?? 0),
    branch: String(row.branch ?? ""),
    tasks: parseJson(row.tasks, []),
    filesModified: parseJson(row.files_modified, []),
    toolsUsed: parseJson(row.tools_used, []),
    messageCount: Number(row.message_count ?? 0),
    totalInputTokens: Number(row.total_input_tokens ?? 0),
    totalOutputTokens: Number(row.total_output_tokens ?? 0),
    estimatedCostUsd: Number(row.estimated_cost_usd ?? 0),
    instinctsCreated: parseJson(row.instincts_created, []),
    compactionCount: Number(row.compaction_count ?? 0),
    summary: row.summary ? String(row.summary) : undefined,
  };
}

export function upsertSession(
  session: Partial<SessionSummary> & { id: string },
): void {
  getDb()
    .prepare(
      `
    INSERT INTO sessions (id, project_hash, started_at, ended_at, duration_ms, branch,
      tasks, files_modified, tools_used, message_count, total_input_tokens,
      total_output_tokens, estimated_cost_usd, instincts_created, compaction_count, summary)
    VALUES (@id, @project_hash, @started_at, @ended_at, @duration_ms, @branch,
      @tasks, @files_modified, @tools_used, @message_count, @total_input_tokens,
      @total_output_tokens, @estimated_cost_usd, @instincts_created, @compaction_count, @summary)
    ON CONFLICT(id) DO UPDATE SET
      project_hash = COALESCE(excluded.project_hash, sessions.project_hash),
      started_at = COALESCE(excluded.started_at, sessions.started_at),
      ended_at = COALESCE(excluded.ended_at, sessions.ended_at),
      duration_ms = COALESCE(excluded.duration_ms, sessions.duration_ms),
      branch = COALESCE(excluded.branch, sessions.branch),
      tasks = COALESCE(excluded.tasks, sessions.tasks),
      files_modified = COALESCE(excluded.files_modified, sessions.files_modified),
      tools_used = COALESCE(excluded.tools_used, sessions.tools_used),
      message_count = COALESCE(excluded.message_count, sessions.message_count),
      total_input_tokens = COALESCE(excluded.total_input_tokens, sessions.total_input_tokens),
      total_output_tokens = COALESCE(excluded.total_output_tokens, sessions.total_output_tokens),
      estimated_cost_usd = COALESCE(excluded.estimated_cost_usd, sessions.estimated_cost_usd),
      instincts_created = COALESCE(excluded.instincts_created, sessions.instincts_created),
      compaction_count = COALESCE(excluded.compaction_count, sessions.compaction_count),
      summary = COALESCE(excluded.summary, sessions.summary)
  `,
    )
    .run({
      id: session.id,
      project_hash: session.projectHash ?? "",
      started_at: session.startedAt ?? nowISO(),
      ended_at: session.endedAt ?? null,
      duration_ms: session.durationMs ?? null,
      branch: session.branch ?? null,
      tasks: JSON.stringify(session.tasks ?? []),
      files_modified: JSON.stringify(session.filesModified ?? []),
      tools_used: JSON.stringify(session.toolsUsed ?? []),
      message_count: session.messageCount ?? 0,
      total_input_tokens: session.totalInputTokens ?? 0,
      total_output_tokens: session.totalOutputTokens ?? 0,
      estimated_cost_usd: session.estimatedCostUsd ?? 0,
      instincts_created: JSON.stringify(session.instinctsCreated ?? []),
      compaction_count: session.compactionCount ?? 0,
      summary: session.summary ?? null,
    });
}

export function getSession(id: string): SessionSummary | null {
  const row = getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id);
  return row ? mapSessionRow(row) : null;
}

export function getRecentSessions(
  projectHash: string,
  limit = 10,
): SessionSummary[] {
  return getDb()
    .prepare(
      "SELECT * FROM sessions WHERE project_hash = ? ORDER BY started_at DESC, rowid DESC LIMIT ?",
    )
    .all(projectHash, limit)
    .map(mapSessionRow);
}

export function getOrphanedSessions(
  projectHash: string,
  excludeSessionId: string,
  limit = 1,
): SessionSummary[] {
  return getDb()
    .prepare(
      `SELECT * FROM sessions
       WHERE project_hash = ? AND (ended_at IS NULL OR ended_at = '')
         AND id != ? ORDER BY started_at DESC, rowid DESC LIMIT ?`,
    )
    .all(projectHash, excludeSessionId, limit)
    .map(mapSessionRow);
}

export function deleteSession(id: string): boolean {
  const db = getDb();
  const session = db.prepare("SELECT id FROM sessions WHERE id = ?").get(id);
  if (!session) return false;
  const txn = db.transaction(() => {
    db.prepare("DELETE FROM cost_events WHERE session_id = @id").run({ id });
    db.prepare("DELETE FROM hook_events WHERE session_id = @id").run({ id });
    db.prepare("DELETE FROM agent_invocations WHERE session_id = @id").run({
      id,
    });
    db.prepare("DELETE FROM sessions WHERE id = @id").run({ id });
  });
  txn();
  return true;
}

export function cleanupTestSessions(projectHash?: string): number {
  const db = getDb();
  const baseQuery = `SELECT id FROM sessions
    WHERE id LIKE 'test-%' AND message_count = 0
      AND (ended_at IS NOT NULL AND ended_at != '')`;
  const rows = projectHash
    ? db.prepare(`${baseQuery} AND project_hash = ?`).all(projectHash)
    : db.prepare(baseQuery).all();

  let deleted = 0;
  const txn = db.transaction(() => {
    for (const row of rows) {
      const sid = String(row.id);
      db.prepare("DELETE FROM cost_events WHERE session_id = @id").run({
        id: sid,
      });
      db.prepare("DELETE FROM hook_events WHERE session_id = @id").run({
        id: sid,
      });
      db.prepare("DELETE FROM agent_invocations WHERE session_id = @id").run({
        id: sid,
      });
      db.prepare("DELETE FROM sessions WHERE id = @id").run({ id: sid });
      deleted++;
    }
  });
  txn();
  return deleted;
}

// ─── Instinct operations ───

function mapInstinctRow(row: Record<string, unknown>): Instinct {
  return {
    id: String(row.id),
    projectHash: String(row.project_hash),
    pattern: String(row.pattern),
    action: String(row.action),
    confidence: Number(row.confidence),
    occurrences: Number(row.occurrences),
    contradictions: Number(row.contradictions),
    sourceSessions: parseJson(row.source_sessions, []),
    status: String(row.status) as Instinct["status"],
    scope: String(row.scope) as Instinct["scope"],
    domain: row.domain ? String(row.domain) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastObservedAt: row.last_observed_at
      ? String(row.last_observed_at)
      : undefined,
    promotedTo: row.promoted_to ? String(row.promoted_to) : undefined,
  };
}

export function upsertInstinct(
  instinct: Partial<Instinct> & { id: string },
): void {
  getDb()
    .prepare(
      `
    INSERT INTO instincts (id, project_hash, pattern, action, confidence, occurrences,
      contradictions, source_sessions, status, scope, domain, promoted_to, created_at, updated_at, last_observed_at)
    VALUES (@id, @project_hash, @pattern, @action, @confidence, @occurrences,
      @contradictions, @source_sessions, @status, @scope, @domain, @promoted_to, @created_at, @updated_at, @last_observed_at)
    ON CONFLICT(id) DO UPDATE SET
      confidence = excluded.confidence,
      occurrences = excluded.occurrences,
      contradictions = excluded.contradictions,
      source_sessions = excluded.source_sessions,
      status = excluded.status,
      scope = excluded.scope,
      domain = COALESCE(excluded.domain, instincts.domain),
      promoted_to = excluded.promoted_to,
      updated_at = excluded.updated_at,
      last_observed_at = COALESCE(excluded.last_observed_at, instincts.last_observed_at)
  `,
    )
    .run({
      id: instinct.id,
      project_hash: instinct.projectHash ?? "",
      pattern: instinct.pattern ?? "",
      action: instinct.action ?? "",
      confidence: instinct.confidence ?? 0.3,
      occurrences: instinct.occurrences ?? 1,
      contradictions: instinct.contradictions ?? 0,
      source_sessions: JSON.stringify(instinct.sourceSessions ?? []),
      status: instinct.status ?? "active",
      scope: instinct.scope ?? "project",
      domain: instinct.domain ?? null,
      promoted_to: instinct.promotedTo ?? null,
      created_at: instinct.createdAt ?? nowISO(),
      updated_at: instinct.updatedAt ?? nowISO(),
      last_observed_at: instinct.lastObservedAt ?? null,
    });
}

export function getInstinct(id: string): Instinct | null {
  const row = getDb().prepare("SELECT * FROM instincts WHERE id = ?").get(id);
  return row ? mapInstinctRow(row) : null;
}

export function getActiveInstincts(projectHash: string): Instinct[] {
  return getDb()
    .prepare(
      "SELECT * FROM instincts WHERE project_hash = ? AND status = 'active' ORDER BY confidence DESC, rowid DESC",
    )
    .all(projectHash)
    .map(mapInstinctRow);
}

export function getPromotableInstincts(projectHash: string): Instinct[] {
  return getDb()
    .prepare(
      "SELECT * FROM instincts WHERE project_hash = ? AND status = 'active' AND confidence >= 0.7 AND occurrences >= 3 ORDER BY confidence DESC, rowid DESC",
    )
    .all(projectHash)
    .map(mapInstinctRow);
}

export function getInstinctCounts(projectHash: string): {
  active: number;
  promotable: number;
  archived: number;
} {
  const row = getDb()
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
         SUM(CASE WHEN status = 'active' AND confidence >= 0.7 AND occurrences >= 3 THEN 1 ELSE 0 END) as promotable,
         SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived
       FROM instincts WHERE project_hash = ?`,
    )
    .get(projectHash);
  if (!row) return { active: 0, promotable: 0, archived: 0 };
  return {
    active: Number(row.active ?? 0),
    promotable: Number(row.promotable ?? 0),
    archived: Number(row.archived ?? 0),
  };
}

// ─── Cost event operations ───

function mapCostRow(row: Record<string, unknown>): CostEvent {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    timestamp: String(row.timestamp),
    model: String(row.model),
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    estimatedCostUsd: Number(row.estimated_cost_usd),
  };
}

export function insertCostEvent(event: Omit<CostEvent, "id">): void {
  const id = generateId();
  getDb()
    .prepare(
      `
    INSERT INTO cost_events (id, session_id, timestamp, model, input_tokens, output_tokens, estimated_cost_usd)
    VALUES (@id, @session_id, @timestamp, @model, @input_tokens, @output_tokens, @estimated_cost_usd)
  `,
    )
    .run({
      id,
      session_id: event.sessionId,
      timestamp: event.timestamp ?? nowISO(),
      model: event.model,
      input_tokens: event.inputTokens,
      output_tokens: event.outputTokens,
      estimated_cost_usd: event.estimatedCostUsd,
    });
}

export function getCostBySession(sessionId: string): CostEvent[] {
  return getDb()
    .prepare(
      "SELECT * FROM cost_events WHERE session_id = ? ORDER BY timestamp ASC, rowid ASC",
    )
    .all(sessionId)
    .map(mapCostRow);
}

// ─── Cost summary by model ───

export function getCostSummaryByModel(projectHash: string): Array<{
  model: string;
  sessionCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
}> {
  return getDb()
    .prepare(
      `SELECT ce.model,
              COUNT(DISTINCT ce.session_id) as session_count,
              SUM(ce.input_tokens) as total_input_tokens,
              SUM(ce.output_tokens) as total_output_tokens,
              SUM(ce.estimated_cost_usd) as total_cost_usd
       FROM cost_events ce
       JOIN sessions s ON ce.session_id = s.id
       WHERE s.project_hash = ?
       GROUP BY ce.model
       ORDER BY total_cost_usd DESC`,
    )
    .all(projectHash)
    .map((row) => ({
      model: String(row.model),
      sessionCount: Number(row.session_count),
      totalInputTokens: Number(row.total_input_tokens),
      totalOutputTokens: Number(row.total_output_tokens),
      totalCostUsd: Number(row.total_cost_usd),
    }));
}

// ─── Sync queue operations ───
// v2: Supabase sync layer — infrastructure for planned v2 migration, not invoked in v1 production code.

export function queueSync(
  table: string,
  recordId: string,
  operation: "insert" | "update" | "delete",
  payload: object,
): void {
  getDb()
    .prepare(
      `
    INSERT INTO sync_queue (table_name, record_id, operation, payload)
    VALUES (@table_name, @record_id, @operation, @payload)
  `,
    )
    .run({
      table_name: table,
      record_id: recordId,
      operation,
      payload: JSON.stringify(payload),
    });
}

export function getPendingSync(limit = 50): SyncQueueEntry[] {
  return getDb()
    .prepare(
      "SELECT * FROM sync_queue WHERE synced_at IS NULL ORDER BY id ASC LIMIT ?",
    )
    .all(limit)
    .map((row) => ({
      id: Number(row.id),
      tableName: String(row.table_name),
      recordId: String(row.record_id),
      operation: String(row.operation) as SyncQueueEntry["operation"],
      payload: String(row.payload),
      createdAt: String(row.created_at),
      syncedAt: row.synced_at ? String(row.synced_at) : null,
      retryCount: Number(row.retry_count),
      lastError: row.last_error ? String(row.last_error) : null,
    }));
}

export function markSynced(id: number): void {
  getDb()
    .prepare("UPDATE sync_queue SET synced_at = @synced_at WHERE id = @id")
    .run({
      id,
      synced_at: nowISO(),
    });
}

// ─── Hook event operations ───

function mapHookEventRow(row: Record<string, unknown>): HookEvent {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    hookName: String(row.hook_name),
    eventType: String(row.event_type) as HookEvent["eventType"],
    toolName: row.tool_name ? String(row.tool_name) : undefined,
    exitCode: Number(row.exit_code ?? 0),
    blocked: Number(row.blocked) !== 0,
    durationMs: row.duration_ms != null ? Number(row.duration_ms) : undefined,
    error: row.error ? String(row.error) : undefined,
    timestamp: String(row.timestamp),
  };
}

export function insertHookEvent(event: Omit<HookEvent, "id">): void {
  const id = generateId();
  getDb()
    .prepare(
      `INSERT INTO hook_events (id, session_id, hook_name, event_type, tool_name,
         exit_code, blocked, duration_ms, error, timestamp)
       VALUES (@id, @session_id, @hook_name, @event_type, @tool_name,
         @exit_code, @blocked, @duration_ms, @error, @timestamp)`,
    )
    .run({
      id,
      session_id: event.sessionId,
      hook_name: event.hookName,
      event_type: event.eventType,
      tool_name: event.toolName ?? null,
      exit_code: event.exitCode,
      blocked: event.blocked ? 1 : 0,
      duration_ms: event.durationMs ?? null,
      error: event.error ? event.error.slice(0, 500) : null,
      timestamp: event.timestamp ?? nowISO(),
    });
}

export function getHookEventsBySession(sessionId: string): HookEvent[] {
  return getDb()
    .prepare(
      "SELECT * FROM hook_events WHERE session_id = ? ORDER BY timestamp ASC, rowid ASC",
    )
    .all(sessionId)
    .map(mapHookEventRow);
}

export function getHookEventStats(
  projectHash: string,
  since?: string,
): Array<{
  hookName: string;
  total: number;
  blocks: number;
  avgDurationMs: number;
}> {
  // sinceClause is a hardcoded literal, not caller-provided — safe from injection
  const sinceClause = since ? "AND he.timestamp >= ?" : "";
  const args: unknown[] = [projectHash];
  if (since) args.push(since);

  return getDb()
    .prepare(
      `SELECT he.hook_name,
              COUNT(*) as total,
              SUM(he.blocked) as blocks,
              AVG(he.duration_ms) as avg_duration_ms
       FROM hook_events he
       JOIN sessions s ON he.session_id = s.id
       WHERE s.project_hash = ? ${sinceClause}
       GROUP BY he.hook_name
       ORDER BY total DESC`,
    )
    .all(...args)
    .map((row) => ({
      hookName: String(row.hook_name),
      total: Number(row.total),
      blocks: Number(row.blocks ?? 0),
      avgDurationMs: Math.round(Number(row.avg_duration_ms ?? 0)),
    }));
}

/**
 * Clears the end-state fields (ended_at, duration_ms) for a session.
 * Called by startSession on the resume/merge path to prevent COALESCE from
 * preserving a stale ended_at from the previous lifecycle, which would produce
 * started_at > ended_at inversion. See ADR-007, Option B1.
 */
export function clearSessionEndState(id: string): void {
  getDb()
    .prepare(
      "UPDATE sessions SET ended_at = NULL, duration_ms = NULL WHERE id = @id",
    )
    .run({ id });
}

// ─── Agent invocation operations ───

function mapAgentInvocationRow(row: Record<string, unknown>): AgentInvocation {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    agentType: String(row.agent_type),
    model: row.model ? String(row.model) : undefined,
    description: row.description ? String(row.description) : undefined,
    durationMs: row.duration_ms != null ? Number(row.duration_ms) : undefined,
    success: row.success != null ? Number(row.success) !== 0 : undefined,
    error: row.error ? String(row.error) : undefined,
    timestamp: String(row.timestamp),
  };
}

export function insertAgentInvocation(
  invocation: Omit<AgentInvocation, "id">,
): void {
  const id = generateId();
  getDb()
    .prepare(
      `INSERT INTO agent_invocations (id, session_id, agent_type, model,
         description, duration_ms, success, error, timestamp)
       VALUES (@id, @session_id, @agent_type, @model,
         @description, @duration_ms, @success, @error, @timestamp)`,
    )
    .run({
      id,
      session_id: invocation.sessionId,
      agent_type: invocation.agentType,
      model: invocation.model ?? null,
      description: invocation.description ?? null,
      duration_ms: invocation.durationMs ?? null,
      success: invocation.success != null ? (invocation.success ? 1 : 0) : null,
      error: invocation.error ? invocation.error.slice(0, 500) : null,
      timestamp: invocation.timestamp ?? nowISO(),
    });
}

export function getAgentInvocationsBySession(
  sessionId: string,
): AgentInvocation[] {
  return getDb()
    .prepare(
      "SELECT * FROM agent_invocations WHERE session_id = ? ORDER BY timestamp ASC, rowid ASC",
    )
    .all(sessionId)
    .map(mapAgentInvocationRow);
}

export function getAgentInvocationStats(
  projectHash: string,
  since?: string,
): Array<{
  agentType: string;
  total: number;
  avgDurationMs: number;
  failureRate: number;
}> {
  // sinceClause is a hardcoded literal, not caller-provided — safe from injection
  const sinceClause = since ? "AND ai.timestamp >= ?" : "";
  const args: unknown[] = [projectHash];
  if (since) args.push(since);

  // failure_rate = failures / known_outcomes (excludes NULL success rows from denominator)
  return getDb()
    .prepare(
      `SELECT ai.agent_type,
              COUNT(*) as total,
              AVG(ai.duration_ms) as avg_duration_ms,
              CAST(SUM(CASE WHEN ai.success = 0 THEN 1 ELSE 0 END) AS REAL)
                / NULLIF(COUNT(CASE WHEN ai.success IS NOT NULL THEN 1 END), 0) as failure_rate
       FROM agent_invocations ai
       JOIN sessions s ON ai.session_id = s.id
       WHERE s.project_hash = ? ${sinceClause}
       GROUP BY ai.agent_type
       ORDER BY total DESC`,
    )
    .all(...args)
    .map((row) => ({
      agentType: String(row.agent_type),
      total: Number(row.total),
      avgDurationMs: Math.round(Number(row.avg_duration_ms ?? 0)),
      failureRate: Number(row.failure_rate ?? 0),
    }));
}

// ─── Research Reports (ADR-015, plan-015 Commit 2) ───
// FTS5 capability is probed at runtime and cached per-process.
// queryResearchReports falls back to LIKE for v1 volume; the probe is
// exported so a future virtual-table migration can switch to MATCH
// without touching callers.

let _fts5Supported: boolean | null = null;

export function hasFTS5Support(): boolean {
  if (_fts5Supported !== null) return _fts5Supported;
  try {
    const db = getDb();
    db.exec(
      "CREATE VIRTUAL TABLE IF NOT EXISTS temp.__kadmon_fts5_probe USING fts5(x)",
    );
    db.exec("DROP TABLE IF EXISTS temp.__kadmon_fts5_probe");
    _fts5Supported = true;
  } catch {
    _fts5Supported = false;
  }
  return _fts5Supported;
}

/** Test-only helper — resets the cached FTS5 capability so the probe re-runs. */
export function _resetFTS5Cache(): void {
  _fts5Supported = null;
}

function mapResearchReportRow(row: Record<string, unknown>): ResearchReport {
  const confidence = row.confidence ? String(row.confidence) : undefined;
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    projectHash: String(row.project_hash),
    reportNumber: Number(row.report_number),
    slug: String(row.slug),
    topic: String(row.topic),
    path: String(row.path),
    summary: row.summary != null ? String(row.summary) : undefined,
    confidence:
      confidence === "High" || confidence === "Medium" || confidence === "Low"
        ? confidence
        : undefined,
    capsHit: parseJson<string[]>(row.caps_hit, []),
    subQuestions: parseJson<string[]>(row.sub_questions, []),
    sourcesCount: Number(row.sources_count ?? 0),
    openQuestions: parseJson<string[]>(row.open_questions, []),
    untrustedSources: Number(row.untrusted_sources ?? 1) !== 0,
    generatedAt: String(row.generated_at),
  };
}

/**
 * Create a research report. Atomically assigns a monotonic reportNumber
 * per project — the SELECT MAX + INSERT pair runs inside the wrapper's
 * transaction() helper, which sets the inTransaction flag so saveToDisk
 * only fires once on COMMIT (ADR-015 R-P2).
 *
 * sql.js is single-threaded and Kadmon runs one Node process, so within
 * this process there is no concurrent writer. The transaction protects
 * the invariant for future multi-writer scenarios and keeps the disk
 * write atomic. If multi-process SQLite access ever lands, upgrade this
 * wrapper to BEGIN IMMEDIATE.
 *
 * Returns the persisted row with its assigned id + reportNumber + generatedAt.
 */
export function createResearchReport(
  input: Omit<ResearchReport, "id" | "reportNumber" | "generatedAt"> & {
    id?: string;
    reportNumber?: number;
    generatedAt?: string;
  },
): ResearchReport {
  const db = getDb();
  const id = input.id ?? generateId();
  const generatedAt = input.generatedAt ?? nowISO();
  const untrustedSources = input.untrustedSources ?? true;

  const txn = db.transaction((): ResearchReport => {
    let reportNumber = input.reportNumber;
    if (reportNumber == null) {
      const maxRow = db
        .prepare(
          "SELECT MAX(report_number) as n FROM research_reports WHERE project_hash = ?",
        )
        .get(input.projectHash);
      reportNumber =
        maxRow && maxRow.n != null ? Number(maxRow.n) + 1 : 1;
    }

    db.prepare(
      `INSERT INTO research_reports (
         id, session_id, project_hash, report_number, slug, topic, path,
         summary, confidence, caps_hit, sub_questions, sources_count,
         open_questions, untrusted_sources, generated_at
       ) VALUES (
         @id, @session_id, @project_hash, @report_number, @slug, @topic, @path,
         @summary, @confidence, @caps_hit, @sub_questions, @sources_count,
         @open_questions, @untrusted_sources, @generated_at
       )`,
    ).run({
      id,
      session_id: input.sessionId,
      project_hash: input.projectHash,
      report_number: reportNumber,
      slug: input.slug,
      topic: input.topic,
      path: input.path,
      summary: input.summary ?? null,
      confidence: input.confidence ?? null,
      caps_hit: JSON.stringify(input.capsHit ?? []),
      sub_questions: JSON.stringify(input.subQuestions ?? []),
      sources_count: input.sourcesCount ?? 0,
      open_questions: JSON.stringify(input.openQuestions ?? []),
      untrusted_sources: untrustedSources ? 1 : 0,
      generated_at: generatedAt,
    });

    return {
      id,
      sessionId: input.sessionId,
      projectHash: input.projectHash,
      reportNumber,
      slug: input.slug,
      topic: input.topic,
      path: input.path,
      summary: input.summary,
      confidence: input.confidence,
      capsHit: input.capsHit ?? [],
      subQuestions: input.subQuestions ?? [],
      sourcesCount: input.sourcesCount ?? 0,
      openQuestions: input.openQuestions ?? [],
      untrustedSources,
      generatedAt,
    };
  });

  return txn() as ResearchReport;
}

/** Fetch a specific report by (projectHash, reportNumber). */
export function getResearchReport(
  projectHash: string,
  reportNumber: number,
): ResearchReport | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM research_reports WHERE project_hash = ? AND report_number = ?",
    )
    .get(projectHash, reportNumber);
  return row ? mapResearchReportRow(row) : null;
}

/** Fetch the most recent report for a session — used by /skavenger --continue. */
export function getLastResearchReport(
  sessionId: string,
): ResearchReport | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM research_reports WHERE session_id = ? ORDER BY generated_at DESC, rowid DESC LIMIT 1",
    )
    .get(sessionId);
  return row ? mapResearchReportRow(row) : null;
}

/**
 * Search research reports by text across topic/slug/summary, scoped by project.
 * v1: always uses LIKE. A future FTS5 virtual-table migration can switch to
 * MATCH without touching callers — capability is exposed via hasFTS5Support().
 */
export function queryResearchReports(query: {
  projectHash: string;
  text?: string;
  limit?: number;
}): ResearchReport[] {
  const limit = query.limit ?? 20;
  if (!query.text) {
    return getDb()
      .prepare(
        "SELECT * FROM research_reports WHERE project_hash = ? ORDER BY generated_at DESC, rowid DESC LIMIT ?",
      )
      .all(query.projectHash, limit)
      .map(mapResearchReportRow);
  }
  const likeTerm = `%${query.text}%`;
  return getDb()
    .prepare(
      `SELECT * FROM research_reports
       WHERE project_hash = ?
         AND (topic LIKE ? OR slug LIKE ? OR summary LIKE ?)
       ORDER BY generated_at DESC, rowid DESC LIMIT ?`,
    )
    .all(query.projectHash, likeTerm, likeTerm, likeTerm, limit)
    .map(mapResearchReportRow);
}
