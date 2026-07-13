import type { HookEvent } from "../types.js";
export declare function insertHookEvent(event: Omit<HookEvent, "id">): void;
export declare function getHookEventsBySession(sessionId: string): HookEvent[];
export declare function getHookEventStats(projectHash: string, since?: string): Array<{
    hookName: string;
    total: number;
    blocks: number;
    avgDurationMs: number;
}>;
/**
 * Remove duplicate rows from hook_events, keeping the earliest rowid per
 * natural key (session_id, hook_name, event_type, timestamp). ADR-022
 * migration sentinel — called from openDb to clean historical duplicates
 * before the UNIQUE INDEX is applied, and exposed for tests + manual repair.
 * @returns Number of rows removed.
 */
export declare function cleanupDuplicateHookEvents(): number;
