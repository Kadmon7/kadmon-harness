import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  openDb, closeDb, upsertSession, getSession, getRecentSessions,
  upsertInstinct, getInstinct, getActiveInstincts, getPromotableInstincts,
  insertCostEvent, getCostBySession, queueSync, getPendingSync, markSynced,
} from '../../scripts/lib/state-store.js';

describe('state-store', () => {
  beforeEach(async () => {
    await openDb(':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  // ─── Sessions ───

  it('upserts and retrieves a session', () => {
    upsertSession({ id: 's1', projectHash: 'abc123', branch: 'main', startedAt: '2026-01-01T00:00:00Z' });
    const s = getSession('s1');
    expect(s).not.toBeNull();
    expect(s!.id).toBe('s1');
    expect(s!.projectHash).toBe('abc123');
    expect(s!.branch).toBe('main');
  });

  it('updates existing session on conflict', () => {
    upsertSession({ id: 's1', projectHash: 'abc', messageCount: 5 });
    upsertSession({ id: 's1', projectHash: 'abc', messageCount: 10, endedAt: '2026-01-01T01:00:00Z' });
    const s = getSession('s1');
    expect(s!.messageCount).toBe(10);
    expect(s!.endedAt).toBe('2026-01-01T01:00:00Z');
  });

  it('returns null for missing session', () => {
    expect(getSession('nonexistent')).toBeNull();
  });

  it('lists recent sessions by project', () => {
    upsertSession({ id: 's1', projectHash: 'proj1', startedAt: '2026-01-01T00:00:00Z' });
    upsertSession({ id: 's2', projectHash: 'proj1', startedAt: '2026-01-02T00:00:00Z' });
    upsertSession({ id: 's3', projectHash: 'proj2', startedAt: '2026-01-03T00:00:00Z' });
    const sessions = getRecentSessions('proj1');
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe('s2'); // most recent first
  });

  // ─── Instincts ───

  it('creates and retrieves an instinct', () => {
    upsertInstinct({
      id: 'i1', projectHash: 'proj1', pattern: 'always run tests',
      action: 'run vitest after edits', confidence: 0.3, occurrences: 1,
    });
    const i = getInstinct('i1');
    expect(i).not.toBeNull();
    expect(i!.pattern).toBe('always run tests');
    expect(i!.confidence).toBe(0.3);
    expect(i!.status).toBe('active');
  });

  it('updates instinct on conflict', () => {
    upsertInstinct({ id: 'i1', projectHash: 'proj1', pattern: 'p', action: 'a', confidence: 0.3 });
    upsertInstinct({ id: 'i1', projectHash: 'proj1', pattern: 'p', action: 'a', confidence: 0.5, occurrences: 3 });
    const i = getInstinct('i1');
    expect(i!.confidence).toBe(0.5);
    expect(i!.occurrences).toBe(3);
  });

  it('returns active instincts sorted by confidence', () => {
    upsertInstinct({ id: 'i1', projectHash: 'p1', pattern: 'a', action: 'a', confidence: 0.5 });
    upsertInstinct({ id: 'i2', projectHash: 'p1', pattern: 'b', action: 'b', confidence: 0.8 });
    upsertInstinct({ id: 'i3', projectHash: 'p1', pattern: 'c', action: 'c', confidence: 0.3, status: 'contradicted' });
    const active = getActiveInstincts('p1');
    expect(active).toHaveLength(2);
    expect(active[0].confidence).toBe(0.8); // highest first
  });

  it('returns promotable instincts', () => {
    upsertInstinct({ id: 'i1', projectHash: 'p1', pattern: 'a', action: 'a', confidence: 0.8, occurrences: 5 });
    upsertInstinct({ id: 'i2', projectHash: 'p1', pattern: 'b', action: 'b', confidence: 0.6, occurrences: 5 }); // too low confidence
    upsertInstinct({ id: 'i3', projectHash: 'p1', pattern: 'c', action: 'c', confidence: 0.8, occurrences: 2 }); // too few occurrences
    const promotable = getPromotableInstincts('p1');
    expect(promotable).toHaveLength(1);
    expect(promotable[0].id).toBe('i1');
  });

  // ─── Cost Events ───

  it('inserts and retrieves cost events', () => {
    upsertSession({ id: 's1', projectHash: 'p1' });
    insertCostEvent({ sessionId: 's1', timestamp: '2026-01-01T00:00:00Z', model: 'sonnet', inputTokens: 1000, outputTokens: 500, estimatedCostUsd: 0.0105 });
    insertCostEvent({ sessionId: 's1', timestamp: '2026-01-01T00:01:00Z', model: 'sonnet', inputTokens: 2000, outputTokens: 300, estimatedCostUsd: 0.0105 });
    const costs = getCostBySession('s1');
    expect(costs).toHaveLength(2);
    expect(costs[0].model).toBe('sonnet');
  });

  // ─── Sync Queue ───

  it('queues and retrieves pending sync items', () => {
    queueSync('sessions', 's1', 'insert', { id: 's1' });
    queueSync('instincts', 'i1', 'update', { id: 'i1' });
    const pending = getPendingSync();
    expect(pending).toHaveLength(2);
    expect(pending[0].tableName).toBe('sessions');
    expect(pending[0].operation).toBe('insert');
  });

  it('marks sync items as synced', () => {
    queueSync('sessions', 's1', 'insert', { id: 's1' });
    const pending = getPendingSync();
    markSynced(pending[0].id!);
    const remaining = getPendingSync();
    expect(remaining).toHaveLength(0);
  });
});
