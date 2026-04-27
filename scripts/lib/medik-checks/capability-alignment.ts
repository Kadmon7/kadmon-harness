// /medik Check #14 — capability-alignment (plan-029 Phase 4.2, ADR-033 guard).
// Detects skill/agent/command metadata drift using the capability-matrix library.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildCapabilityMatrix,
  findViolations,
  type Violation,
} from "../capability-matrix.js";
import type { CheckContext, CheckResult, CheckStatus } from "./types.js";

function worstStatus(violations: Violation[]): CheckStatus {
  if (violations.some((v) => v.severity === "FAIL")) return "FAIL";
  if (violations.some((v) => v.severity === "WARN")) return "WARN";
  if (violations.length > 0) return "NOTE";
  return "PASS";
}

export function runCheck(ctx: CheckContext): CheckResult {
  // ADR-033: consumer projects without local .claude/agents/ or .claude/skills/ emit NOTE.
  const agentsDir = path.join(ctx.cwd, ".claude", "agents");
  const skillsDir = path.join(ctx.cwd, ".claude", "skills");
  if (!fs.existsSync(agentsDir) || !fs.existsSync(skillsDir)) {
    return {
      status: "NOTE",
      category: "knowledge-hygiene",
      message:
        "no consumer-local agents/skills in this project — nothing to audit (capability-alignment requires both .claude/agents/ and .claude/skills/)",
    };
  }

  const matrix = buildCapabilityMatrix({ cwd: ctx.cwd });
  const violations = findViolations(matrix);

  const status = worstStatus(violations);

  const fails = violations.filter((v) => v.severity === "FAIL").length;
  const warns = violations.filter((v) => v.severity === "WARN").length;
  const notes = violations.filter((v) => v.severity === "NOTE").length;

  const runtimeKinds = new Set(["capability-mismatch", "heuristic-tool-mismatch"]);
  const hasRuntime = violations.some((v) => runtimeKinds.has(v.kind));
  const category = hasRuntime || status === "PASS" ? "runtime" : "knowledge-hygiene";

  const summary = `Capability alignment: ${fails} FAIL / ${warns} WARN / ${notes} NOTE`;
  let message: string;
  if (violations.length === 0) {
    message = `${summary} — aligned, no drift detected`;
  } else {
    const firstFail = violations.find((v) => v.severity === "FAIL");
    const headline = firstFail ? firstFail.message : violations[0].message;
    message = `${summary} — ${headline}`;
  }

  return { status, category, message, details: violations };
}

// CLI shim — `npx tsx scripts/lib/medik-checks/capability-alignment.ts`
const entry = process.argv[1];
if (entry && pathToFileURL(entry).href === import.meta.url) {
  const result = runCheck({ projectHash: "cli", cwd: process.cwd() });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "FAIL" ? 1 : 0);
}
