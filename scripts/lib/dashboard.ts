// Kadmon Harness — CLI Dashboard
// Pure functions for data fetching and rendering.
// Entry point: scripts/dashboard.ts

import {
  getActiveInstincts,
  getRecentSessions,
  getCostBySession,
} from "./state-store.js";
import type { ObservabilityEvent } from "./types.js";

// ─── Types ───

export interface InstinctRow {
  pattern: string;
  confidence: number;
  occurrences: number;
  bar: string;
}

export interface SessionRow {
  date: string;
  branch: string;
  filesCount: number;
  cost: string;
  isLive: boolean;
}

export interface HookHealthRow {
  tool: string;
  total: number;
  failures: number;
  status: "OK" | "WARN" | "FAIL";
}

export interface CostRow {
  sessionId: string;
  date: string;
  totalCost: number;
  eventCount: number;
  isLive: boolean;
}

// ─── ANSI helpers ───

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

// ─── Rendering ───

export function renderConfidenceBar(confidence: number): string {
  const width = 10;
  const filled = Math.round(confidence * width);
  const empty = width - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
  return `[${bar}] ${confidence.toFixed(1)}`;
}

function statusColor(status: "OK" | "WARN" | "FAIL"): string {
  if (status === "OK") return GREEN;
  if (status === "WARN") return YELLOW;
  return RED;
}

// ─── Data fetching ───

export function getInstinctRows(projectHash: string): InstinctRow[] {
  const instincts = getActiveInstincts(projectHash);
  return instincts.map((i) => ({
    pattern: i.pattern,
    confidence: i.confidence,
    occurrences: i.occurrences,
    bar: renderConfidenceBar(i.confidence),
  }));
}

export function getSessionRows(projectHash: string, limit = 5): SessionRow[] {
  const sessions = getRecentSessions(projectHash, limit);
  return sessions.map((s) => ({
    date: s.startedAt ? s.startedAt.slice(0, 10) : "—",
    branch: s.branch || "—",
    filesCount: s.filesModified.length,
    cost: `$${s.estimatedCostUsd.toFixed(2)}`,
    isLive: !s.endedAt,
  }));
}

export function getHookHealthRows(
  events: ObservabilityEvent[],
): HookHealthRow[] {
  const relevant = events.filter(
    (e) => e.eventType === "tool_post" || e.eventType === "tool_fail",
  );
  if (relevant.length === 0) return [];

  const stats = new Map<string, { total: number; failures: number }>();

  for (const event of relevant) {
    const tool = event.toolName;
    const entry = stats.get(tool) ?? { total: 0, failures: 0 };
    entry.total++;
    if (event.success === false) entry.failures++;
    stats.set(tool, entry);
  }

  return Array.from(stats.entries()).map(([tool, s]) => {
    let status: "OK" | "WARN" | "FAIL";
    if (s.failures === 0) {
      status = "OK";
    } else if (s.failures === s.total) {
      status = "FAIL";
    } else {
      status = "WARN";
    }
    return { tool, total: s.total, failures: s.failures, status };
  });
}

export function getCostRows(projectHash: string, limit = 5): CostRow[] {
  const sessions = getRecentSessions(projectHash, limit);
  return sessions.map((s) => {
    const events = getCostBySession(s.id);
    return {
      sessionId: s.id,
      date: s.startedAt ? s.startedAt.slice(0, 10) : "—",
      totalCost: s.estimatedCostUsd,
      eventCount: events.length,
      isLive: !s.endedAt,
    };
  });
}

// ─── Full dashboard render ───

export function renderDashboard(
  projectHash: string,
  events: ObservabilityEvent[],
): string {
  const lines: string[] = [];

  // Header
  lines.push(`${BOLD}${CYAN}╔══════════════════════════════════════╗${RESET}`);
  lines.push(`${BOLD}${CYAN}║       KADMON HARNESS DASHBOARD       ║${RESET}`);
  lines.push(`${BOLD}${CYAN}╚══════════════════════════════════════╝${RESET}`);
  lines.push("");

  // Instincts
  lines.push(`${BOLD}── INSTINCTS ──${RESET}`);
  const instincts = getInstinctRows(projectHash);
  if (instincts.length === 0) {
    lines.push(`  ${DIM}No active instincts${RESET}`);
  } else {
    for (const row of instincts) {
      lines.push(
        `  ${row.bar}  ${row.pattern} ${DIM}(${row.occurrences}x)${RESET}`,
      );
    }
  }
  lines.push("");

  // Sessions
  lines.push(`${BOLD}── SESSIONS ──${RESET}`);
  const sessions = getSessionRows(projectHash);
  if (sessions.length === 0) {
    lines.push(`  ${DIM}No recent sessions${RESET}`);
  } else {
    lines.push(
      `  ${DIM}Date        Branch                 Files  Cost${RESET}`,
    );
    for (const row of sessions) {
      const branch = row.branch.padEnd(22).slice(0, 22);
      const files = String(row.filesCount).padStart(5);
      const liveTag = row.isLive ? ` ${YELLOW}(live)${RESET}` : "";
      lines.push(`  ${row.date}  ${branch} ${files}  ${row.cost}${liveTag}`);
    }
  }
  lines.push("");

  // Costs
  lines.push(`${BOLD}── COSTS ──${RESET}`);
  const costs = getCostRows(projectHash);
  if (costs.length === 0) {
    lines.push(`  ${DIM}No cost data${RESET}`);
  } else {
    lines.push(`  ${DIM}Date        Session          Events  Cost${RESET}`);
    for (const row of costs) {
      const sid = row.sessionId.slice(0, 16).padEnd(16);
      const evts = String(row.eventCount).padStart(6);
      const liveTag = row.isLive ? ` ${YELLOW}(live)${RESET}` : "";
      lines.push(
        `  ${row.date}  ${sid} ${evts}  $${row.totalCost.toFixed(2)}${liveTag}`,
      );
    }
  }
  lines.push("");

  // Hook Health
  lines.push(`${BOLD}── HOOK HEALTH ──${RESET}`);
  const hooks = getHookHealthRows(events);
  if (hooks.length === 0) {
    lines.push(`  ${DIM}No observations${RESET}`);
  } else {
    lines.push(`  ${DIM}Tool       Total  Fail  Status${RESET}`);
    for (const row of hooks) {
      const tool = row.tool.padEnd(10).slice(0, 10);
      const total = String(row.total).padStart(5);
      const fail = String(row.failures).padStart(5);
      const color = statusColor(row.status);
      lines.push(`  ${tool} ${total} ${fail}  ${color}${row.status}${RESET}`);
    }
  }

  return lines.join("\n");
}
