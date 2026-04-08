// Kadmon Harness — CLI Dashboard
// Pure functions for data fetching and rendering.
// Entry point: scripts/dashboard.ts

import {
  getActiveInstincts,
  getPromotableInstincts,
  getRecentSessions,
  getCostSummaryByModel,
  getInstinctCounts,
  getHookEventStats,
  getAgentInvocationStats,
  getDb,
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
  costNum: number;
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

interface HookStatRow {
  hookName: string;
  total: number;
  blocks: number;
  avgDurationMs: number;
}

interface AgentStatRow {
  agentType: string;
  total: number;
  avgDurationMs: number;
  failureRate: number;
}

interface DbStatusRow {
  table: string;
  count: number;
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
const WHITE = "\x1b[37m";
const _BG_CYAN = "\x1b[46m";
const BG_GREEN = "\x1b[42m";
const BG_YELLOW = "\x1b[43m";
const BG_RED = "\x1b[41m";
const BLACK = "\x1b[30m";

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

function fmtMs(ms: number): string {
  if (ms <= 0) return "\u2014";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function miniBar(value: number, max: number, width = 8, log = false): string {
  if (max <= 0 || value <= 0) return "\u2591".repeat(width);
  let ratio: number;
  if (log) {
    ratio = Math.log(value + 1) / Math.log(max + 1);
  } else {
    ratio = value / max;
  }
  const filled = Math.max(1, Math.round(ratio * width));
  return (
    "\u2588".repeat(Math.min(filled, width)) +
    "\u2591".repeat(Math.max(width - filled, 0))
  );
}

function statusBadge(status: "OK" | "WARN" | "FAIL" | "GOOD" | "MEH"): string {
  switch (status) {
    case "OK":
    case "GOOD":
      return `${BG_GREEN}${BLACK} ${status} ${RESET}`;
    case "WARN":
    case "MEH":
      return `${BG_YELLOW}${BLACK} ${status} ${RESET}`;
    case "FAIL":
      return `${BG_RED}${WHITE} ${status} ${RESET}`;
  }
}

// ─── Rendering ───

export function renderConfidenceBar(confidence: number): string {
  const width = 10;
  const filled = Math.round(confidence * width);
  const empty = width - filled;
  const color = confidence >= 0.7 ? GREEN : confidence >= 0.4 ? YELLOW : RED;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
  return `${color}[${bar}]${RESET} ${confidence.toFixed(1)}`;
}

function sectionHeader(
  emoji: string,
  title: string,
  subtitle?: string,
): string {
  const sub = subtitle ? ` ${DIM}(${subtitle})${RESET}` : "";
  return `${BOLD}${CYAN}${emoji} ${title}${RESET}${sub}`;
}

function separator(): string {
  return `${DIM}${"─".repeat(60)}${RESET}`;
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

  let foundLive = false;
  const filtered = sessions.filter((s) => {
    const isLive = !s.endedAt;
    const isGhost = s.messageCount === 0 && s.filesModified.length === 0;

    if (isLive && !foundLive) {
      foundLive = true;
      return true;
    }
    if (isLive && foundLive) return false;
    if (isGhost) return false;
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
    costNum: s.estimatedCostUsd,
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

function getHookStatRows(projectHash: string): HookStatRow[] {
  return getHookEventStats(projectHash);
}

function getAgentStatRows(projectHash: string): AgentStatRow[] {
  return getAgentInvocationStats(projectHash);
}

function getDbStatus(): DbStatusRow[] {
  const tables = [
    "sessions",
    "instincts",
    "cost_events",
    "hook_events",
    "agent_invocations",
    "sync_queue",
  ];
  return tables.map((table) => {
    const row = getDb().prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get();
    return { table, count: Number(row?.cnt ?? 0) };
  });
}

// ─── Health Score ───

function computeHealthScore(
  projectHash: string,
  sessions: SessionRow[],
  hookStats: HookStatRow[],
  agentStats: AgentStatRow[],
): { score: number; label: string; color: string } {
  let score = 100;

  // Penalize if no recent sessions
  if (sessions.length === 0) score -= 20;

  // Penalize high hook block rate
  const totalHookEvents = hookStats.reduce((sum, h) => sum + h.total, 0);
  const totalBlocks = hookStats.reduce((sum, h) => sum + h.blocks, 0);
  if (totalHookEvents > 0) {
    const blockRate = totalBlocks / totalHookEvents;
    if (blockRate > 0.3) score -= 15;
    else if (blockRate > 0.1) score -= 5;
  }

  // Penalize high agent failure rate
  const failingAgents = agentStats.filter((a) => a.failureRate > 0.5);
  score -= failingAgents.length * 10;

  // Penalize if instincts are stale (no promotable)
  const counts = getInstinctCounts(projectHash);
  if (counts.active === 0) score -= 10;

  score = Math.max(0, Math.min(100, score));

  let label: string;
  let color: string;
  if (score >= 90) {
    label = "EXCELLENT";
    color = GREEN;
  } else if (score >= 70) {
    label = "GOOD";
    color = GREEN;
  } else if (score >= 50) {
    label = "FAIR";
    color = YELLOW;
  } else {
    label = "NEEDS ATTENTION";
    color = RED;
  }

  return { score, label, color };
}

// ─── Full dashboard render ───

export function renderDashboard(
  projectHash: string,
  events: ObservabilityEvent[],
): string {
  const lines: string[] = [];

  // ═══ Header ═══
  lines.push("");
  lines.push(`${BOLD}${CYAN}  \u2554${"═".repeat(44)}\u2557${RESET}`);
  lines.push(
    `${BOLD}${CYAN}  \u2551  \u{1F9E0}  KADMON HARNESS DASHBOARD        \u2551${RESET}`,
  );
  lines.push(`${BOLD}${CYAN}  \u255A${"═".repeat(44)}\u255D${RESET}`);

  // Fetch all data
  const sessions = getSessionRows(projectHash);
  const hookStats = getHookStatRows(projectHash);
  const agentStats = getAgentStatRows(projectHash);
  const counts = getInstinctCounts(projectHash);
  const modelCosts = getModelCostRows(projectHash);

  // Health Score
  const health = computeHealthScore(
    projectHash,
    sessions,
    hookStats,
    agentStats,
  );
  const grandTotal = modelCosts.reduce((sum, r) => sum + r.totalCost, 0);
  const totalSessions = sessions.length;

  lines.push("");
  lines.push(
    `  ${health.color}${BOLD}\u{1F3AF} Health: ${health.score}/100 ${health.label}${RESET}` +
      `    ${DIM}|${RESET}  \u{1F4CA} ${totalSessions} sessions` +
      `    ${DIM}|${RESET}  \u{1F4B0} $${grandTotal.toFixed(2)} total`,
  );
  lines.push("");
  lines.push(separator());

  // ═══ 1. Instincts ═══
  const countLabel =
    counts.promotable > 0
      ? `${counts.active} active, ${MAGENTA}${counts.promotable} promotable${RESET}`
      : `${counts.active} active`;
  lines.push(sectionHeader("\u{1F52E}", "INSTINCTS", countLabel));
  lines.push("");

  const instincts = getInstinctRows(projectHash);
  if (instincts.length === 0) {
    lines.push(`  ${DIM}No active instincts${RESET}`);
  } else {
    for (const row of instincts) {
      const promoTag = row.isPromotable
        ? ` ${MAGENTA}\u2192 promote${RESET}`
        : "";
      lines.push(
        `  ${row.bar}  ${row.pattern} ${DIM}(${row.occurrences}x)${RESET}${promoTag}`,
      );
    }
  }
  lines.push("");
  lines.push(separator());

  // ═══ 2. Sessions ═══
  lines.push(sectionHeader("\u{1F4C5}", "RECENT SESSIONS"));
  lines.push("");

  if (sessions.length === 0) {
    lines.push(`  ${DIM}No recent sessions${RESET}`);
  } else {
    lines.push(
      `  ${DIM}Date        Branch              Files  Msgs  Cmps  Duration  Cost${RESET}`,
    );
    const maxCost = Math.max(...sessions.map((s) => s.costNum));
    for (const row of sessions) {
      const branch = row.branch.padEnd(18).slice(0, 18);
      const files = String(row.filesCount).padStart(5);
      const msgs = String(row.messageCount).padStart(5);
      const cmps = String(row.compactionCount).padStart(5);
      const dur = row.isLive
        ? "\u2014".padStart(8)
        : fmtDuration(row.durationMs).padStart(8);
      const costBar = miniBar(row.costNum, maxCost, 5);
      const liveTag = row.isLive ? ` ${YELLOW}\u{26A1}${RESET}` : "";
      lines.push(
        `  ${row.date}  ${branch} ${files} ${msgs} ${cmps}  ${dur}  ${row.cost} ${DIM}${costBar}${RESET}${liveTag}`,
      );
    }
    lines.push(`  ${DIM}\u{26A1} = live session${RESET}`);
  }
  lines.push("");
  lines.push(separator());

  // ═══ 3. Cost Summary ═══
  lines.push(sectionHeader("\u{1F4B0}", "COST SUMMARY", "by model"));
  lines.push("");

  if (modelCosts.length === 0) {
    lines.push(`  ${DIM}No cost data${RESET}`);
  } else {
    lines.push(
      `  ${DIM}Model              Sessions  Tokens In  Tokens Out   Cost${RESET}`,
    );
    for (const row of modelCosts) {
      const model = row.model.padEnd(18).slice(0, 18);
      const sess = String(row.sessionCount).padStart(8);
      const tokIn = fmtTokens(row.inputTokens).padStart(10);
      const tokOut = fmtTokens(row.outputTokens).padStart(10);
      const cost = `$${row.totalCost.toFixed(2)}`;
      lines.push(`  ${model} ${sess} ${tokIn} ${tokOut}  ${cost}`);
    }
    lines.push(`  ${"─".repeat(58)}`);
    lines.push(
      `  ${"Total".padEnd(18)} ${" ".repeat(8)} ${" ".repeat(10)} ${" ".repeat(10)}  ${GREEN}$${grandTotal.toFixed(2)}${RESET}`,
    );
  }
  lines.push("");
  lines.push(separator());

  // ═══ 4. Hook Events (from DB — persistent) ═══
  lines.push(sectionHeader("\u{1F6A8}", "HOOK EVENTS", "persistent"));
  lines.push("");

  if (hookStats.length === 0) {
    lines.push(`  ${DIM}No hook events recorded yet${RESET}`);
  } else {
    lines.push(
      `  ${DIM}Hook                     Total  Blocks  Avg ms  Status${RESET}`,
    );
    for (const row of hookStats) {
      const name = row.hookName.padEnd(23).slice(0, 23);
      const total = String(row.total).padStart(5);
      const blocks = String(row.blocks).padStart(7);
      const avg = fmtMs(row.avgDurationMs).padStart(7);
      const blockRate = row.total > 0 ? row.blocks / row.total : 0;
      let status: "OK" | "WARN" | "FAIL";
      if (blockRate === 0) status = "OK";
      else if (blockRate < 0.5) status = "WARN";
      else status = "FAIL";
      lines.push(`  ${name} ${total} ${blocks} ${avg}  ${statusBadge(status)}`);
    }
  }
  lines.push("");
  lines.push(separator());

  // ═══ 5. Agent Usage (from DB — persistent) ═══
  lines.push(sectionHeader("\u{1F916}", "AGENT USAGE", "persistent"));
  lines.push("");

  if (agentStats.length === 0) {
    lines.push(`  ${DIM}No agent invocations recorded yet${RESET}`);
  } else {
    lines.push(
      `  ${DIM}Agent                Total  Avg Duration  Fail%  Status${RESET}`,
    );
    for (const row of agentStats) {
      const name = row.agentType.padEnd(19).slice(0, 19);
      const total = String(row.total).padStart(5);
      const avgDur = fmtMs(row.avgDurationMs).padStart(13);
      const failPct = `${(row.failureRate * 100).toFixed(0)}%`.padStart(6);
      let status: "OK" | "WARN" | "FAIL";
      if (row.failureRate === 0) status = "OK";
      else if (row.failureRate < 0.3) status = "WARN";
      else status = "FAIL";
      lines.push(
        `  ${name}  ${total} ${avgDur} ${failPct}  ${statusBadge(status)}`,
      );
    }
  }
  lines.push("");
  lines.push(separator());

  // ═══ 6. Live Session Health (from JSONL — current session only) ═══
  const hooks = getHookHealthRows(events);
  if (hooks.length > 0) {
    lines.push(sectionHeader("\u{26A1}", "LIVE SESSION", "current"));
    lines.push("");
    lines.push(`  ${DIM}Tool            Total  Fail  Status${RESET}`);
    for (const row of hooks) {
      const tool = row.tool.padEnd(14).slice(0, 14);
      const total = String(row.total).padStart(5);
      const fail = String(row.failures).padStart(5);
      lines.push(`  ${tool} ${total} ${fail}  ${statusBadge(row.status)}`);
    }
    lines.push("");
    lines.push(separator());
  }

  // ═══ 7. DB Status ═══
  lines.push(sectionHeader("\u{1F4BE}", "DATABASE", "kadmon.db"));
  lines.push("");

  const dbRows = getDbStatus();
  const maxCount = Math.max(...dbRows.map((r) => r.count));
  for (const row of dbRows) {
    const name = row.table.padEnd(22);
    const count = String(row.count).padStart(6);
    const bar = miniBar(row.count, maxCount, 10, true);
    lines.push(`  ${name} ${count}  ${DIM}${bar}${RESET}`);
  }

  // Footer
  lines.push("");
  lines.push(
    `  ${DIM}v1.0 | ${new Date().toISOString().slice(0, 19)} | project: ${projectHash.slice(0, 8)}${RESET}`,
  );
  lines.push("");

  return lines.join("\n");
}
