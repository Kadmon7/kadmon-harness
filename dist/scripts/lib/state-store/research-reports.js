// Kadmon Harness — SQLite State Store: research reports (ADR-015, plan-015 Commit 2)
// Split from state-store.ts (AUD-37). Imports getDb + parseJson from ./core.
//
// FTS5 capability is probed at runtime and cached per-process (single owner of
// the _fts5Supported cache lives here — moved from the pre-split file's DB
// section). queryResearchReports falls back to LIKE for v1 volume; the probe is
// exported so a future virtual-table migration can switch to MATCH without
// touching callers.
import { generateId, nowISO } from "../utils.js";
import { getDb, parseJson } from "./core.js";
let _fts5Supported = null;
export function hasFTS5Support() {
    if (_fts5Supported !== null)
        return _fts5Supported;
    try {
        const db = getDb();
        db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS temp.__kadmon_fts5_probe USING fts5(x)");
        db.exec("DROP TABLE IF EXISTS temp.__kadmon_fts5_probe");
        _fts5Supported = true;
    }
    catch {
        _fts5Supported = false;
    }
    return _fts5Supported;
}
/** Test-only helper — resets the cached FTS5 capability so the probe re-runs. */
export function _resetFTS5Cache() {
    _fts5Supported = null;
}
function mapResearchReportRow(row) {
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
        confidence: confidence === "High" || confidence === "Medium" || confidence === "Low"
            ? confidence
            : undefined,
        capsHit: parseJson(row.caps_hit, []),
        subQuestions: parseJson(row.sub_questions, []),
        sourcesCount: Number(row.sources_count ?? 0),
        openQuestions: parseJson(row.open_questions, []),
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
export function createResearchReport(input) {
    const db = getDb();
    const id = input.id ?? generateId();
    const generatedAt = input.generatedAt ?? nowISO();
    const untrustedSources = input.untrustedSources ?? true;
    const txn = db.transaction(() => {
        let reportNumber = input.reportNumber;
        if (reportNumber == null) {
            const maxRow = db
                .prepare("SELECT MAX(report_number) as n FROM research_reports WHERE project_hash = ?")
                .get(input.projectHash);
            const dbMax = maxRow && maxRow.n != null ? Number(maxRow.n) : 0;
            const floor = input.floorReportNumber ?? 0;
            reportNumber = Math.max(dbMax, floor) + 1;
        }
        db.prepare(`INSERT INTO research_reports (
         id, session_id, project_hash, report_number, slug, topic, path,
         summary, confidence, caps_hit, sub_questions, sources_count,
         open_questions, untrusted_sources, generated_at
       ) VALUES (
         @id, @session_id, @project_hash, @report_number, @slug, @topic, @path,
         @summary, @confidence, @caps_hit, @sub_questions, @sources_count,
         @open_questions, @untrusted_sources, @generated_at
       )`).run({
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
    return txn();
}
/** Fetch a specific report by (projectHash, reportNumber). */
export function getResearchReport(projectHash, reportNumber) {
    const row = getDb()
        .prepare("SELECT * FROM research_reports WHERE project_hash = ? AND report_number = ?")
        .get(projectHash, reportNumber);
    return row ? mapResearchReportRow(row) : null;
}
/** Fetch the most recent report for a session — used by /skavenger --continue. */
export function getLastResearchReport(sessionId) {
    const row = getDb()
        .prepare("SELECT * FROM research_reports WHERE session_id = ? ORDER BY generated_at DESC, rowid DESC LIMIT 1")
        .get(sessionId);
    return row ? mapResearchReportRow(row) : null;
}
/**
 * Search research reports by text across topic/slug/summary, scoped by project.
 * v1: always uses LIKE. A future FTS5 virtual-table migration can switch to
 * MATCH without touching callers — capability is exposed via hasFTS5Support().
 */
export function queryResearchReports(query) {
    const limit = query.limit ?? 20;
    if (!query.text) {
        return getDb()
            .prepare("SELECT * FROM research_reports WHERE project_hash = ? ORDER BY generated_at DESC, rowid DESC LIMIT ?")
            .all(query.projectHash, limit)
            .map(mapResearchReportRow);
    }
    const likeTerm = `%${query.text}%`;
    return getDb()
        .prepare(`SELECT * FROM research_reports
       WHERE project_hash = ?
         AND (topic LIKE ? OR slug LIKE ? OR summary LIKE ?)
       ORDER BY generated_at DESC, rowid DESC LIMIT ?`)
        .all(query.projectHash, likeTerm, likeTerm, likeTerm, limit)
        .map(mapResearchReportRow);
}
