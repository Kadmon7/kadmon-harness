import type { Instinct } from "../types.js";
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
