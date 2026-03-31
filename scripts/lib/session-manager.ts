import type { SessionSummary, ProjectInfo } from "./types.js";
import {
  upsertSession,
  getSession,
  getRecentSessions,
  getActiveInstincts,
} from "./state-store.js";
import { nowISO, nowMs, sessionDir, ensureDir } from "./utils.js";

export function startSession(
  sessionId: string,
  projectInfo: ProjectInfo,
): SessionSummary {
  const now = nowISO();
  ensureDir(sessionDir(sessionId));

  // Check if session already exists (e.g., after /compact → SessionStart)
  const existing = getSession(sessionId);
  if (existing) {
    // MERGE: keep accumulated data, increment compactionCount, clear endedAt
    const merged: SessionSummary = {
      ...existing,
      startedAt: now,
      endedAt: undefined as unknown as string, // null in DB → COALESCE preserves
      branch: projectInfo.branch,
      compactionCount: (existing.compactionCount ?? 0) + 1,
    };
    upsertSession(merged);
    return merged;
  }

  // NEW session: fresh start
  const session: SessionSummary = {
    id: sessionId,
    projectHash: projectInfo.projectHash,
    startedAt: now,
    endedAt: undefined as unknown as string, // null in DB, not empty string
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

export function endSession(
  sessionId: string,
  updates: Partial<SessionSummary>,
): SessionSummary | null {
  const existing = getSession(sessionId);
  if (!existing) return null;

  const now = nowISO();
  const startMs = new Date(existing.startedAt).getTime();
  const endMs = nowMs();

  const final: SessionSummary = {
    ...existing,
    ...updates,
    id: sessionId,
    endedAt: now,
    durationMs: endMs - startMs,
  };

  upsertSession(final);
  return final;
}

export function getLastSession(projectHash: string): SessionSummary | null {
  const sessions = getRecentSessions(projectHash, 1);
  return sessions.length > 0 ? sessions[0] : null;
}

export function loadSessionContext(projectHash: string): string {
  const last = getLastSession(projectHash);
  if (!last) return "";

  const instincts = getActiveInstincts(projectHash);

  const lines = [
    "## Previous Session Context",
    `- Date: ${last.startedAt} | Branch: ${last.branch}`,
  ];
  if (last.summary) lines.push(`- Summary: ${last.summary}`);
  if (last.tasks.length > 0) lines.push(`- Tasks: ${last.tasks.join(", ")}`);
  lines.push(
    `- Files modified: ${last.filesModified.length}`,
    `- Active instincts: ${instincts.length}`,
  );

  if (instincts.length > 0) {
    lines.push("", "### Top Instincts");
    for (const inst of instincts.slice(0, 5)) {
      lines.push(`- [${inst.confidence.toFixed(1)}] ${inst.pattern}`);
    }
  }

  return lines.join("\n");
}
