import type { ResearchReport } from "../types.js";
export declare function hasFTS5Support(): boolean;
/** Test-only helper — resets the cached FTS5 capability so the probe re-runs. */
export declare function _resetFTS5Cache(): void;
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
export declare function createResearchReport(input: Omit<ResearchReport, "id" | "reportNumber" | "generatedAt"> & {
    id?: string;
    reportNumber?: number;
    /**
     * AUD-32: advisory floor for the auto-assigned reportNumber, typically
     * the max NNN found by a disk scan of docs/research/research-NNN-*.md.
     * The git-ignored local kadmon.db can be empty on a fresh machine while
     * the git-tracked research files already occupy numbers — without this
     * floor, MAX(report_number)+1 against an empty DB restarts at 1 and
     * collides with existing filenames. Ignored when `reportNumber` is set
     * explicitly. Computed inside the same transaction as the INSERT so the
     * atomic MAX+1 guarantee against the DB side is unaffected.
     */
    floorReportNumber?: number;
    generatedAt?: string;
}): ResearchReport;
/** Fetch a specific report by (projectHash, reportNumber). */
export declare function getResearchReport(projectHash: string, reportNumber: number): ResearchReport | null;
/** Fetch the most recent report for a session — used by /skavenger --continue. */
export declare function getLastResearchReport(sessionId: string): ResearchReport | null;
/**
 * Search research reports by text across topic/slug/summary, scoped by project.
 * v1: always uses LIKE. A future FTS5 virtual-table migration can switch to
 * MATCH without touching callers — capability is exposed via hasFTS5Support().
 */
export declare function queryResearchReports(query: {
    projectHash: string;
    text?: string;
    limit?: number;
}): ResearchReport[];
