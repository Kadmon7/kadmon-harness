// Kadmon Harness — Session Manager
// Phase: v1 scaffold — implementation in Prompt 4
// Purpose: Session start/end, summary generation

import type { SessionSummary } from './types.js';

// TODO: implement
export function startSession(sessionId: string, projectHash: string, branch: string): void {
  throw new Error('Not implemented — Prompt 4');
}

// TODO: implement
export function endSession(sessionId: string, summary: Partial<SessionSummary>): SessionSummary {
  throw new Error('Not implemented — Prompt 4');
}

// TODO: implement
export function getLastSession(projectHash: string): SessionSummary | null {
  throw new Error('Not implemented — Prompt 4');
}

// TODO: implement
export function listSessions(projectHash: string, limit?: number): SessionSummary[] {
  throw new Error('Not implemented — Prompt 4');
}

// TODO: implement
export function updateCompactionCount(sessionId: string): void {
  throw new Error('Not implemented — Prompt 4');
}
