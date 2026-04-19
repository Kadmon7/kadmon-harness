import type { Instinct } from "./types.js";
import {
  upsertInstinct,
  getInstinct,
  getActiveInstincts,
  getDb,
} from "./state-store.js";
import { generateId, nowISO } from "./utils.js";

const DECAY_PER_WEEK = 0.02;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function createInstinct(
  projectHash: string,
  pattern: string,
  action: string,
  sourceSessionId: string,
  scope: "project" | "global" = "project",
  domain?: string,
): Instinct {
  const now = nowISO();
  const instinct: Instinct = {
    id: generateId(),
    projectHash,
    pattern,
    action,
    confidence: 0.3,
    occurrences: 1,
    contradictions: 0,
    sourceSessions: [sourceSessionId],
    status: "active",
    scope,
    domain,
    createdAt: now,
    updatedAt: now,
  };
  upsertInstinct(instinct);
  return instinct;
}

export function reinforceInstinct(
  id: string,
  sessionId: string,
): Instinct | null {
  const existing = getInstinct(id);
  if (!existing) return null;

  const sessions = existing.sourceSessions.includes(sessionId)
    ? existing.sourceSessions
    : [...existing.sourceSessions, sessionId];

  const updated: Instinct = {
    ...existing,
    confidence: Math.min(
      0.9,
      Math.round((existing.confidence + 0.1) * 100) / 100,
    ),
    occurrences: existing.occurrences + 1,
    sourceSessions: sessions,
    updatedAt: nowISO(),
  };
  upsertInstinct(updated);
  return updated;
}

export function contradictInstinct(id: string): Instinct | null {
  const existing = getInstinct(id);
  if (!existing) return null;

  const contradictions = existing.contradictions + 1;
  const status =
    contradictions > existing.occurrences
      ? ("contradicted" as const)
      : existing.status;

  const updated: Instinct = {
    ...existing,
    contradictions,
    status,
    updatedAt: nowISO(),
  };
  upsertInstinct(updated);
  return updated;
}

export function promoteInstinct(
  id: string,
  skillName: string,
): Instinct | null {
  const existing = getInstinct(id);
  if (!existing) return null;
  if (existing.confidence < 0.7 || existing.occurrences < 3) return null;

  const updated: Instinct = {
    ...existing,
    status: "promoted",
    promotedTo: skillName,
    updatedAt: nowISO(),
  };
  upsertInstinct(updated);
  return updated;
}

export function pruneInstincts(projectHash: string): number {
  const db = getDb();
  const now = new Date();
  const sevenDaysAgo = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Archive contradicted instincts older than 7 days
  db.prepare(
    "UPDATE instincts SET status = 'archived', updated_at = @now WHERE project_hash = @ph AND status = 'contradicted' AND updated_at < @cutoff",
  ).run({ ph: projectHash, now: nowISO(), cutoff: sevenDaysAgo });

  // Archive low-confidence, low-occurrence instincts
  db.prepare(
    "UPDATE instincts SET status = 'archived', updated_at = @now WHERE project_hash = @ph AND status = 'active' AND confidence < 0.2 AND occurrences < 2",
  ).run({ ph: projectHash, now: nowISO() });

  // Count how many were archived (approximate — we count all archived for this project)
  const row = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM instincts WHERE project_hash = ? AND status = 'archived'",
    )
    .get(projectHash);
  return Number(row?.cnt ?? 0);
}

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
export function decayInstincts(
  projectHash: string,
  now: Date = new Date(),
): { decayed: number; totalLoss: number } {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, confidence, updated_at, last_observed_at FROM instincts WHERE project_hash = ? AND status = 'active'",
    )
    .all(projectHash) as Array<{
    id: string;
    confidence: number;
    updated_at: string;
    last_observed_at: string | null;
  }>;

  const nowIso = now.toISOString();
  const updateStmt = db.prepare(
    "UPDATE instincts SET confidence = @confidence, updated_at = @now WHERE id = @id",
  );

  let decayed = 0;
  let totalLoss = 0;

  db.transaction(() => {
    for (const row of rows) {
      const baselineRaw = row.last_observed_at ?? row.updated_at;
      const baselineMs = Date.parse(baselineRaw);
      if (Number.isNaN(baselineMs)) continue;

      const weeksSince = (now.getTime() - baselineMs) / MS_PER_WEEK;
      if (weeksSince < 1) continue;

      const decayAmount = Math.floor(weeksSince) * DECAY_PER_WEEK;
      const newConfidence =
        Math.round(Math.max(0, row.confidence - decayAmount) * 100) / 100;

      if (newConfidence === row.confidence) continue;

      updateStmt.run({
        confidence: newConfidence,
        now: nowIso,
        id: row.id,
      });

      decayed++;
      totalLoss += row.confidence - newConfidence;
    }
  })();

  return {
    decayed,
    totalLoss: Math.round(totalLoss * 100) / 100,
  };
}

export function getInstinctSummary(projectHash: string): string {
  const instincts = getActiveInstincts(projectHash);
  if (instincts.length === 0) return "No active instincts.";

  const lines = [`### Active Instincts (${instincts.length})`];
  for (const inst of instincts.slice(0, 5)) {
    lines.push(
      `- [${inst.confidence.toFixed(1)}×${inst.occurrences}]${inst.domain ? ` (${inst.domain})` : ""} ${inst.pattern} → ${inst.action}`,
    );
  }
  if (instincts.length > 5) {
    lines.push(`- ... and ${instincts.length - 5} more`);
  }
  return lines.join("\n");
}
