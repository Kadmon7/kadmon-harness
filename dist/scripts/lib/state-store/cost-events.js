// Kadmon Harness — SQLite State Store: cost event operations
// Split from state-store.ts (AUD-37). Imports getDb from ./core.
import { generateId, nowISO } from "../utils.js";
import { getDb } from "./core.js";
function mapCostRow(row) {
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
export function insertCostEvent(event) {
    const id = generateId();
    getDb()
        .prepare(`
    INSERT INTO cost_events (id, session_id, timestamp, model, input_tokens, output_tokens, estimated_cost_usd)
    VALUES (@id, @session_id, @timestamp, @model, @input_tokens, @output_tokens, @estimated_cost_usd)
  `)
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
export function getCostBySession(sessionId) {
    return getDb()
        .prepare("SELECT * FROM cost_events WHERE session_id = ? ORDER BY timestamp ASC, rowid ASC")
        .all(sessionId)
        .map(mapCostRow);
}
// ─── Cost summary by model ───
export function getCostSummaryByModel(projectHash) {
    return getDb()
        .prepare(`SELECT ce.model,
              COUNT(DISTINCT ce.session_id) as session_count,
              SUM(ce.input_tokens) as total_input_tokens,
              SUM(ce.output_tokens) as total_output_tokens,
              SUM(ce.estimated_cost_usd) as total_cost_usd
       FROM cost_events ce
       JOIN sessions s ON ce.session_id = s.id
       WHERE s.project_hash = ?
       GROUP BY ce.model
       ORDER BY total_cost_usd DESC`)
        .all(projectHash)
        .map((row) => ({
        model: String(row.model),
        sessionCount: Number(row.session_count),
        totalInputTokens: Number(row.total_input_tokens),
        totalOutputTokens: Number(row.total_output_tokens),
        totalCostUsd: Number(row.total_cost_usd),
    }));
}
