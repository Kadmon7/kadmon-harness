// Kadmon Harness — SQLite State Store: instinct operations
// Split from state-store.ts (AUD-37). Imports getDb + parseJson from ./core.
import { nowISO } from "../utils.js";
import { getDb, parseJson } from "./core.js";
function mapInstinctRow(row) {
    return {
        id: String(row.id),
        projectHash: String(row.project_hash),
        pattern: String(row.pattern),
        action: String(row.action),
        confidence: Number(row.confidence),
        occurrences: Number(row.occurrences),
        contradictions: Number(row.contradictions),
        sourceSessions: parseJson(row.source_sessions, []),
        status: String(row.status),
        scope: String(row.scope),
        domain: row.domain ? String(row.domain) : undefined,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        lastObservedAt: row.last_observed_at
            ? String(row.last_observed_at)
            : undefined,
        promotedTo: row.promoted_to ? String(row.promoted_to) : undefined,
    };
}
export function upsertInstinct(instinct) {
    getDb()
        .prepare(`
    INSERT INTO instincts (id, project_hash, pattern, action, confidence, occurrences,
      contradictions, source_sessions, status, scope, domain, promoted_to, created_at, updated_at, last_observed_at)
    VALUES (@id, @project_hash, @pattern, @action, @confidence, @occurrences,
      @contradictions, @source_sessions, @status, @scope, @domain, @promoted_to, @created_at, @updated_at, @last_observed_at)
    ON CONFLICT(id) DO UPDATE SET
      confidence = excluded.confidence,
      occurrences = excluded.occurrences,
      contradictions = excluded.contradictions,
      source_sessions = excluded.source_sessions,
      status = excluded.status,
      scope = excluded.scope,
      domain = COALESCE(excluded.domain, instincts.domain),
      promoted_to = excluded.promoted_to,
      updated_at = excluded.updated_at,
      last_observed_at = COALESCE(excluded.last_observed_at, instincts.last_observed_at)
  `)
        .run({
        id: instinct.id,
        project_hash: instinct.projectHash ?? "",
        pattern: instinct.pattern ?? "",
        action: instinct.action ?? "",
        confidence: instinct.confidence ?? 0.3,
        occurrences: instinct.occurrences ?? 1,
        contradictions: instinct.contradictions ?? 0,
        source_sessions: JSON.stringify(instinct.sourceSessions ?? []),
        status: instinct.status ?? "active",
        scope: instinct.scope ?? "project",
        domain: instinct.domain ?? null,
        promoted_to: instinct.promotedTo ?? null,
        created_at: instinct.createdAt ?? nowISO(),
        updated_at: instinct.updatedAt ?? nowISO(),
        last_observed_at: instinct.lastObservedAt ?? null,
    });
}
export function getInstinct(id) {
    const row = getDb().prepare("SELECT * FROM instincts WHERE id = ?").get(id);
    return row ? mapInstinctRow(row) : null;
}
export function getActiveInstincts(projectHash) {
    return getDb()
        .prepare("SELECT * FROM instincts WHERE project_hash = ? AND status = 'active' ORDER BY confidence DESC, rowid DESC")
        .all(projectHash)
        .map(mapInstinctRow);
}
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
export function getCrossProjectPromotionCandidates(minProjects = 2, minAvgConfidence = 0.8) {
    const rows = getDb()
        .prepare("SELECT * FROM instincts WHERE status = 'active' AND scope = 'project'")
        .all()
        .map(mapInstinctRow);
    const normalize = (p) => p.trim().toLowerCase().replace(/\s+/g, " ");
    const groups = new Map();
    for (const inst of rows) {
        const key = normalize(inst.pattern);
        const bucket = groups.get(key) ?? [];
        bucket.push(inst);
        groups.set(key, bucket);
    }
    const candidates = [];
    for (const [key, members] of groups) {
        const uniqueProjects = new Set(members.map((m) => m.projectHash));
        if (uniqueProjects.size < minProjects)
            continue;
        const avgConfidence = members.reduce((sum, m) => sum + m.confidence, 0) / members.length;
        if (avgConfidence < minAvgConfidence)
            continue;
        candidates.push({
            normalizedPattern: key,
            projectCount: uniqueProjects.size,
            avgConfidence,
            totalOccurrences: members.reduce((sum, m) => sum + m.occurrences, 0),
            instinctIds: members.map((m) => m.id),
        });
    }
    return candidates;
}
export function getPromotableInstincts(projectHash) {
    return getDb()
        .prepare("SELECT * FROM instincts WHERE project_hash = ? AND status = 'active' AND confidence >= 0.7 AND occurrences >= 3 ORDER BY confidence DESC, rowid DESC")
        .all(projectHash)
        .map(mapInstinctRow);
}
export function getInstinctCounts(projectHash) {
    const row = getDb()
        .prepare(`SELECT
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
         SUM(CASE WHEN status = 'active' AND confidence >= 0.7 AND occurrences >= 3 THEN 1 ELSE 0 END) as promotable,
         SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived
       FROM instincts WHERE project_hash = ?`)
        .get(projectHash);
    if (!row)
        return { active: 0, promotable: 0, archived: 0 };
    return {
        active: Number(row.active ?? 0),
        promotable: Number(row.promotable ?? 0),
        archived: Number(row.archived ?? 0),
    };
}
