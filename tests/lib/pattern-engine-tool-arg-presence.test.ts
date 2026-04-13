// TDD [feniks] — Phase 3 RED
// detectToolArgPresencePattern does not exist yet in pattern-engine.ts.
// These tests MUST fail RED. Do NOT implement until Green phase.

import { describe, it, expect } from 'vitest';
import type { PatternDefinition } from '../../scripts/lib/types.js';
import {
  detectToolArgPresencePattern,
  evaluatePatterns,
} from '../../scripts/lib/pattern-engine.js';

// ─── Helper builder ───
// Produces a JSON string matching the observe-pre tool_pre event shape.
// { timestamp, sessionId, eventType, toolName, metadata: { skillName, ... } }
function argLine({
  toolName,
  metadata,
}: {
  toolName: string;
  metadata?: Record<string, unknown>;
}): string {
  const event: Record<string, unknown> = {
    timestamp: "2026-04-12T10:00:00.000Z",
    sessionId: "test-session",
    eventType: "tool_pre",
    toolName,
  };
  if (metadata !== undefined) event["metadata"] = metadata;
  return JSON.stringify(event);
}

// ─── detectToolArgPresencePattern ───

describe("detectToolArgPresencePattern", () => {
  it("counts tool_pre events where metadata[key] contains expectedValue (happy path)", () => {
    const lines = [
      argLine({ toolName: "Skill", metadata: { skillName: "skill-creator:skill-creator" } }),
      argLine({ toolName: "Skill", metadata: { skillName: "other-skill" } }),
      argLine({ toolName: "Skill", metadata: { skillName: "skill-creator:skill-creator" } }),
    ];
    const result = detectToolArgPresencePattern(lines, {
      toolName: "Skill",
      metadataKey: "skillName",
      expectedValues: ["skill-creator"],
    });
    expect(result).toBe(2);
  });

  it("returns 0 when toolName does not match", () => {
    const lines = [
      argLine({ toolName: "Edit", metadata: { skillName: "skill-creator:skill-creator" } }),
      argLine({ toolName: "Edit", metadata: { skillName: "skill-creator:skill-creator" } }),
    ];
    const result = detectToolArgPresencePattern(lines, {
      toolName: "Skill",
      metadataKey: "skillName",
      expectedValues: ["skill-creator"],
    });
    expect(result).toBe(0);
  });

  it("returns 0 when metadata key is missing", () => {
    const lines = [
      argLine({ toolName: "Skill", metadata: { otherKey: "skill-creator:skill-creator" } }),
      argLine({ toolName: "Skill" }),
      argLine({ toolName: "Skill", metadata: {} }),
    ];
    const result = detectToolArgPresencePattern(lines, {
      toolName: "Skill",
      metadataKey: "skillName",
      expectedValues: ["skill-creator"],
    });
    expect(result).toBe(0);
  });

  it("matches any expectedValue (OR semantics)", () => {
    const lines = [
      argLine({ toolName: "Skill", metadata: { skillName: "foo:bar" } }),
      argLine({ toolName: "Skill", metadata: { skillName: "baz:qux" } }),
    ];
    const result = detectToolArgPresencePattern(lines, {
      toolName: "Skill",
      metadataKey: "skillName",
      expectedValues: ["foo", "baz"],
    });
    expect(result).toBe(2);
  });

  it("handles malformed JSONL without crashing", () => {
    const lines = [
      "not json",
      '{"broken',
      argLine({ toolName: "Skill", metadata: { skillName: "skill-creator:skill-creator" } }),
    ];
    const result = detectToolArgPresencePattern(lines, {
      toolName: "Skill",
      metadataKey: "skillName",
      expectedValues: ["skill-creator"],
    });
    expect(result).toBe(1);
  });

  it("evaluatePatterns wires tool_arg_presence correctly", () => {
    const lines = [
      argLine({ toolName: "Skill", metadata: { skillName: "skill-creator:skill-creator" } }),
    ];
    const def: PatternDefinition = {
      type: "tool_arg_presence",
      name: "skill-creator-compliance",
      action: "remind_skill_creator",
      toolName: "Skill",
      metadataKey: "skillName",
      expectedValues: ["skill-creator"],
      threshold: 1,
    };

    // evaluatePatterns(definitions, toolSeq, lines) — current signature
    const results = evaluatePatterns([def], ["Skill"], lines);
    expect(results).toHaveLength(1);
    expect(results[0].count).toBe(1);
    expect(results[0].triggered).toBe(true);
  });
});
