// Kadmon Harness — SQLite State Store
// Phase: v1 scaffold — implementation in Prompt 4
// Purpose: SQLite wrapper for sessions, instincts, cost_events, sync_queue

import type { Instinct, SessionSummary, CostEvent, SyncQueueEntry } from './types.js';

// TODO: implement
export function initDatabase(dbPath: string): void {
  // Initialize SQLite database with schema from scripts/lib/schema.sql
  throw new Error('Not implemented — Prompt 4');
}

// TODO: implement
export function getDatabase(): unknown {
  // Return the initialized database instance
  throw new Error('Not implemented — Prompt 4');
}

// TODO: implement
export function closeDatabase(): void {
  // Close database connection
  throw new Error('Not implemented — Prompt 4');
}
