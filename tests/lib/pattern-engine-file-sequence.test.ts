// TDD [feniks] — Phase 2 RED
// detectFileSequencePattern does not exist yet in pattern-engine.ts.
// These tests MUST fail RED. Do NOT implement until Green phase.

import { describe, it, expect } from 'vitest';
import type { PatternDefinition } from '../../scripts/lib/types.js';
import {
  detectFileSequencePattern,
  evaluatePatterns,
} from '../../scripts/lib/pattern-engine.js';

// ─── Helper builder ───
// Produces a JSON string matching the observe-pre tool_pre event shape.
// { timestamp, sessionId, eventType, toolName, filePath, metadata: { command, ... } }
function fileSeqLine({
  toolName,
  filePath,
  command,
}: {
  toolName: string;
  filePath?: string;
  command?: string;
}): string {
  const event: Record<string, unknown> = {
    timestamp: "2026-04-12T10:00:00.000Z",
    sessionId: "test-session",
    eventType: "tool_pre",
    toolName,
  };
  if (filePath !== undefined) event["filePath"] = filePath;
  if (command !== undefined) event["metadata"] = { command };
  return JSON.stringify(event);
}

// ─── detectFileSequencePattern ───

describe("detectFileSequencePattern", () => {
  it("detects Edit on matching glob followed by Bash matching followedByCommand (happy path)", () => {
    const lines = [
      fileSeqLine({ toolName: "Edit", filePath: "scripts/lib/types.ts" }),
      fileSeqLine({ toolName: "Bash", command: "npm run build" }),
      fileSeqLine({ toolName: "Read", filePath: "scripts/lib/state-store.ts" }),
    ];
    const result = detectFileSequencePattern(lines, {
      editTools: ["Edit", "Write"],
      filePathGlob: "**/types.ts",
      followedByCommands: ["npm run build", "tsc"],
      withinToolCalls: 5,
    });
    expect(result).toBe(1);
  });

  it("does not count when filePath does not match glob", () => {
    const lines = [
      fileSeqLine({ toolName: "Edit", filePath: "scripts/lib/state-store.ts" }),
      fileSeqLine({ toolName: "Bash", command: "npm run build" }),
    ];
    const result = detectFileSequencePattern(lines, {
      editTools: ["Edit", "Write"],
      filePathGlob: "**/types.ts",
      followedByCommands: ["npm run build"],
      withinToolCalls: 5,
    });
    expect(result).toBe(0);
  });

  it("does not count when follow-up Bash command substring is absent", () => {
    const lines = [
      fileSeqLine({ toolName: "Edit", filePath: "scripts/lib/types.ts" }),
      fileSeqLine({ toolName: "Bash", command: "git status" }),
    ];
    const result = detectFileSequencePattern(lines, {
      editTools: ["Edit", "Write"],
      filePathGlob: "**/types.ts",
      followedByCommands: ["npm run build"],
      withinToolCalls: 5,
    });
    expect(result).toBe(0);
  });

  it("respects withinToolCalls window — follow-up outside window does not count", () => {
    const fillers = [
      fileSeqLine({ toolName: "Read", filePath: "a.ts" }),
      fileSeqLine({ toolName: "Read", filePath: "b.ts" }),
      fileSeqLine({ toolName: "Read", filePath: "c.ts" }),
      fileSeqLine({ toolName: "Read", filePath: "d.ts" }),
      fileSeqLine({ toolName: "Read", filePath: "e.ts" }),
      fileSeqLine({ toolName: "Read", filePath: "f.ts" }),
    ];
    const lines = [
      fileSeqLine({ toolName: "Edit", filePath: "scripts/lib/types.ts" }),
      ...fillers, // 6 filler events — exceeds withinToolCalls: 5
      fileSeqLine({ toolName: "Bash", command: "npm run build" }),
    ];
    const result = detectFileSequencePattern(lines, {
      editTools: ["Edit", "Write"],
      filePathGlob: "**/types.ts",
      followedByCommands: ["npm run build"],
      withinToolCalls: 5,
    });
    expect(result).toBe(0);
  });

  it("counts multiple independent matches without double-consuming the follow-up", () => {
    const lines = [
      fileSeqLine({ toolName: "Edit", filePath: "scripts/lib/types.ts" }),
      fileSeqLine({ toolName: "Bash", command: "npm run build" }),
      fileSeqLine({ toolName: "Edit", filePath: "scripts/lib/types.ts" }),
      fileSeqLine({ toolName: "Bash", command: "npm run build" }),
    ];
    const result = detectFileSequencePattern(lines, {
      editTools: ["Edit", "Write"],
      filePathGlob: "**/types.ts",
      followedByCommands: ["npm run build"],
      withinToolCalls: 5,
    });
    expect(result).toBe(2);
  });

  it("does not count non-edit tools even on matching file", () => {
    const lines = [
      fileSeqLine({ toolName: "Read", filePath: "scripts/lib/types.ts" }),
      fileSeqLine({ toolName: "Bash", command: "npm run build" }),
    ];
    const result = detectFileSequencePattern(lines, {
      editTools: ["Edit", "Write"],
      filePathGlob: "**/types.ts",
      followedByCommands: ["npm run build"],
      withinToolCalls: 5,
    });
    expect(result).toBe(0);
  });

  it("accepts Write as well as Edit when editTools includes both", () => {
    const lines = [
      fileSeqLine({ toolName: "Write", filePath: "scripts/lib/types.ts" }),
      fileSeqLine({ toolName: "Bash", command: "npm run build" }),
    ];
    const result = detectFileSequencePattern(lines, {
      editTools: ["Edit", "Write"],
      filePathGlob: "**/types.ts",
      followedByCommands: ["npm run build"],
      withinToolCalls: 5,
    });
    expect(result).toBe(1);
  });

  it("normalizes Windows backslash paths before glob matching", () => {
    // The JSON string uses escaped backslashes so the parsed value contains single backslashes:
    // filePath value = "scripts\lib\types.ts"
    // The detector must normalize backslash to forward slash before glob matching.
    // TODO Phase 2 GREEN: this test exercises the cross-platform contract — do not weaken.
    const rawLine =
      '{"timestamp":"2026-04-12T10:00:00.000Z","sessionId":"test-session","eventType":"tool_pre","toolName":"Edit","filePath":"scripts\\\\lib\\\\types.ts"}';
    const lines = [
      rawLine,
      fileSeqLine({ toolName: "Bash", command: "npm run build" }),
    ];
    const result = detectFileSequencePattern(lines, {
      editTools: ["Edit", "Write"],
      filePathGlob: "**/types.ts",
      followedByCommands: ["npm run build"],
      withinToolCalls: 5,
    });
    expect(result).toBe(1);
  });

  it("handles malformed JSONL lines without crashing", () => {
    const lines = [
      "not json",
      '{"broken',
      fileSeqLine({ toolName: "Edit", filePath: "scripts/lib/types.ts" }),
      fileSeqLine({ toolName: "Bash", command: "npm run build" }),
    ];
    const result = detectFileSequencePattern(lines, {
      editTools: ["Edit", "Write"],
      filePathGlob: "**/types.ts",
      followedByCommands: ["npm run build"],
      withinToolCalls: 5,
    });
    expect(result).toBe(1);
  });

  it("evaluatePatterns wires file_sequence correctly", () => {
    const lines = [
      fileSeqLine({ toolName: "Edit", filePath: "scripts/lib/types.ts" }),
      fileSeqLine({ toolName: "Bash", command: "npm run build" }),
    ];
    const def: PatternDefinition = {
      type: "file_sequence",
      name: "edit-then-build",
      action: "remind_typecheck",
      editTools: ["Edit", "Write"],
      filePathGlob: "**/types.ts",
      followedByCommands: ["npm run build", "tsc"],
      withinToolCalls: 5,
      threshold: 1,
    };

    // evaluatePatterns(definitions, toolSeq, lines) — current signature
    const results = evaluatePatterns([def], [], lines);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("edit-then-build");
    expect(results[0].count).toBe(1);
    expect(results[0].triggered).toBe(true);
  });
});
