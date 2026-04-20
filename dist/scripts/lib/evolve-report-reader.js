// Kadmon Harness — Evolve report reader (ADR-008, Phase 1)
// Reads ClusterReport JSON files from a directory within a time window,
// filtered by projectHash. Also exports a merge helper for multi-report
// consumption per the "most-recent-wins + union" semantics (ADR-008:92).
import fs from "node:fs";
import path from "node:path";
import { CLUSTER_REPORT_SCHEMA_VERSION } from "./types.js";
// ─── Window resolution ───
function resolveWindowDays(opts) {
    if (opts.windowDays !== undefined) {
        return opts.windowDays;
    }
    const envVal = process.env["KADMON_EVOLVE_WINDOW_DAYS"];
    if (envVal !== undefined && envVal !== "") {
        const parsed = parseInt(envVal, 10);
        if (!isNaN(parsed) && parsed > 0) {
            return parsed;
        }
    }
    return 7;
}
// ─── Main reader ───
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
export function readClusterReportsInWindow(opts) {
    const windowDays = resolveWindowDays(opts);
    const now = opts.now ?? new Date();
    // Earliest timestamp that is still within the window
    const cutoffMs = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
    // 1. Read directory — return [] if it doesn't exist
    let entries;
    try {
        entries = fs.readdirSync(opts.baseDir);
    }
    catch {
        return [];
    }
    const results = [];
    for (const entry of entries) {
        // 2. Skip non-JSON files
        if (!entry.endsWith(".json")) {
            continue;
        }
        const filePath = path.join(opts.baseDir, entry);
        // 3. Parse — skip on error
        let parsed;
        try {
            const raw = fs.readFileSync(filePath, "utf8");
            parsed = JSON.parse(raw);
        }
        catch {
            process.stderr.write(JSON.stringify({ warning: `evolve-report-reader: skipping unparseable file ${entry}` }) + "\n");
            continue;
        }
        if (typeof parsed !== "object" || parsed === null) {
            continue;
        }
        const obj = parsed;
        // 4. Filter by schemaVersion
        if (obj["schemaVersion"] !== CLUSTER_REPORT_SCHEMA_VERSION) {
            process.stderr.write(JSON.stringify({
                warning: `evolve-report-reader: skipping ${entry} — unknown schemaVersion ${String(obj["schemaVersion"])}`,
            }) + "\n");
            continue;
        }
        const report = parsed;
        // 5. Filter by projectHash
        if (report.projectHash !== opts.projectHash) {
            continue;
        }
        // 6. Filter by generatedAt within window
        const reportMs = new Date(report.generatedAt).getTime();
        if (isNaN(reportMs) || reportMs < cutoffMs) {
            continue;
        }
        results.push(report);
    }
    // 7. Sort newest first
    results.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    return results;
}
// ─── Merge helper ───
/**
 * Merges clusters from multiple ClusterReports by `clusterId`:
 * - Union of members per cluster
 * - When the same `instinctId` appears in multiple reports, the membership
 *   value from the report with the newer `generatedAt` wins (ADR-008:92)
 *
 * Returns a single synthetic ClusterReport. On empty input, returns a
 * zero-valued sentinel.
 */
export function mergeByInstinctId(reports) {
    if (reports.length === 0) {
        return {
            schemaVersion: CLUSTER_REPORT_SCHEMA_VERSION,
            projectHash: "",
            sessionId: "merged",
            generatedAt: new Date().toISOString(),
            clusters: [],
            unclustered: [],
            totals: {
                activeInstincts: 0,
                clusteredInstincts: 0,
                unclusteredInstincts: 0,
                promotableInstincts: 0,
            },
        };
    }
    // Sort newest first so we process higher-priority reports first
    const sorted = [...reports].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    // Map: clusterId → merged Cluster
    const clusterMap = new Map();
    // Map: clusterId → Map<instinctId → ClusterMemberRef>
    const memberMapByCluster = new Map();
    for (const report of sorted) {
        for (const cluster of report.clusters) {
            if (!clusterMap.has(cluster.id)) {
                // First time seeing this clusterId — seed with this cluster's shape
                clusterMap.set(cluster.id, { ...cluster, members: [] });
                memberMapByCluster.set(cluster.id, new Map());
            }
            const memberMap = memberMapByCluster.get(cluster.id);
            for (const member of cluster.members) {
                if (!memberMap.has(member.instinctId)) {
                    // Not yet seen — add it. Because we iterate newest-first, the first
                    // occurrence of any instinctId has the winning (newest) membership.
                    memberMap.set(member.instinctId, { ...member });
                }
                // If already present: newest report already set it — skip older value.
            }
        }
    }
    // Reconstruct clusters from the maps
    const mergedClusters = [];
    for (const [clusterId, baseCluster] of clusterMap) {
        const memberMap = memberMapByCluster.get(clusterId);
        const members = Array.from(memberMap.values());
        mergedClusters.push({ ...baseCluster, members });
    }
    // Use projectHash and generatedAt from the newest report
    const newestReport = sorted[0];
    const clusteredInstincts = mergedClusters.reduce((sum, c) => sum + c.members.length, 0);
    const promotableInstincts = mergedClusters.filter((c) => c.suggestedCategory === "PROMOTE").length;
    return {
        schemaVersion: CLUSTER_REPORT_SCHEMA_VERSION,
        projectHash: newestReport.projectHash,
        sessionId: "merged",
        generatedAt: newestReport.generatedAt,
        clusters: mergedClusters,
        unclustered: [],
        totals: {
            activeInstincts: clusteredInstincts,
            clusteredInstincts,
            unclusteredInstincts: 0,
            promotableInstincts,
        },
    };
}
