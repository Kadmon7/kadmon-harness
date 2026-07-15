import type { ClusterReport } from "./types.js";
/**
 * Resolves the forge-reports base directory. `KADMON_FORGE_REPORTS_DIR`
 * is a test seam / power-user override for both the writer and reader
 * paths (AUD-26); when unset, defaults to ~/.kadmon/forge-reports.
 *
 * This is the single choke point for both read and write consumers
 * (session-end-all hook, dashboard CLI, /evolve) — the override MUST
 * resolve under ~/.kadmon or os.tmpdir(), same containment as
 * assertSafeBaseDir enforces for writeClusterReport/pruneOldReports.
 * An arbitrary override path is intentionally rejected: this is a test
 * seam / in-~/.kadmon power-user redirect, not an arbitrary-path escape
 * hatch for readers.
 */
export declare function forgeReportsBaseDir(): string;
export declare function writeClusterReport(report: ClusterReport, baseDir?: string): string;
export declare function readClusterReport(filePath: string): ClusterReport;
export declare function pruneOldReports(baseDir: string, keep?: number): number;
export declare function exportInstinctsToJson(projectHash: string, destPath: string): string;
