import type { Instinct } from "./types.js";
import {
  upsertInstinct,
  getInstinct,
  getActiveInstincts,
  getDb,
} from "./state-store.js";
import { generateId, nowISO } from "./utils.js";

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
