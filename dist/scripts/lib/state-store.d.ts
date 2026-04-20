import type { Instinct, SessionSummary, CostEvent, SyncQueueEntry, HookEvent, AgentInvocation, ResearchReport } from "./types.js";
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
export declare function openDb(customPath?: string): Promise<WrappedDb>;
export declare function getDb(): WrappedDb;
export declare function closeDb(): void;
export declare function upsertSession(session: Partial<SessionSummary> & {
    id: string;
}): void;
export declare function getSession(id: string): SessionSummary | null;
export declare function getRecentSessions(projectHash: string, limit?: number): SessionSummary[];
export declare function getOrphanedSessions(projectHash: string, excludeSessionId: string, limit?: number): SessionSummary[];
export declare function deleteSession(id: string): boolean;
export declare function cleanupTestSessions(projectHash?: string): number;
export declare function upsertInstinct(instinct: Partial<Instinct> & {
    id: string;
}): void;
export declare function getInstinct(id: string): Instinct | null;
export declare function getActiveInstincts(projectHash: string): Instinct[];
/**
 * Find instincts that are candidates for promotion from `scope: 'project'` to
 * `scope: 'global'` because the same pattern appears in multiple projects with
 * strong confidence (plan-018 Phase 4, ECC port 4/4).
 *
 * Scope: `status = 'active' AND scope = 'project'` only. Already-global rows
 * are excluded (they're the target state, not the source).
 *
 * Pattern matching: app-layer Unicode-safe normalization via
 * `pattern.trim().toLowerCase().replace(/\s+/g, ' ')`. SQLite's `LOWER` is
 * ASCII-only, so this can't be collapsed into SQL.
 *
 * @param minProjects Unique project hashes required per pattern (default 2)
 * @param minAvgConfidence Mean confidence across the group (default 0.8, inclusive)
 */
export declare function getCrossProjectPromotionCandidates(minProjects?: number, minAvgConfidence?: number): Array<{
    normalizedPattern: string;
    projectCount: number;
    avgConfidence: number;
    totalOccurrences: number;
    instinctIds: string[];
}>;
export declare function getPromotableInstincts(projectHash: string): Instinct[];
export declare function getInstinctCounts(projectHash: string): {
    active: number;
    promotable: number;
    archived: number;
};
export declare function insertCostEvent(event: Omit<CostEvent, "id">): void;
export declare function getCostBySession(sessionId: string): CostEvent[];
export declare function getCostSummaryByModel(projectHash: string): Array<{
    model: string;
    sessionCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number;
}>;
export declare function queueSync(table: string, recordId: string, operation: "insert" | "update" | "delete", payload: object): void;
export declare function getPendingSync(limit?: number): SyncQueueEntry[];
export declare function markSynced(id: number): void;
export declare function insertHookEvent(event: Omit<HookEvent, "id">): void;
export declare function getHookEventsBySession(sessionId: string): HookEvent[];
export declare function getHookEventStats(projectHash: string, since?: string): Array<{
    hookName: string;
    total: number;
    blocks: number;
    avgDurationMs: number;
}>;
/**
 * Clears the end-state fields (ended_at, duration_ms) for a session.
 * Called by startSession on the resume/merge path to prevent COALESCE from
 * preserving a stale ended_at from the previous lifecycle, which would produce
 * started_at > ended_at inversion. See ADR-007, Option B1.
 */
export declare function clearSessionEndState(id: string): void;
export declare function insertAgentInvocation(invocation: Omit<AgentInvocation, "id">): void;
export declare function getAgentInvocationsBySession(sessionId: string): AgentInvocation[];
export declare function getAgentInvocationStats(projectHash: string, since?: string): Array<{
    agentType: string;
    total: number;
    avgDurationMs: number;
    failureRate: number;
}>;
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
export {};
