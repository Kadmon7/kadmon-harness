import type { ReleaseContext, StepResult } from "./types.js";
/**
 * True when the region between "## [Unreleased]" and the next "## [" heading has no
 * non-whitespace, non-heading content. Blank lines and bare "### x" sub-headings do
 * not count as content. Used by /release preflight gate 3 (EMPTY_UNRELEASED).
 */
export declare function isUnreleasedEmpty(cwd: string): boolean;
/**
 * True iff CHANGELOG.md already contains a "## [version]" released heading (e.g.
 * "## [1.4.0] — 2026-07-13") — matches on the "## [version]" prefix, the date suffix
 * is not part of the match. Used by /release's recovery predicate (orchestrate.ts,
 * ADR-037 D4) as an INDEPENDENT signal alongside isVersionAlreadyBumped: a coincidental
 * plugin.json version match alone can never waive the EMPTY_UNRELEASED preflight gate.
 */
export declare function hasReleasedHeading(cwd: string, version: string): boolean;
/**
 * Dry-run: returns the consolidated section text (dated heading + preserved body)
 * without writing anything. The file on disk is left byte-identical.
 */
export declare function previewChangelog(cwd: string, target: string, date: string): string;
/**
 * Renames "## [Unreleased]" to "## [target] — date" and inserts a fresh empty
 * "## [Unreleased]" above it. Idempotent: if "## [target]" already exists, this is
 * a no-op that returns status "skipped".
 */
export declare function consolidateChangelog(ctx: ReleaseContext, target: string, date: string): StepResult;
