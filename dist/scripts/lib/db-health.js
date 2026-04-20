// Kadmon Harness — Pure DB diagnostic probe.
// Returns a typed report of table counts, freshness, recent events, and
// detected anomalies. Consumed by scripts/db-health-check.ts (CLI) and
// reusable from /medik Phase 1.
import { getDb } from "./state-store.js";
const TABLES = [
    "sessions",
    "instincts",
    "cost_events",
    "hook_events",
    "agent_invocations",
    "sync_queue",
];
const FRESHNESS_COLUMN = {
    sessions: "started_at",
    instincts: "updated_at",
    cost_events: "timestamp",
    hook_events: "timestamp",
    agent_invocations: "timestamp",
    sync_queue: "created_at",
};
const STALE_SESSIONS_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
export function getDbHealthReport() {
    const db = getDb();
    const tableCounts = {};
    const freshness = {};
    for (const t of TABLES) {
        const cntRow = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get();
        tableCounts[t] = Number(cntRow?.n ?? 0);
        const col = FRESHNESS_COLUMN[t];
        const row = db.prepare(`SELECT MAX(${col}) AS latest FROM ${t}`).get();
        freshness[t] = row?.latest != null ? String(row.latest) : null;
    }
    const lastSessions = db
        .prepare(`SELECT id, branch, message_count AS msgs, estimated_cost_usd AS cost,
              started_at, ended_at
       FROM sessions
       ORDER BY started_at DESC, rowid DESC
       LIMIT 3`)
        .all()
        .map((r) => ({
        id: String(r.id),
        branch: r.branch != null ? String(r.branch) : null,
        msgs: Number(r.msgs ?? 0),
        cost: Number(r.cost ?? 0),
        startedAt: String(r.started_at),
        endedAt: r.ended_at != null ? String(r.ended_at) : null,
    }));
    const hookEvents24h = db
        .prepare(`SELECT hook_name, COUNT(*) AS n,
              SUM(blocked) AS blocks,
              MAX(duration_ms) AS max_ms
       FROM hook_events
       WHERE timestamp > datetime('now', '-1 day')
       GROUP BY hook_name
       ORDER BY n DESC`)
        .all()
        .map((r) => ({
        hookName: String(r.hook_name),
        count: Number(r.n ?? 0),
        blocks: Number(r.blocks ?? 0),
        maxMs: r.max_ms != null ? Number(r.max_ms) : null,
    }));
    const agentInvocations24h = db
        .prepare(`SELECT agent_type, COUNT(*) AS n,
              AVG(duration_ms) AS avg_ms
       FROM agent_invocations
       WHERE timestamp > datetime('now', '-1 day')
       GROUP BY agent_type
       ORDER BY n DESC`)
        .all()
        .map((r) => ({
        agentType: String(r.agent_type),
        count: Number(r.n ?? 0),
        avgMs: Math.round(Number(r.avg_ms ?? 0)),
    }));
    const costEvents24h = db
        .prepare(`SELECT model, COUNT(*) AS n, SUM(estimated_cost_usd) AS total_usd
       FROM cost_events
       WHERE timestamp > datetime('now', '-1 day')
       GROUP BY model
       ORDER BY total_usd DESC`)
        .all()
        .map((r) => ({
        model: String(r.model),
        count: Number(r.n ?? 0),
        totalUsd: Number(r.total_usd ?? 0),
    }));
    const anomalies = detectAnomalies(tableCounts, freshness);
    return {
        tableCounts,
        freshness,
        lastSessions,
        hookEvents24h,
        agentInvocations24h,
        costEvents24h,
        anomalies,
    };
}
function detectAnomalies(tableCounts, freshness) {
    const db = getDb();
    const anomalies = [];
    for (const t of TABLES) {
        if (t === "sync_queue")
            continue;
        if (tableCounts[t] === 0)
            anomalies.push(`table_empty: ${t}`);
    }
    const invRow = db
        .prepare(`SELECT COUNT(*) AS n FROM sessions
       WHERE ended_at IS NOT NULL AND ended_at != '' AND ended_at < started_at`)
        .get();
    const inverted = Number(invRow?.n ?? 0);
    if (inverted > 0) {
        anomalies.push(`sessions_timestamp_inversion: ${inverted} rows`);
    }
    const durRow = db
        .prepare(`SELECT
         SUM(CASE WHEN duration_ms IS NULL THEN 1 ELSE 0 END) AS nulls,
         COUNT(*) AS total
       FROM hook_events
       WHERE timestamp > datetime('now', '-1 day')`)
        .get();
    const total = Number(durRow?.total ?? 0);
    const nulls = Number(durRow?.nulls ?? 0);
    if (total > 0 && nulls === total) {
        anomalies.push(`hook_duration_missing: ${total}/${total} rows NULL in 24h`);
    }
    const latest = freshness.sessions;
    if (tableCounts.sessions > 0 && latest) {
        const parsed = Date.parse(latest);
        if (!Number.isNaN(parsed)) {
            const days = Math.floor((Date.now() - parsed) / MS_PER_DAY);
            if (days > STALE_SESSIONS_DAYS) {
                anomalies.push(`sessions_stale: latest ${days}d old (threshold ${STALE_SESSIONS_DAYS}d)`);
            }
        }
    }
    return anomalies;
}
