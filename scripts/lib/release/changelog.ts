// Kadmon Harness — /release command: CHANGELOG.md consolidation (ADR-037, plan-037 Step 1.3).
// Renames "## [Unreleased]" to a dated release heading and inserts a fresh empty
// "## [Unreleased]" above it, preserving the moved block's sub-sections verbatim.
// Pure string surgery — no shelling out, no git. Idempotent: a second run against an
// already-released target version is a no-op (StepResult.status === "skipped").

import fs from "node:fs";
import path from "node:path";
import type { ReleaseContext, StepResult } from "./types.js";

const CHANGELOG_FILENAME = "CHANGELOG.md";
const UNRELEASED_HEADING = "## [Unreleased]";
const HEADING_LINE_RE = /^## \[/m;
const SUBHEADING_LINE_RE = /^### .+$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readChangelog(cwd: string): string {
  return fs.readFileSync(path.join(cwd, CHANGELOG_FILENAME), "utf-8");
}

/** Index of the next "## [" heading at or after `fromIndex`, or content.length if none. */
function findNextHeadingIndex(content: string, fromIndex: number): number {
  const rest = content.slice(fromIndex);
  const match = rest.match(HEADING_LINE_RE);
  return match && typeof match.index === "number" ? fromIndex + match.index : content.length;
}

interface Consolidation {
  readonly unreleasedFound: boolean;
  readonly alreadyExists: boolean;
  /** The dated heading + preserved body, e.g. "## [1.4.0] — 2026-07-13\n\n### Added\n...". */
  readonly sectionText: string;
  /** Full file content after consolidation (only meaningful when unreleasedFound && !alreadyExists). */
  readonly newContent: string;
}

/**
 * Shared string-surgery core used by both previewChangelog (read-only) and
 * consolidateChangelog (writes). Keeping this pure means the preview can never
 * drift from what the real write would produce.
 */
/** Matches "## [version]" at the start of a line — the released-heading prefix. */
function releasedHeadingRegex(target: string): RegExp {
  return new RegExp(`^## \\[${escapeRegExp(target)}\\]`, "m");
}

function computeConsolidation(content: string, target: string, date: string): Consolidation {
  const alreadyExists = releasedHeadingRegex(target).test(content);

  const unreleasedIdx = content.indexOf(UNRELEASED_HEADING);
  if (unreleasedIdx === -1) {
    return { unreleasedFound: false, alreadyExists, sectionText: "", newContent: content };
  }

  const afterHeadingIdx = unreleasedIdx + UNRELEASED_HEADING.length;
  const nextHeadingIdx = findNextHeadingIndex(content, afterHeadingIdx);
  const body = content.slice(afterHeadingIdx, nextHeadingIdx);

  // Em-dash (U+2014), space both sides — matches CHANGELOG.md's released-heading format exactly.
  const datedHeading = `## [${target}] — ${date}`;
  const sectionText = datedHeading + body;

  const newContent =
    content.slice(0, unreleasedIdx) +
    `${UNRELEASED_HEADING}\n\n` + // fresh, empty [Unreleased] inserted above the dated section
    sectionText +
    content.slice(nextHeadingIdx);

  return { unreleasedFound: true, alreadyExists, sectionText, newContent };
}

/**
 * True when the region between "## [Unreleased]" and the next "## [" heading has no
 * non-whitespace, non-heading content. Blank lines and bare "### x" sub-headings do
 * not count as content. Used by /release preflight gate 3 (EMPTY_UNRELEASED).
 */
export function isUnreleasedEmpty(cwd: string): boolean {
  const content = readChangelog(cwd);
  const unreleasedIdx = content.indexOf(UNRELEASED_HEADING);
  if (unreleasedIdx === -1) return true; // no [Unreleased] section — nothing to release

  const afterHeadingIdx = unreleasedIdx + UNRELEASED_HEADING.length;
  const nextHeadingIdx = findNextHeadingIndex(content, afterHeadingIdx);
  const body = content.slice(afterHeadingIdx, nextHeadingIdx);

  return body
    .split("\n")
    .every((line) => {
      const trimmed = line.trim();
      return trimmed === "" || SUBHEADING_LINE_RE.test(trimmed);
    });
}

/**
 * True iff CHANGELOG.md already contains a "## [version]" released heading (e.g.
 * "## [1.4.0] — 2026-07-13") — matches on the "## [version]" prefix, the date suffix
 * is not part of the match. Used by /release's recovery predicate (orchestrate.ts,
 * ADR-037 D4) as an INDEPENDENT signal alongside isVersionAlreadyBumped: a coincidental
 * plugin.json version match alone can never waive the EMPTY_UNRELEASED preflight gate.
 */
export function hasReleasedHeading(cwd: string, version: string): boolean {
  const content = readChangelog(cwd);
  return releasedHeadingRegex(version).test(content);
}

/**
 * Dry-run: returns the consolidated section text (dated heading + preserved body)
 * without writing anything. The file on disk is left byte-identical.
 */
export function previewChangelog(cwd: string, target: string, date: string): string {
  const content = readChangelog(cwd);
  return computeConsolidation(content, target, date).sectionText;
}

/**
 * Renames "## [Unreleased]" to "## [target] — date" and inserts a fresh empty
 * "## [Unreleased]" above it. Idempotent: if "## [target]" already exists, this is
 * a no-op that returns status "skipped".
 */
export function consolidateChangelog(
  ctx: ReleaseContext,
  target: string,
  date: string,
): StepResult {
  const changelogPath = path.join(ctx.cwd, CHANGELOG_FILENAME);
  const content = fs.readFileSync(changelogPath, "utf-8");
  const consolidation = computeConsolidation(content, target, date);

  if (consolidation.alreadyExists) {
    return {
      step: "changelog",
      status: "skipped",
      message: `## [${target}] already exists in CHANGELOG.md — release already consolidated`,
      filesTouched: [],
    };
  }

  if (!consolidation.unreleasedFound) {
    return {
      step: "changelog",
      status: "failed",
      message: "No ## [Unreleased] heading found in CHANGELOG.md",
      filesTouched: [],
    };
  }

  fs.writeFileSync(changelogPath, consolidation.newContent, "utf-8");

  return {
    step: "changelog",
    status: "applied",
    message: `Consolidated [Unreleased] into ## [${target}] — ${date}`,
    filesTouched: [CHANGELOG_FILENAME],
  };
}
