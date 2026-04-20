import { upsertSession, getSession, getRecentSessions, clearSessionEndState, } from "./state-store.js";
import { nowISO, nowMs, sessionDir, ensureDir } from "./utils.js";
export function startSession(sessionId, projectInfo) {
    const now = nowISO();
    ensureDir(sessionDir(sessionId));
    // Check if session already exists (e.g., after /compact → SessionStart)
    const existing = getSession(sessionId);
    if (existing) {
        // MERGE: keep accumulated data, increment compactionCount, clear endedAt
        // ADR-007: clear stale end state before resume to prevent inversion.
        // clearSessionEndState NULLs ended_at/duration_ms in DB first; we also
        // exclude them from the merged object so upsertSession's COALESCE does not
        // immediately restore the stale values from excluded.duration_ms.
        clearSessionEndState(existing.id);
        const merged = {
            ...existing,
            startedAt: now,
            endedAt: undefined, // null in DB → COALESCE preserves
            durationMs: undefined, // cleared — will stay NULL in DB
            branch: projectInfo.branch,
            compactionCount: (existing.compactionCount ?? 0) + 1,
        };
        upsertSession(merged);
        return merged;
    }
    // NEW session: fresh start
    const session = {
        id: sessionId,
        projectHash: projectInfo.projectHash,
        startedAt: now,
        endedAt: undefined, // null in DB, not empty string
        durationMs: 0,
        branch: projectInfo.branch,
        tasks: [],
        filesModified: [],
        toolsUsed: [],
        messageCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        estimatedCostUsd: 0,
        instinctsCreated: [],
        compactionCount: 0,
        summary: undefined,
    };
    upsertSession(session);
    return session;
}
export function endSession(sessionId, updates) {
    const existing = getSession(sessionId);
    if (!existing)
        return null;
    const now = nowISO();
    const startMs = new Date(existing.startedAt).getTime();
    const endMs = nowMs();
    // Filter undefined values so they don't overwrite existing data
    const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    const final = {
        ...existing,
        ...cleanUpdates,
        id: sessionId,
        endedAt: now,
        durationMs: endMs - startMs,
    };
    upsertSession(final);
    return final;
}
export function getLastSession(projectHash) {
    const sessions = getRecentSessions(projectHash, 1);
    return sessions.length > 0 ? sessions[0] : null;
}
