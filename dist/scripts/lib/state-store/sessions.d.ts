import type { SessionSummary } from "../types.js";
export declare function upsertSession(session: Partial<SessionSummary> & {
    id: string;
}): void;
export declare function getSession(id: string): SessionSummary | null;
export declare function getRecentSessions(projectHash: string, limit?: number): SessionSummary[];
export declare function getOrphanedSessions(projectHash: string, excludeSessionId: string, limit?: number): SessionSummary[];
export declare function deleteSession(id: string): boolean;
export declare function cleanupTestSessions(projectHash?: string): number;
/**
 * Clears the end-state fields (ended_at, duration_ms) for a session.
 * Called by startSession on the resume/merge path to prevent COALESCE from
 * preserving a stale ended_at from the previous lifecycle, which would produce
 * started_at > ended_at inversion. See ADR-007, Option B1.
 */
export declare function clearSessionEndState(id: string): void;
