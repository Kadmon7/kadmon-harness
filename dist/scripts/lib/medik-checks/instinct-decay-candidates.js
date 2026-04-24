// Kadmon Harness — /medik Check #12: instinct-decay-candidates (plan-028 Phase 4.7)
// Read-only check — identifies active instincts with low confidence and no recent observation.
// DOES NOT mutate instincts. Never calls decayInstincts().
import { getDb } from "../state-store.js";
export function runCheck(ctx) {
    let rows;
    try {
        const db = getDb();
        rows = db
            .prepare(`SELECT id, confidence, last_observed_at
         FROM instincts
         WHERE project_hash = ?
           AND status = 'active'
           AND confidence < 0.3
           AND (last_observed_at IS NULL
                OR last_observed_at < datetime('now', '-30 days'))
         ORDER BY confidence ASC, last_observed_at ASC, rowid ASC
         LIMIT 10`)
            .all(ctx.projectHash);
    }
    catch (e) {
        // DB not ready or schema mismatch — surface as NOTE (not false PASS) so the operator knows the check was skipped
        return {
            status: "NOTE",
            category: "knowledge-hygiene",
            message: `instinct decay check unavailable (DB error): ${e instanceof Error ? e.message : String(e)}`,
        };
    }
    if (rows.length === 0) {
        return {
            status: "PASS",
            category: "knowledge-hygiene",
            message: "No instinct decay candidates",
        };
    }
    return {
        status: "NOTE",
        category: "knowledge-hygiene",
        message: `${rows.length} instinct${rows.length > 1 ? "s" : ""} candidates for archive. Run /forge to review.`,
        details: rows.map((r) => ({ id: r.id, confidence: r.confidence })),
    };
}
