import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  openDb, closeDb, getInstinct, getActiveInstincts,
  getPromotableInstincts, upsertInstinct,
} from '../../scripts/lib/state-store.js';
import {
  createInstinct, reinforceInstinct, contradictInstinct,
  promoteInstinct, pruneInstincts, getInstinctSummary,
} from '../../scripts/lib/instinct-manager.js';

const PROJECT = 'eval-e2e-project';

describe('instinct lifecycle E2E', () => {
  beforeEach(async () => {
    await openDb(':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  it('completes full lifecycle: create → reinforce → promote', () => {
    // Step 1: Create
    const inst = createInstinct(PROJECT, 'always lint', 'run eslint', 'sess-1');
    expect(inst.confidence).toBe(0.3);
    expect(inst.occurrences).toBe(1);
    expect(inst.status).toBe('active');
    expect(inst.scope).toBe('project');
    expect(inst.sourceSessions).toEqual(['sess-1']);

    // Verify persisted to DB
    const fromDb = getInstinct(inst.id);
    expect(fromDb).not.toBeNull();
    expect(fromDb!.pattern).toBe('always lint');

    // Step 2: Reinforce x4 → confidence 0.7, occurrences 5
    const r1 = reinforceInstinct(inst.id, 'sess-2');
    expect(r1!.confidence).toBeCloseTo(0.4);
    expect(r1!.occurrences).toBe(2);

    const r2 = reinforceInstinct(inst.id, 'sess-3');
    expect(r2!.confidence).toBeCloseTo(0.5);
    expect(r2!.occurrences).toBe(3);

    const r3 = reinforceInstinct(inst.id, 'sess-4');
    expect(r3!.confidence).toBeCloseTo(0.6);
    expect(r3!.occurrences).toBe(4);

    const r4 = reinforceInstinct(inst.id, 'sess-5');
    expect(r4!.confidence).toBeCloseTo(0.7);
    expect(r4!.occurrences).toBe(5);
    expect(r4!.sourceSessions).toEqual(['sess-1', 'sess-2', 'sess-3', 'sess-4', 'sess-5']);

    // Step 3: Check promotability
    const promotable = getPromotableInstincts(PROJECT);
    expect(promotable).toHaveLength(1);
    expect(promotable[0].id).toBe(inst.id);

    // Step 4: Promote
    const promoted = promoteInstinct(inst.id, 'lint-always-skill');
    expect(promoted).not.toBeNull();
    expect(promoted!.status).toBe('promoted');
    expect(promoted!.promotedTo).toBe('lint-always-skill');

    // No longer promotable
    expect(getPromotableInstincts(PROJECT)).toHaveLength(0);
    // No longer active
    expect(getActiveInstincts(PROJECT)).toHaveLength(0);
  });

  it('completes contradiction lifecycle: create → contradict → status change', () => {
    const inst = createInstinct(PROJECT, 'avoid mocks', 'use real DB', 'sess-6');
    expect(inst.contradictions).toBe(0);

    // First contradiction: contradictions=1, occurrences=1, NOT > so still active
    const c1 = contradictInstinct(inst.id);
    expect(c1!.contradictions).toBe(1);
    expect(c1!.status).toBe('active');

    // Second contradiction: contradictions=2 > occurrences=1 → contradicted
    const c2 = contradictInstinct(inst.id);
    expect(c2!.contradictions).toBe(2);
    expect(c2!.status).toBe('contradicted');

    // No longer in active instincts
    expect(getActiveInstincts(PROJECT)).toHaveLength(0);
  });

  it('prunes low-confidence instincts', () => {
    // Create a low-confidence instinct directly via upsert
    upsertInstinct({
      id: 'low-conf-eval',
      projectHash: PROJECT,
      pattern: 'weak pattern',
      action: 'weak action',
      confidence: 0.1,
      occurrences: 1,
      contradictions: 0,
      status: 'active',
    });

    // Verify it exists as active
    expect(getActiveInstincts(PROJECT)).toHaveLength(1);

    // Prune — should archive low confidence (<0.2) + low occurrences (<2)
    const pruned = pruneInstincts(PROJECT);
    expect(pruned).toBeGreaterThanOrEqual(1);

    // Verify archived
    const after = getInstinct('low-conf-eval');
    expect(after!.status).toBe('archived');
    expect(getActiveInstincts(PROJECT)).toHaveLength(0);
  });

  it('generates correct markdown summary', () => {
    createInstinct(PROJECT, 'always test', 'run vitest', 'sess-7');
    createInstinct(PROJECT, 'read first', 'Read before Edit', 'sess-8');

    const summary = getInstinctSummary(PROJECT);
    expect(summary).toContain('### Active Instincts (2)');
    expect(summary).toContain('always test');
    expect(summary).toContain('read first');

    // Empty project returns message
    expect(getInstinctSummary('empty-proj')).toBe('No active instincts.');
  });
});
