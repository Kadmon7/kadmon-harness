import { describe, it, expect } from 'vitest';
import type { PatternDefinition } from '../../scripts/lib/types.js';
import {
  detectSequence,
  detectCommandSequence,
  detectCluster,
  evaluatePatterns,
  loadPatternDefinitions,
} from '../../scripts/lib/pattern-engine.js';
import path from 'node:path';

describe('pattern-engine', () => {
  // ─── detectSequence ───

  it('detects sequence pattern above threshold', () => {
    const toolSeq = ['Read', 'Edit', 'Read', 'Edit', 'Read', 'Edit', 'Read', 'Edit', 'Read', 'Edit'];
    expect(detectSequence(toolSeq, 'Read', 'Edit')).toBe(5);
  });

  it('ignores sequence below threshold', () => {
    const toolSeq = ['Read', 'Edit', 'Bash', 'Bash'];
    expect(detectSequence(toolSeq, 'Read', 'Edit')).toBe(1);
  });

  it('does not count non-adjacent pairs', () => {
    const toolSeq = ['Read', 'Grep', 'Edit']; // Grep breaks adjacency
    expect(detectSequence(toolSeq, 'Read', 'Edit')).toBe(0);
  });

  // ─── detectCommandSequence ───

  it('detects command_sequence pattern', () => {
    const lines = [
      '{"eventType":"tool_pre","toolName":"Bash","metadata":{"command":"npx vitest run"}}',
      '{"eventType":"tool_post","toolName":"Bash","success":true}',
      '{"eventType":"tool_pre","toolName":"Bash","metadata":{"command":"git commit -m \\"feat: test\\""}}',
    ];
    expect(detectCommandSequence(lines, ['vitest'], ['git commit'])).toBe(1);
  });

  it('resets flag after match in command_sequence', () => {
    const lines = [
      '{"eventType":"tool_pre","toolName":"Bash","metadata":{"command":"npx vitest run"}}',
      '{"eventType":"tool_pre","toolName":"Bash","metadata":{"command":"git push"}}',
      '{"eventType":"tool_pre","toolName":"Bash","metadata":{"command":"npx tsc --noEmit"}}',
      '{"eventType":"tool_pre","toolName":"Bash","metadata":{"command":"git commit -m \\"fix: x\\""}}',
    ];
    expect(detectCommandSequence(lines, ['vitest', 'tsc --noEmit'], ['git commit', 'git push'])).toBe(2);
  });

  it('counts trigger commands without followers as 0', () => {
    const lines = [
      '{"eventType":"tool_pre","toolName":"Bash","metadata":{"command":"npx vitest run"}}',
    ];
    // triggerCommands present but no followedByCommands to match
    // When followedByCommands is empty, count trigger occurrences directly
    expect(detectCommandSequence(lines, ['vitest'], [])).toBe(1);
  });

  // ─── detectCluster ───

  it('detects cluster pattern', () => {
    const toolSeq = ['Read', 'Read', 'Read', 'Edit', 'Read', 'Read', 'Read', 'Read', 'Bash'];
    expect(detectCluster(toolSeq, 'Read', 3)).toBe(2);
  });

  it('counts trailing cluster', () => {
    const toolSeq = ['Bash', 'Read', 'Read', 'Read'];
    expect(detectCluster(toolSeq, 'Read', 3)).toBe(1);
  });

  it('ignores clusters below minSize', () => {
    const toolSeq = ['Read', 'Read', 'Edit', 'Read', 'Read', 'Bash'];
    expect(detectCluster(toolSeq, 'Read', 3)).toBe(0);
  });

  // ─── evaluatePatterns ───

  it('returns all patterns with triggered status', () => {
    const defs: PatternDefinition[] = [
      { type: 'sequence', name: 'p1', action: 'a1', before: 'Read', after: 'Edit', threshold: 2 },
      { type: 'cluster', name: 'p2', action: 'a2', tool: 'Read', minClusterSize: 3, threshold: 1 },
    ];
    const toolSeq = ['Read', 'Edit', 'Read', 'Edit', 'Read', 'Edit'];
    const results = evaluatePatterns(defs, toolSeq, []);
    expect(results).toHaveLength(2);
    expect(results[0].triggered).toBe(true);
    expect(results[0].count).toBe(3);
    expect(results[1].triggered).toBe(false); // no clusters of 3 consecutive
  });

  it('handles empty observations gracefully', () => {
    const defs: PatternDefinition[] = [
      { type: 'sequence', name: 'p1', action: 'a1', before: 'Read', after: 'Edit', threshold: 3 },
    ];
    const results = evaluatePatterns(defs, [], []);
    expect(results).toHaveLength(1);
    expect(results[0].triggered).toBe(false);
    expect(results[0].count).toBe(0);
  });

  it('handles malformed JSONL lines without crashing', () => {
    const defs: PatternDefinition[] = [
      { type: 'command_sequence', name: 'p1', action: 'a1', triggerCommands: ['vitest'], followedByCommands: ['git push'], threshold: 1 },
    ];
    const lines = ['not json', '{"broken', '{"eventType":"tool_pre","toolName":"Bash","metadata":{"command":"vitest"}}'];
    const results = evaluatePatterns(defs, [], lines);
    expect(results).toHaveLength(1);
    // Should not crash, just process what it can
  });

  // ─── loadPatternDefinitions ───

  const DEFS_PATH = path.resolve('.claude/hooks/pattern-definitions.json');

  it('loads definitions from JSON file', () => {
    const defs = loadPatternDefinitions(DEFS_PATH);

    // Assertion 1 — exact count (ADR-006: 12 baseline + 3 Python parallels added in plan-020 Phase D = 15)
    expect(defs.length).toBe(15);

    // Structural sanity — every def has the required base fields
    expect(defs[0]).toHaveProperty('type');
    expect(defs[0]).toHaveProperty('name');
    expect(defs[0]).toHaveProperty('action');
    expect(defs[0]).toHaveProperty('threshold');

    // Assertion 2 — banned hygiene names (regression guard)
    const banned = [
      "Read files before editing them",
      "Verify before committing code",
      "Explore multiple files before taking action",
      "Search before writing new code",
      "Test after implementing changes",
      "Check dashboard for system health",
      "Plan before implementing changes",
      "Read tests alongside source code",
      "Commit before pushing",
      "Re-run tests after fixing failures",
      "Multi-file refactor pattern",
      "Glob search before editing",
      "Build after editing TypeScript",
    ];
    for (const def of defs) {
      expect(banned).not.toContain(def.name);
    }

    // Assertion 3 — every def has a valid type
    const validTypes = ["sequence", "command_sequence", "cluster", "file_sequence", "tool_arg_presence"];
    for (const def of defs) {
      expect(validTypes).toContain(def.type);
    }

    // Assertion 4 — type distribution per ADR-006 Decision 1
    const counts = { file_sequence: 0, tool_arg_presence: 0, cluster: 0 };
    for (const def of defs) {
      if (def.type in counts) counts[def.type as keyof typeof counts]++;
    }
    expect(counts.file_sequence).toBe(13);
    expect(counts.tool_arg_presence).toBe(1);
    expect(counts.cluster).toBe(1);
  });

  it('all file_sequence definitions start at threshold 1', () => {
    const defs = loadPatternDefinitions(DEFS_PATH);
    for (const def of defs) {
      if (def.type === 'file_sequence') {
        expect(def.threshold).toBe(1);
      }
    }
  });
});
