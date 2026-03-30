// Kadmon Harness — CLI Dashboard
// Pure functions for data fetching and rendering.
// Entry point: scripts/dashboard.ts

import {
  getActiveInstincts,
  getPromotableInstincts,
  getRecentSessions,
  getCostSummaryByModel,
  getInstinctCounts,
} from "./state-store.js";
import type { ObservabilityEvent } from "./types.js";

// ─── Types ───

export interface InstinctRow {
  pattern: string;
  confidence: number;
  occurrences: number;
  bar: string;
  isPromotable: boolean;
}

export interface SessionRow {
  date: string;
  branch: string;
  filesCount: number;
  messageCount: number;
  compactionCount: number;
  durationMs: number;
  cost: string;
  isLive: boolean;
}

export interface HookHealthRow {
  tool: string;
  total: number;
  failures: number;
  status: "OK" | "WARN" | "FAIL";
}

export interface ModelCostRow {
  model: string;
  sessionCount: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
}

// ─── ANSI helpers ───

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";

// ─── Formatting helpers ───

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return "\u2014";
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

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
  const promotableSet = new Set(
    getPromotableInstincts(projectHash).map((i) => i.id),
  );
  return instincts.map((i) => ({
    pattern: i.pattern,
    confidence: i.confidence,
    occurrences: i.occurrences,
    bar: renderConfidenceBar(i.confidence),
    isPromotable: promotableSet.has(i.id),
  }));
}

export function getSessionRows(projectHash: string, limit = 5): SessionRow[] {
  const sessions = getRecentSessions(projectHash, limit + 10);

  // Filter ghost sessions (0 msgs, 0 files, not live) but keep the most recent live session
  let foundLive = false;
  const filtered = sessions.filter((s) => {
    const isLive = !s.endedAt;
    const isGhost = s.messageCount === 0 && s.filesModified.length === 0;

    if (isLive && !foundLive) {
      foundLive = true;
      return true; // keep the current live session
    }
    if (isLive && foundLive) return false; // skip extra live sessions
    if (isGhost) return false; // skip ghost sessions
    return true;
  });

  return filtered.slice(0, limit).map((s) => ({
    date: s.startedAt ? s.startedAt.slice(0, 10) : "\u2014",
    branch: s.branch || "\u2014",
    filesCount: s.filesModified.length,
    messageCount: s.messageCount,
    compactionCount: s.compactionCount,
    durationMs: s.durationMs,
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

export function getModelCostRows(projectHash: string): ModelCostRow[] {
  return getCostSummaryByModel(projectHash).map((r) => ({
    model: r.model,
    sessionCount: r.sessionCount,
    inputTokens: r.totalInputTokens,
    outputTokens: r.totalOutputTokens,
    totalCost: r.totalCostUsd,
  }));
}

// ─── Full dashboard render ───

export function renderDashboard(
  projectHash: string,
  events: ObservabilityEvent[],
): string {
  const lines: string[] = [];

  // Header
  lines.push(`${BOLD}${CYAN}\u2554${"═".repeat(38)}\u2557${RESET}`);
  lines.push(
    `${BOLD}${CYAN}\u2551       KADMON HARNESS DASHBOARD       \u2551${RESET}`,
  );
  lines.push(`${BOLD}${CYAN}\u255A${"═".repeat(38)}\u255D${RESET}`);
  lines.push("");

  // Instincts (with promotable markers inline)
  const counts = getInstinctCounts(projectHash);
  const countLabel =
    counts.promotable > 0
      ? `${counts.active} active | ${MAGENTA}${counts.promotable} promotable${RESET}`
      : `${counts.active} active`;
  lines.push(
    `${BOLD}\u2500\u2500 INSTINCTS (${countLabel}${BOLD}) \u2500\u2500${RESET}`,
  );

  const instincts = getInstinctRows(projectHash);
  if (instincts.length === 0) {
    lines.push(`  ${DIM}No active instincts${RESET}`);
  } else {
    for (const row of instincts) {
      const promoTag = row.isPromotable
        ? ` ${MAGENTA}\u2192 /promote${RESET}`
        : "";
      lines.push(
        `  ${row.bar}  ${row.pattern} ${DIM}(${row.occurrences}x)${RESET}${promoTag}`,
      );
    }
  }
  lines.push("");

  // Sessions (filtered, with duration)
  lines.push(`${BOLD}\u2500\u2500 SESSIONS \u2500\u2500${RESET}`);
  const sessions = getSessionRows(projectHash);
  if (sessions.length === 0) {
    lines.push(`  ${DIM}No recent sessions${RESET}`);
  } else {
    lines.push(
      `  ${DIM}Date        Branch              Files  Msgs  Cmps  Duration  Cost${RESET}`,
    );
    for (const row of sessions) {
      const branch = row.branch.padEnd(18).slice(0, 18);
      const files = String(row.filesCount).padStart(5);
      const msgs = String(row.messageCount).padStart(5);
      const cmps = String(row.compactionCount).padStart(5);
      const dur = row.isLive
        ? "\u2014".padStart(8)
        : fmtDuration(row.durationMs).padStart(8);
      const liveTag = row.isLive ? `  ${YELLOW}*${RESET}` : "";
      lines.push(
        `  ${row.date}  ${branch} ${files} ${msgs} ${cmps}  ${dur}  ${row.cost}${liveTag}`,
      );
    }
    lines.push(`  ${DIM}* = live session${RESET}`);
  }
  lines.push("");

  // Cost Summary by Model
  lines.push(`${BOLD}\u2500\u2500 COST SUMMARY \u2500\u2500${RESET}`);
  const modelCosts = getModelCostRows(projectHash);
  if (modelCosts.length === 0) {
    lines.push(`  ${DIM}No cost data${RESET}`);
  } else {
    lines.push(
      `  ${DIM}Model              Sessions  Tokens In  Tokens Out   Cost${RESET}`,
    );
    let grandTotal = 0;
    for (const row of modelCosts) {
      const model = row.model.padEnd(18).slice(0, 18);
      const sess = String(row.sessionCount).padStart(8);
      const tokIn = fmtTokens(row.inputTokens).padStart(10);
      const tokOut = fmtTokens(row.outputTokens).padStart(10);
      const cost = `$${row.totalCost.toFixed(2)}`;
      grandTotal += row.totalCost;
      lines.push(`  ${model} ${sess} ${tokIn} ${tokOut}  ${cost}`);
    }
    lines.push(`  ${"─".repeat(58)}`);
    lines.push(
      `  ${"Total".padEnd(18)} ${" ".repeat(8)} ${" ".repeat(10)} ${" ".repeat(10)}  ${GREEN}$${grandTotal.toFixed(2)}${RESET}`,
    );
  }
  lines.push("");

  // Hook Health (wider tool column)
  lines.push(`${BOLD}\u2500\u2500 HOOK HEALTH \u2500\u2500${RESET}`);
  const hooks = getHookHealthRows(events);
  if (hooks.length === 0) {
    lines.push(`  ${DIM}No observations${RESET}`);
  } else {
    lines.push(`  ${DIM}Tool            Total  Fail  Status${RESET}`);
    for (const row of hooks) {
      const tool = row.tool.padEnd(14).slice(0, 14);
      const total = String(row.total).padStart(5);
      const fail = String(row.failures).padStart(5);
      const color = statusColor(row.status);
      lines.push(`  ${tool} ${total} ${fail}  ${color}${row.status}${RESET}`);
    }
  }

  return lines.join("\n");
}
