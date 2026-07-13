// Kadmon Harness — /release Wave 1: status-flips.ts (plan-037 Step 1.5, ADR-037 D5)
// Scans the ## [Unreleased] CHANGELOG section for referenced ADR-NNN / plan-NNN / roadmap
// doc references and proposes a status flip when one is warranted. NEVER writes — the
// human decides which flips actually shipped (D5).

import fs from "node:fs";
import path from "node:path";
import type { ReleaseContext, StatusFlipProposal } from "./types.js";

const UNRELEASED_HEADING_RE = /^## \[Unreleased\]\s*$/m;
const NEXT_HEADING_RE = /^## \[/m;

const ADR_REF_RE = /\bADR-(\d{3,})\b/g;
const PLAN_REF_RE = /\bplan-(\d{3,})\b/g;
const ROADMAP_REF_RE = /docs\/roadmap\/([\w.-]+\.md)/g;

const STATUS_RE = /^status:\s*(\S+)/m;
const CHECKBOX_OPEN_RE = /^- \[ \] .+$/;

function toPosix(relPath: string): string {
  return relPath.replace(/\\/g, "/");
}

/** Extracts the body between "## [Unreleased]" and the next "## [" heading. */
function extractUnreleasedSection(changelog: string): string {
  const startMatch = UNRELEASED_HEADING_RE.exec(changelog);
  if (!startMatch) return "";
  const afterStart = changelog.slice(startMatch.index + startMatch[0].length);
  const nextMatch = NEXT_HEADING_RE.exec(afterStart);
  return nextMatch ? afterStart.slice(0, nextMatch.index) : afterStart;
}

/** Finds a file in `dir` whose name starts with `prefix` and ends with .md. Read-only. */
function findDocByPrefix(dir: string, prefix: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const match = fs.readdirSync(dir).find((f) => f.startsWith(prefix) && f.endsWith(".md"));
  return match ? path.join(dir, match) : null;
}

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function proposeAdrFlip(cwd: string, num: string, reason: string): StatusFlipProposal | null {
  const filePath = findDocByPrefix(path.join(cwd, "docs", "decisions"), `ADR-${num}-`);
  if (!filePath) return null;
  const content = readFileSafe(filePath);
  if (content === null) return null;

  const statusMatch = STATUS_RE.exec(content);
  if (!statusMatch) return null;
  const current = statusMatch[1];
  if (current !== "proposed") return null;

  return { file: toPosix(path.relative(cwd, filePath)), current, proposed: "accepted", reason };
}

function proposePlanFlip(cwd: string, num: string, reason: string): StatusFlipProposal | null {
  const filePath = findDocByPrefix(path.join(cwd, "docs", "plans"), `plan-${num}-`);
  if (!filePath) return null;
  const content = readFileSafe(filePath);
  if (content === null) return null;

  const statusMatch = STATUS_RE.exec(content);
  if (!statusMatch) return null;
  const current = statusMatch[1];
  if (current !== "pending" && current !== "in-progress") return null;

  return { file: toPosix(path.relative(cwd, filePath)), current, proposed: "completed", reason };
}

function proposeRoadmapFlips(
  cwd: string,
  relPath: string,
  reason: string,
): readonly StatusFlipProposal[] {
  const filePath = path.join(cwd, relPath);
  const content = readFileSafe(filePath);
  if (content === null) return [];

  const posixPath = toPosix(relPath);
  return content
    .split("\n")
    .filter((line) => CHECKBOX_OPEN_RE.test(line))
    .map((): StatusFlipProposal => ({ file: posixPath, current: "[ ]", proposed: "[x]", reason }));
}

/**
 * Scans the ## [Unreleased] CHANGELOG section for referenced ADR-NNN / plan-NNN / roadmap
 * file references and proposes a status flip for each doc that is not already at its
 * target status. Never writes — output only (ADR-037 D5).
 */
export function proposeStatusFlips(ctx: ReleaseContext): readonly StatusFlipProposal[] {
  const changelogPath = path.join(ctx.cwd, "CHANGELOG.md");
  const changelog = readFileSafe(changelogPath);
  if (changelog === null) return [];

  const section = extractUnreleasedSection(changelog);
  if (!section.trim()) return [];

  const proposals: StatusFlipProposal[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  ADR_REF_RE.lastIndex = 0;
  while ((match = ADR_REF_RE.exec(section)) !== null) {
    const num = match[1];
    const key = `adr:${num}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const proposal = proposeAdrFlip(ctx.cwd, num, `Referenced as ADR-${num} in [Unreleased]`);
    if (proposal) proposals.push(proposal);
  }

  PLAN_REF_RE.lastIndex = 0;
  while ((match = PLAN_REF_RE.exec(section)) !== null) {
    const num = match[1];
    const key = `plan:${num}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const proposal = proposePlanFlip(ctx.cwd, num, `Referenced as plan-${num} in [Unreleased]`);
    if (proposal) proposals.push(proposal);
  }

  ROADMAP_REF_RE.lastIndex = 0;
  while ((match = ROADMAP_REF_RE.exec(section)) !== null) {
    const relPath = `docs/roadmap/${match[1]}`;
    const key = `roadmap:${relPath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    proposals.push(
      ...proposeRoadmapFlips(ctx.cwd, relPath, `Referenced at ${relPath} in [Unreleased]`),
    );
  }

  return proposals;
}
