import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb, closeDb, getInstinct } from '../../scripts/lib/state-store.js';
import {
  createInstinct, reinforceInstinct, contradictInstinct,
  promoteInstinct, pruneInstincts, getInstinctSummary,
} from '../../scripts/lib/instinct-manager.js';

describe('instinct-manager', () => {
  beforeEach(async () => {
    await openDb(':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  it('creates an instinct with default confidence 0.3', () => {
    const inst = createInstinct('proj1', 'always run tests', 'run vitest', 'sess-1');
    expect(inst.confidence).toBe(0.3);
    expect(inst.occurrences).toBe(1);
    expect(inst.status).toBe('active');
    expect(inst.scope).toBe('project');
    expect(inst.sourceSessions).toEqual(['sess-1']);
  });

  it('reinforces instinct and increases confidence by 0.1', () => {
    const inst = createInstinct('proj1', 'pattern', 'action', 'sess-1');
    const reinforced = reinforceInstinct(inst.id, 'sess-2');
    expect(reinforced).not.toBeNull();
    expect(reinforced!.confidence).toBeCloseTo(0.4);
    expect(reinforced!.occurrences).toBe(2);
    expect(reinforced!.sourceSessions).toContain('sess-2');
  });

  it('caps confidence at 0.9', () => {
    const inst = createInstinct('proj1', 'pattern', 'action', 'sess-1');
    let current = inst;
    for (let i = 0; i < 10; i++) {
      const r = reinforceInstinct(current.id, `sess-${i + 2}`);
      if (r) current = r;
    }
    expect(current.confidence).toBe(0.9);
  });

  it('does not duplicate session in sourceSessions', () => {
    const inst = createInstinct('proj1', 'p', 'a', 'sess-1');
    const r = reinforceInstinct(inst.id, 'sess-1');
    expect(r!.sourceSessions).toEqual(['sess-1']);
    expect(r!.occurrences).toBe(2);
  });

  it('contradicts instinct and sets status when contradictions exceed occurrences', () => {
    const inst = createInstinct('proj1', 'p', 'a', 'sess-1');
    // 1 occurrence, 0 contradictions → contradict twice
    const c1 = contradictInstinct(inst.id);
    expect(c1!.contradictions).toBe(1);
    expect(c1!.status).toBe('active'); // 1 contradiction = 1 occurrence, not >

    const c2 = contradictInstinct(inst.id);
    expect(c2!.contradictions).toBe(2);
    expect(c2!.status).toBe('contradicted'); // 2 > 1
  });

  it('promotes instinct when eligible', () => {
    const inst = createInstinct('proj1', 'p', 'a', 'sess-1');
    // Build up to promotable: confidence >= 0.7, occurrences >= 3
    reinforceInstinct(inst.id, 'sess-2'); // 0.4, occ=2
    reinforceInstinct(inst.id, 'sess-3'); // 0.5, occ=3
    reinforceInstinct(inst.id, 'sess-4'); // 0.6, occ=4
    reinforceInstinct(inst.id, 'sess-5'); // 0.7, occ=5

    const promoted = promoteInstinct(inst.id, 'my-new-skill');
    expect(promoted).not.toBeNull();
    expect(promoted!.status).toBe('promoted');
    expect(promoted!.promotedTo).toBe('my-new-skill');
  });

  it('refuses to promote when confidence too low', () => {
    const inst = createInstinct('proj1', 'p', 'a', 'sess-1');
    // confidence 0.3, occurrences 1
    expect(promoteInstinct(inst.id, 'skill')).toBeNull();
  });

  it('prunes low-confidence instincts', async () => {
    createInstinct('proj1', 'weak', 'a', 'sess-1');
    // Default confidence is 0.3, which is >= 0.2, so it won't be pruned by confidence alone
    // Create one with low confidence manually
    const { upsertInstinct } = await import('../../scripts/lib/state-store.js');
    upsertInstinct({
      id: 'low-inst', projectHash: 'proj1', pattern: 'lowconf', action: 'a',
      confidence: 0.1, occurrences: 1, contradictions: 0, status: 'active',
    });

    const count = pruneInstincts('proj1');
    expect(count).toBeGreaterThanOrEqual(1);

    const pruned = getInstinct('low-inst');
    expect(pruned!.status).toBe('archived');
  });

  it('getInstinctSummary returns formatted markdown', () => {
    createInstinct('proj1', 'always lint', 'run eslint', 'sess-1');
    const summary = getInstinctSummary('proj1');
    expect(summary).toContain('### Active Instincts');
    expect(summary).toContain('always lint');
  });

  it('getInstinctSummary returns message when no instincts', () => {
    expect(getInstinctSummary('empty')).toBe('No active instincts.');
  });

  it('returns null for nonexistent instinct operations', () => {
    expect(reinforceInstinct('nonexistent', 'sess-1')).toBeNull();
    expect(contradictInstinct('nonexistent')).toBeNull();
    expect(promoteInstinct('nonexistent', 'skill')).toBeNull();
  });
});
