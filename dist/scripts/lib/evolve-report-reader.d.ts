import type { ClusterReport } from "./types.js";
export interface ReadReportsOptions {
    baseDir: string;
    projectHash: string;
    /** Number of days back to include. Resolved from: opts.windowDays ?? KADMON_EVOLVE_WINDOW_DAYS env ?? 7 */
    windowDays?: number;
    /** Reference point for window calculation. Defaults to new Date(). */
    now?: Date;
}
/**
 * Reads all ClusterReport JSON files in `baseDir` whose:
 * - filename ends in `.json`
 * - `schemaVersion === 1`
 * - `projectHash === opts.projectHash`
 * - `generatedAt` is within the last `windowDays` days of `now`
 *
 * Returns reports sorted by `generatedAt` DESC (newest first).
 * Silently skips files that are not valid JSON, have unknown schemaVersion,
 * or don't match the project/window filter.
 */
export declare function readClusterReportsInWindow(opts: ReadReportsOptions): ClusterReport[];
export interface PendingReportsSummary {
    /** How many fresh-in-window ClusterReports exist for this projectHash. */
    count: number;
    /** Age in days of the oldest report within the window. null when count === 0. */
    oldestAgeDays: number | null;
    /** Age in days of the newest report within the window. null when count === 0. */
    newestAgeDays: number | null;
}
/**
 * Summarizes how many ClusterReports are pending (fresh-in-window, unconsumed)
 * for a project, to drive a cadence nudge toward running /evolve.
 *
 * Delegates all filesystem I/O and filtering to readClusterReportsInWindow —
 * this function only aggregates the already-filtered result.
 */
export declare function summarizePendingClusterReports(opts: ReadReportsOptions): PendingReportsSummary;
/**
 * Merges clusters from multiple ClusterReports by `clusterId`:
 * - Union of members per cluster
 * - When the same `instinctId` appears in multiple reports, the membership
 *   value from the report with the newer `generatedAt` wins (ADR-008:92)
 *
 * Returns a single synthetic ClusterReport. On empty input, returns a
 * zero-valued sentinel.
 */
export declare function mergeByInstinctId(reports: ClusterReport[]): ClusterReport;
