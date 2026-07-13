// Kadmon Harness — SQLite State Store: hook event operations
// Split from state-store.ts (AUD-37). Imports getDb from ./core.
import { generateId, nowISO } from "../utils.js";
import { getDb } from "./core.js";
function mapHookEventRow(row) {
    return {
        id: String(row.id),
        sessionId: String(row.session_id),
        hookName: String(row.hook_name),
        eventType: String(row.event_type),
        toolName: row.tool_name ? String(row.tool_name) : undefined,
        exitCode: Number(row.exit_code ?? 0),
        blocked: Number(row.blocked) !== 0,
        durationMs: row.duration_ms != null ? Number(row.duration_ms) : undefined,
        error: row.error ? String(row.error) : undefined,
        timestamp: String(row.timestamp),
    };
}
export function insertHookEvent(event) {
    const id = generateId();
    getDb()
        .prepare(
    // ON CONFLICT DO NOTHING on the natural-key UNIQUE INDEX (ADR-022).
    // Targets ONLY the idx_hook_events_natural_key conflict — FK violations
    // (e.g., stale JSONL referencing a deleted session_id) still throw
    // loudly instead of silently dropping rows (spektr 2026-04-22 MEDIUM).
    `INSERT INTO hook_events (id, session_id, hook_name, event_type, tool_name,
         exit_code, blocked, duration_ms, error, timestamp)
       VALUES (@id, @session_id, @hook_name, @event_type, @tool_name,
         @exit_code, @blocked, @duration_ms, @error, @timestamp)
       ON CONFLICT(session_id, hook_name, event_type, timestamp) DO NOTHING`)
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
export function getHookEventsBySession(sessionId) {
    return getDb()
        .prepare("SELECT * FROM hook_events WHERE session_id = ? ORDER BY timestamp ASC, rowid ASC")
        .all(sessionId)
        .map(mapHookEventRow);
}
export function getHookEventStats(projectHash, since) {
    // sinceClause is a hardcoded literal, not caller-provided — safe from injection
    const sinceClause = since ? "AND he.timestamp >= ?" : "";
    const args = [projectHash];
    if (since)
        args.push(since);
    return getDb()
        .prepare(`SELECT he.hook_name,
              COUNT(*) as total,
              SUM(he.blocked) as blocks,
              AVG(he.duration_ms) as avg_duration_ms
       FROM hook_events he
       JOIN sessions s ON he.session_id = s.id
       WHERE s.project_hash = ? ${sinceClause}
       GROUP BY he.hook_name
       ORDER BY total DESC`)
        .all(...args)
        .map((row) => ({
        hookName: String(row.hook_name),
        total: Number(row.total),
        blocks: Number(row.blocks ?? 0),
        avgDurationMs: Math.round(Number(row.avg_duration_ms ?? 0)),
    }));
}
/**
 * Remove duplicate rows from hook_events, keeping the earliest rowid per
 * natural key (session_id, hook_name, event_type, timestamp). ADR-022
 * migration sentinel — called from openDb to clean historical duplicates
 * before the UNIQUE INDEX is applied, and exposed for tests + manual repair.
 * @returns Number of rows removed.
 */
export function cleanupDuplicateHookEvents() {
    const db = getDb();
    const before = Number(db.prepare("SELECT COUNT(*) as c FROM hook_events").get()?.c ?? 0);
    db.exec(`DELETE FROM hook_events WHERE rowid NOT IN (
       SELECT MIN(rowid) FROM hook_events
       GROUP BY session_id, hook_name, event_type, timestamp
     );`);
    const after = Number(db.prepare("SELECT COUNT(*) as c FROM hook_events").get()?.c ?? 0);
    return before - after;
}
