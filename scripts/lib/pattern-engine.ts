// Kadmon Harness — Configurable Pattern Engine
// Detects behavioral patterns from session observations.
// Definitions loaded from .claude/hooks/pattern-definitions.json.

import fs from "node:fs";
import type { PatternDefinition, PatternResult } from "./types.js";

// ─── Detectors ───

export function detectSequence(
  toolSeq: string[],
  before: string,
  after: string,
): number {
  let count = 0;
  for (let i = 1; i < toolSeq.length; i++) {
    if (toolSeq[i] === after && toolSeq[i - 1] === before) count++;
  }
  return count;
}

export function detectCommandSequence(
  lines: string[],
  triggerCommands: string[],
  followedByCommands: string[],
): number {
  // When followedByCommands is empty, count trigger occurrences directly
  if (followedByCommands.length === 0) {
    let count = 0;
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        if (e.eventType !== "tool_pre") continue;
        const cmd: string = e.metadata?.command ?? "";
        if (triggerCommands.some((t: string) => cmd.includes(t))) count++;
      } catch {
        /* skip malformed */
      }
    }
    return count;
  }

  // Stateful: trigger sets flag, follower consumes it
  let count = 0;
  let hasTrigger = false;
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      if (e.eventType !== "tool_pre") continue;
      const cmd: string = e.metadata?.command ?? "";
      if (triggerCommands.some((t: string) => cmd.includes(t)))
        hasTrigger = true;
      if (
        hasTrigger &&
        followedByCommands.some((f: string) => cmd.includes(f))
      ) {
        count++;
        hasTrigger = false;
      }
    } catch {
      /* skip malformed */
    }
  }
  return count;
}

export function detectCluster(
  toolSeq: string[],
  tool: string,
  minSize: number,
): number {
  let clusters = 0;
  let consecutive = 0;
  for (const t of toolSeq) {
    if (t === tool) {
      consecutive++;
    } else {
      if (consecutive >= minSize) clusters++;
      consecutive = 0;
    }
  }
  if (consecutive >= minSize) clusters++;
  return clusters;
}

// ─── Orchestrator ───

export function evaluatePatterns(
  definitions: PatternDefinition[],
  toolSeq: string[],
  lines: string[],
): PatternResult[] {
  return definitions.map((def) => {
    let count = 0;

    switch (def.type) {
      case "sequence":
        count = detectSequence(toolSeq, def.before, def.after);
        break;
      case "command_sequence":
        count = detectCommandSequence(
          lines,
          def.triggerCommands,
          def.followedByCommands,
        );
        break;
      case "cluster":
        count = detectCluster(toolSeq, def.tool, def.minClusterSize);
        break;
    }

    return {
      name: def.name,
      action: def.action,
      count,
      threshold: def.threshold,
      triggered: count >= def.threshold,
      domain: def.domain,
    };
  });
}

// ─── Loader ───

export function loadPatternDefinitions(filePath: string): PatternDefinition[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed))
    throw new Error("pattern-definitions.json must be an array");
  return parsed as PatternDefinition[];
}
