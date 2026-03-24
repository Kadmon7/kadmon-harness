// Kadmon Harness — Shared Utilities
// Phase: v1 scaffold — implementation in Prompt 4
// Purpose: Shared utilities (timestamps, os.tmpdir(), file paths)

import os from 'node:os';
import path from 'node:path';

// TODO: implement
export function getSessionDir(sessionId: string): string {
  // Return path: os.tmpdir()/kadmon/<sessionId>/
  return path.join(os.tmpdir(), 'kadmon', sessionId);
}

// TODO: implement
export function getObservationsPath(sessionId: string): string {
  // Return path to observations JSONL file
  return path.join(getSessionDir(sessionId), 'observations.jsonl');
}

// TODO: implement
export function nowISO(): string {
  return new Date().toISOString();
}

// TODO: implement
export function generateId(): string {
  // Generate UUID v4
  throw new Error('Not implemented — Prompt 4');
}

// TODO: implement
export function getKadmonDataDir(): string {
  // Return persistent data directory for SQLite DB
  // Windows: %APPDATA%/kadmon-harness/
  throw new Error('Not implemented — Prompt 4');
}
