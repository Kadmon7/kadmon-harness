// Kadmon Harness — /medik Check #11: hook-health-24h (plan-028 Phase 4.5)
// Queries hook_events for the last 24h and warns on blocks or budget overruns.

import { getDb } from "../state-store.js";
import type { CheckContext, CheckResult } from "./types.js";

// Per-hook latency budgets in milliseconds (plan-028 §Phase 4.4)
const BUDGETS: Record<string, number> = {
  "observe-pre": 50,
  "observe-post": 50,
  "no-context-guard": 100,
  // default for all others: 500
};
const DEFAULT_BUDGET = 500;

interface HookRow {
  hook_name: string;
  blocks: number;
  avg_ms: number | null;
}

export function runCheck(ctx: CheckContext): CheckResult {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let rows: HookRow[];
  try {
    const db = getDb();
    rows = db
      .prepare(
        `SELECT he.hook_name,
                SUM(he.blocked) AS blocks,
                AVG(he.duration_ms) AS avg_ms
         FROM hook_events he
         JOIN sessions s ON he.session_id = s.id
         WHERE s.project_hash = ?
           AND he.timestamp > ?
         GROUP BY he.hook_name
         LIMIT 100`,
      )
      .all(ctx.projectHash, since) as unknown as HookRow[];
  } catch (e: unknown) {
    // DB not ready or schema mismatch — surface as NOTE (not false PASS) so the operator knows the check was skipped
    return {
      status: "NOTE",
      category: "runtime",
      message: `hook health check unavailable (DB error): ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (rows.length === 0) {
    return {
      status: "PASS",
      category: "runtime",
      message: "No hook health issues in last 24h",
    };
  }

  const issues: string[] = [];

  for (const row of rows) {
    const blocks = Number(row.blocks ?? 0);
    const avgMs = row.avg_ms !== null ? Math.round(Number(row.avg_ms)) : null;
    const budget = BUDGETS[row.hook_name] ?? DEFAULT_BUDGET;

    if (blocks > 0) {
      issues.push(`${row.hook_name}: ${blocks} block(s) in last 24h`);
    }
    if (avgMs !== null && avgMs > budget) {
      issues.push(
        `${row.hook_name}: avg ${avgMs}ms exceeds ${budget}ms budget`,
      );
    }
  }

  if (issues.length === 0) {
    return {
      status: "PASS",
      category: "runtime",
      message: "No hook health issues in last 24h",
    };
  }

  return {
    status: "WARN",
    category: "runtime",
    message: issues.join("; "),
    details: issues,
  };
}
