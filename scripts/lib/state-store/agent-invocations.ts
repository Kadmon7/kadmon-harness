// Kadmon Harness — SQLite State Store: agent invocation operations
// Split from state-store.ts (AUD-37). Imports getDb from ./core.
// Note: clearSessionEndState (an UPDATE sessions) lives in ./sessions, not here.

import type { AgentInvocation } from "../types.js";
import { generateId, nowISO } from "../utils.js";
import { getDb } from "./core.js";

/**
 * Remove duplicate rows from agent_invocations, keeping the earliest rowid per
 * natural key (session_id, agent_type, timestamp). Mirrors
 * cleanupDuplicateHookEvents per ADR-022.
 * @returns Number of rows removed.
 */
export function cleanupDuplicateAgentInvocations(): number {
  const db = getDb();
  const before = Number(
    db.prepare("SELECT COUNT(*) as c FROM agent_invocations").get()?.c ?? 0,
  );
  db.exec(
    `DELETE FROM agent_invocations WHERE rowid NOT IN (
       SELECT MIN(rowid) FROM agent_invocations
       GROUP BY session_id, agent_type, timestamp, COALESCE(tool_use_id, '')
     );`,
  );
  const after = Number(
    db.prepare("SELECT COUNT(*) as c FROM agent_invocations").get()?.c ?? 0,
  );
  return before - after;
}

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
    toolUseId: row.tool_use_id ? String(row.tool_use_id) : undefined,
    timestamp: String(row.timestamp),
  };
}

export function insertAgentInvocation(
  invocation: Omit<AgentInvocation, "id">,
): void {
  const id = generateId();
  getDb()
    .prepare(
      // ON CONFLICT DO NOTHING on the natural-key UNIQUE INDEX (ADR-022,
      // extended AUD-29). tool_use_id (COALESCE'd to '') disambiguates
      // parallel same-type invocations landing in the same millisecond so
      // both rows survive, while legacy/unmatched rows (tool_use_id NULL)
      // still dedup against each other exactly as before. Preserves FK
      // error visibility; see insertHookEvent for rationale.
      `INSERT INTO agent_invocations (id, session_id, agent_type, model,
         description, duration_ms, success, error, tool_use_id, timestamp)
       VALUES (@id, @session_id, @agent_type, @model,
         @description, @duration_ms, @success, @error, @tool_use_id, @timestamp)
       ON CONFLICT(session_id, agent_type, timestamp, COALESCE(tool_use_id, '')) DO NOTHING`,
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
      tool_use_id: invocation.toolUseId ?? null,
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
