// Kadmon Harness — Forge report writer (ADR-005 D5)
// Writes ClusterReport JSON to ~/.kadmon/forge-reports/ for /evolve step 6
// to consume out-of-band. Also hosts the `/forge export` serializer
// (Sprint E scaffolding; shape subject to change).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CLUSTER_REPORT_SCHEMA_VERSION } from "./types.js";
import { getActiveInstincts } from "./state-store.js";
import { nowISO } from "./utils.js";
const DEFAULT_KEEP = 20;
const EXPORT_SCHEMA_VERSION = 1;
// Whitelist sessionId to block path traversal via the filename.
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
function assertSafeSessionId(sessionId) {
    if (!SAFE_ID_PATTERN.test(sessionId)) {
        throw new Error(`forge-report-writer: unsafe sessionId "${sessionId}" — must match /^[A-Za-z0-9_-]+$/`);
    }
}
// Constrain baseDir to the kadmon root (production) or the OS tmpdir
// (tests). pruneOldReports unlinks matching files, so a future caller
// passing a user-derived path could wipe arbitrary files without this.
function kadmonRoot() {
    return path.join(os.homedir(), ".kadmon");
}
function isUnder(target, root) {
    const resolved = path.resolve(target);
    const rootResolved = path.resolve(root);
    return (resolved === rootResolved ||
        resolved.startsWith(rootResolved + path.sep));
}
function assertSafeBaseDir(baseDir) {
    if (isUnder(baseDir, kadmonRoot()) || isUnder(baseDir, os.tmpdir())) {
        return;
    }
    throw new Error(`forge-report-writer: unsafe baseDir "${baseDir}" — must resolve under ~/.kadmon or os.tmpdir()`);
}
function defaultBaseDir() {
    return path.join(kadmonRoot(), "forge-reports");
}
// ─── Writer ───
export function writeClusterReport(report, baseDir = defaultBaseDir()) {
    assertSafeBaseDir(baseDir);
    assertSafeSessionId(report.sessionId);
    fs.mkdirSync(baseDir, { recursive: true });
    const destPath = path.join(baseDir, `forge-clusters-${report.sessionId}.json`);
    fs.writeFileSync(destPath, JSON.stringify(report, null, 2) + "\n", "utf8");
    return destPath;
}
// ─── Reader (with schemaVersion guard) ───
export function readClusterReport(filePath) {
    const raw = fs.readFileSync(filePath, "utf8");
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`forge-report-writer: failed to parse ${filePath} as JSON — ${detail}`);
    }
    if (typeof parsed !== "object" ||
        parsed === null ||
        !("schemaVersion" in parsed)) {
        throw new Error(`forge-report-writer: file ${filePath} is not a valid ClusterReport (missing schemaVersion)`);
    }
    const version = parsed.schemaVersion;
    if (version !== CLUSTER_REPORT_SCHEMA_VERSION) {
        throw new Error(`forge-report-writer: unknown schemaVersion ${String(version)} in ${filePath} — expected ${CLUSTER_REPORT_SCHEMA_VERSION}. No migration available.`);
    }
    return parsed;
}
// ─── Retention ───
export function pruneOldReports(baseDir, keep = DEFAULT_KEEP) {
    assertSafeBaseDir(baseDir);
    if (!fs.existsSync(baseDir))
        return 0;
    const entries = fs
        .readdirSync(baseDir)
        .filter((f) => f.startsWith("forge-clusters-") && f.endsWith(".json"))
        .map((name) => {
        const full = path.join(baseDir, name);
        const raw = fs.readFileSync(full, "utf8");
        let generatedAt = "";
        try {
            const parsed = JSON.parse(raw);
            if (typeof parsed.generatedAt === "string") {
                generatedAt = parsed.generatedAt;
            }
        }
        catch {
            // malformed files sort to the top of the prune list
        }
        return { name, full, generatedAt };
    });
    if (entries.length <= keep)
        return 0;
    // Newest first (string-compare ISO 8601 timestamps)
    entries.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    const toDelete = entries.slice(keep);
    for (const entry of toDelete) {
        fs.unlinkSync(entry.full);
    }
    return toDelete.length;
}
export function exportInstinctsToJson(projectHash, destPath) {
    const instincts = getActiveInstincts(projectHash);
    const payload = {
        project_hash: projectHash,
        exported_at: nowISO(),
        schema_version: EXPORT_SCHEMA_VERSION,
        instincts,
    };
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
    return destPath;
}
