// Kadmon Harness — Forge report writer (ADR-005 D5)
// Writes ClusterReport JSON to ~/.kadmon/forge-reports/ for /evolve step 6
// to consume out-of-band. Also hosts the `/forge export` serializer
// (Sprint E scaffolding; shape subject to change).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ClusterReport, Instinct } from "./types.js";
import { CLUSTER_REPORT_SCHEMA_VERSION } from "./types.js";
import { getActiveInstincts } from "./state-store.js";
import { nowISO } from "./utils.js";

const DEFAULT_KEEP = 20;
const EXPORT_SCHEMA_VERSION = 1;

function defaultBaseDir(): string {
  return path.join(os.homedir(), ".kadmon", "forge-reports");
}

// ─── Writer ───

export function writeClusterReport(
  report: ClusterReport,
  baseDir: string = defaultBaseDir(),
): string {
  fs.mkdirSync(baseDir, { recursive: true });
  const destPath = path.join(baseDir, `forge-clusters-${report.sessionId}.json`);
  fs.writeFileSync(destPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  return destPath;
}

// ─── Reader (with schemaVersion guard) ───

export function readClusterReport(filePath: string): ClusterReport {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("schemaVersion" in parsed)
  ) {
    throw new Error(
      `forge-report-writer: file ${filePath} is not a valid ClusterReport (missing schemaVersion)`,
    );
  }

  const version = (parsed as { schemaVersion: unknown }).schemaVersion;
  if (version !== CLUSTER_REPORT_SCHEMA_VERSION) {
    throw new Error(
      `forge-report-writer: unknown schemaVersion ${String(version)} in ${filePath} — expected ${CLUSTER_REPORT_SCHEMA_VERSION}. No migration available.`,
    );
  }

  return parsed as ClusterReport;
}

// ─── Retention ───

export function pruneOldReports(
  baseDir: string,
  keep: number = DEFAULT_KEEP,
): number {
  if (!fs.existsSync(baseDir)) return 0;

  const entries = fs
    .readdirSync(baseDir)
    .filter((f) => f.startsWith("forge-clusters-") && f.endsWith(".json"))
    .map((name) => {
      const full = path.join(baseDir, name);
      const raw = fs.readFileSync(full, "utf8");
      let generatedAt = "";
      try {
        const parsed = JSON.parse(raw) as { generatedAt?: unknown };
        if (typeof parsed.generatedAt === "string") {
          generatedAt = parsed.generatedAt;
        }
      } catch {
        // malformed files sort to the top of the prune list
      }
      return { name, full, generatedAt };
    });

  if (entries.length <= keep) return 0;

  // Newest first (string-compare ISO 8601 timestamps)
  entries.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));

  const toDelete = entries.slice(keep);
  for (const entry of toDelete) {
    fs.unlinkSync(entry.full);
  }
  return toDelete.length;
}

// ─── Export serializer (Sprint E scaffolding) ───

interface InstinctsExport {
  project_hash: string;
  exported_at: string;
  schema_version: number;
  instincts: Instinct[];
}

export function exportInstinctsToJson(
  projectHash: string,
  destPath: string,
): string {
  const instincts = getActiveInstincts(projectHash);

  const payload: InstinctsExport = {
    project_hash: projectHash,
    exported_at: nowISO(),
    schema_version: EXPORT_SCHEMA_VERSION,
    instincts,
  };

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return destPath;
}
