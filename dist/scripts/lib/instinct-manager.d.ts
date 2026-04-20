import type { Instinct } from "./types.js";
export declare function createInstinct(projectHash: string, pattern: string, action: string, sourceSessionId: string, scope?: "project" | "global", domain?: string): Instinct;
export declare function reinforceInstinct(id: string, sessionId: string): Instinct | null;
export declare function contradictInstinct(id: string): Instinct | null;
export declare function promoteInstinct(id: string, skillName: string): Instinct | null;
export declare function pruneInstincts(projectHash: string): number;
/**
 * Decay active instincts whose confidence should erode due to silence.
 *
 * Algorithm (ECC port 1/4, plan-018 Phase 1):
 *   - Scope: rows where `project_hash = @ph AND status = 'active'`
 *   - Baseline = `last_observed_at ?? updated_at` (pre-v0.5 rows fall back)
 *   - Weeks = `Math.floor((now - baseline) / MS_PER_WEEK)`; <1 full week = skip
 *   - New confidence = clamp(current - weeks * 0.02, 0, current)
 *   - last_observed_at is NOT touched — it is the baseline, not a write timestamp.
 *
 * Returns `{ decayed, totalLoss }` — counts only rows that actually changed.
 */
export declare function decayInstincts(projectHash: string, now?: Date): {
    decayed: number;
    totalLoss: number;
};
/**
 * Promote a batch of instincts from `scope: 'project'` to `scope: 'global'`.
 *
 * Idempotent: already-global rows are skipped (no UPDATE, `updated_at` unchanged).
 * Nonexistent ids are also skipped silently. Returns the count of rows that
 * actually changed scope (plan-018 Phase 4, ECC port 4/4).
 *
 * Orthogonal to `promoteInstinct` which changes `status` (→ 'promoted'); scope
 * and status are independent columns and both may apply to the same id.
 */
export declare function promoteToGlobal(instinctIds: string[]): number;
export declare function getInstinctSummary(projectHash: string): string;
