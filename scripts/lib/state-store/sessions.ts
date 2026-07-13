// Kadmon Harness — SQLite State Store: session operations (camelCase ↔ snake_case)
// Split from state-store.ts (AUD-37). Imports the DB singleton + parseJson from ./core.
// Cross-table cascade deletes (cost_events / hook_events / agent_invocations) are raw
// SQL, so this module does not import the sibling domain modules — the DAG stays acyclic.

import type { SessionSummary } from "../types.js";
import { nowISO } from "../utils.js";
import { getDb, parseJson } from "./core.js";

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
