// Kadmon Harness — /medik Check #15: docs-status-lint (plan-038 Phase 2)
// FAILs on out-of-enum plan/ADR frontmatter `status:` values; WARNs on
// illegal BACKLOG.md checkbox markers. Zero git, zero DB — pure file reads.

import fs from "node:fs";
import path from "node:path";
import { parseFrontmatterStatus } from "./frontmatter.js";
import type { CheckContext, CheckResult } from "./types.js";

// spec: abra-kdabra.md "Artifact Format"
const PLAN_STATUSES = ["pending", "in_progress", "completed", "superseded"];
// spec: abra-kdabra.md "Artifact Format"
const ADR_STATUSES = ["proposed", "accepted", "deprecated", "superseded"];

// BACKLOG.md legend: `[ ]` open, `[~]` in progress, `[x]` done, `[-]` dropped, `[d]` deferred.
const LEGAL_BACKLOG_MARKERS = new Set([" ", "~", "x", "-", "d"]);
// List-item-anchored so prose brackets (e.g. "see [?] elsewhere") never false-positive.
const BACKLOG_MARKER_RE = /^\s*[-*] \[(.)\]/;

interface EnumViolation {
  file: string;
  status: string;
}

function scanEnumViolations(
  dir: string,
  allowedStatuses: readonly string[],
): EnumViolation[] {
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(dir, f));

  const violations: EnumViolation[] = [];

  for (const filePath of files) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    const status = parseFrontmatterStatus(content);
    if (status === null) continue;
    if (allowedStatuses.includes(status)) continue;

    violations.push({ file: path.basename(filePath), status });
  }

  return violations;
}

function scanBacklogMarkerViolations(backlogPath: string): string[] {
  if (!fs.existsSync(backlogPath)) return [];

  let content: string;
  try {
    content = fs.readFileSync(backlogPath, "utf8");
  } catch {
    return [];
  }

  const violations: string[] = [];
  for (const line of content.split("\n")) {
    const match = BACKLOG_MARKER_RE.exec(line);
    if (!match) continue;
    const marker = match[1];
    if (!LEGAL_BACKLOG_MARKERS.has(marker)) {
      violations.push(marker);
    }
  }

  return violations;
}

export function runCheck(ctx: CheckContext): CheckResult {
  const plansDir = path.join(ctx.cwd, "docs", "plans");
  const decisionsDir = path.join(ctx.cwd, "docs", "decisions");
  const backlogPath = path.join(ctx.cwd, "BACKLOG.md");

  const planViolations = scanEnumViolations(plansDir, PLAN_STATUSES);
  const adrViolations = scanEnumViolations(decisionsDir, ADR_STATUSES);
  const enumViolations = [...planViolations, ...adrViolations];

  const markerViolations = scanBacklogMarkerViolations(backlogPath);

  if (enumViolations.length > 0) {
    const offenders = enumViolations
      .map((v) => `${v.file} (status: ${v.status})`)
      .join(", ");
    return {
      status: "FAIL",
      category: "knowledge-hygiene",
      message: `${enumViolations.length} doc${enumViolations.length > 1 ? "s" : ""} with out-of-enum status: ${offenders}`,
      details: enumViolations,
    };
  }

  if (markerViolations.length > 0) {
    return {
      status: "WARN",
      category: "knowledge-hygiene",
      message: `${markerViolations.length} illegal BACKLOG.md marker${markerViolations.length > 1 ? "s" : ""}: ${markerViolations.map((m) => `[${m}]`).join(", ")}`,
      details: markerViolations,
    };
  }

  return {
    status: "PASS",
    category: "knowledge-hygiene",
    message: "All plan/ADR statuses in-enum; no illegal BACKLOG.md markers",
  };
}
