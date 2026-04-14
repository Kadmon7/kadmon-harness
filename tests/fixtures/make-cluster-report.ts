// Kadmon Harness — Test fixture helper for ClusterReport objects
// Pure in-memory builder. No DB access, no filesystem access (except the
// explicit writeClusterReportToFile helper which tests call with a tmp path).

import fs from "node:fs";
import path from "node:path";
import type { ClusterReport, Cluster, ClusterMemberRef } from "../../scripts/lib/types.js";
import { CLUSTER_REPORT_SCHEMA_VERSION } from "../../scripts/lib/types.js";

// ─── Options ───

export interface MakeClusterReportOptions {
  /** Defaults to "test-hash-aaaa" */
  projectHash?: string;
  /** Defaults to a synthetic UUID-ish string */
  sessionId?: string;
  /** ISO 8601 string. Defaults to new Date().toISOString() */
  generatedAt?: string;
  /** Partial clusters merged with sensible defaults. If omitted, one default cluster is created. */
  clusters?: Array<Partial<Cluster>>;
  /** Defaults to [] */
  unclustered?: ClusterMemberRef[];
  /** Defaults to computed from clusters array */
  totals?: ClusterReport["totals"];
}

// ─── Default cluster ───

function makeDefaultCluster(index: number = 0): Cluster {
  const clusterId = `cluster-default-${String(index).padStart(2, "0")}`;
  return {
    id: clusterId,
    suggestedCategory: "PROMOTE",
    label: "default: test cluster",
    domain: "workflow",
    members: [
      { instinctId: `instinct-default-${String(index * 2).padStart(2, "0")}`, membership: 0.8 },
      { instinctId: `instinct-default-${String(index * 2 + 1).padStart(2, "0")}`, membership: 0.6 },
    ],
    metrics: {
      meanConfidence: 0.7,
      totalOccurrences: 6,
      contradictionCount: 0,
      distinctSessions: 3,
    },
    rationale: "Default test cluster — two synthetic instinct members",
  };
}

function mergeCluster(partial: Partial<Cluster>, index: number): Cluster {
  const base = makeDefaultCluster(index);
  return {
    id: partial.id ?? base.id,
    suggestedCategory: partial.suggestedCategory ?? base.suggestedCategory,
    label: partial.label ?? base.label,
    domain: partial.domain !== undefined ? partial.domain : base.domain,
    members: partial.members ?? base.members,
    metrics: partial.metrics ?? base.metrics,
    rationale: partial.rationale ?? base.rationale,
  };
}

// ─── Counter for deterministic session IDs ───

let sessionCounter = 0;

function nextSessionId(): string {
  sessionCounter += 1;
  return `test-session-${String(sessionCounter).padStart(4, "0")}`;
}

// ─── Main factory ───

export function makeClusterReport(opts: MakeClusterReportOptions = {}): ClusterReport {
  const projectHash = opts.projectHash ?? "test-hash-aaaa";
  const sessionId = opts.sessionId ?? nextSessionId();
  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const unclustered = opts.unclustered ?? [];

  const clusters: Cluster[] =
    opts.clusters !== undefined
      ? opts.clusters.map((partial, i) => mergeCluster(partial, i))
      : [makeDefaultCluster(0)];

  const clusteredInstincts = clusters.reduce(
    (sum, c) => sum + c.members.length,
    0,
  );
  const unclusteredInstincts = unclustered.length;
  const activeInstincts = clusteredInstincts + unclusteredInstincts;
  const promotableInstincts = clusters.filter(
    (c) => c.suggestedCategory === "PROMOTE",
  ).length;

  const totals = opts.totals ?? {
    activeInstincts,
    clusteredInstincts,
    unclusteredInstincts,
    promotableInstincts,
  };

  return {
    schemaVersion: CLUSTER_REPORT_SCHEMA_VERSION,
    projectHash,
    sessionId,
    generatedAt,
    clusters,
    unclustered,
    totals,
  };
}

// ─── File writer (for tests that need to plant reports on disk) ───

/**
 * Writes the ClusterReport as JSON to `{dir}/forge-clusters-{sessionId}.json`.
 * Returns the full file path. Tests call this with a tmp dir so no production
 * files are ever written.
 */
export function writeClusterReportToFile(report: ClusterReport, dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `forge-clusters-${report.sessionId}.json`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2) + "\n", "utf8");
  return filePath;
}
