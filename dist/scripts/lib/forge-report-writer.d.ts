import type { ClusterReport } from "./types.js";
export declare function writeClusterReport(report: ClusterReport, baseDir?: string): string;
export declare function readClusterReport(filePath: string): ClusterReport;
export declare function pruneOldReports(baseDir: string, keep?: number): number;
export declare function exportInstinctsToJson(projectHash: string, destPath: string): string;
