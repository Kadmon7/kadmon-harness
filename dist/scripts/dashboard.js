#!/usr/bin/env node
// Kadmon Harness — CLI Dashboard Entry Point
// Usage: npx tsx scripts/dashboard.ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, closeDb } from "./lib/state-store.js";
import { detectProject } from "./lib/project-detect.js";
import { renderDashboard } from "./lib/dashboard.js";
import { summarizePendingClusterReports } from "./lib/evolve-report-reader.js";
import { forgeReportsBaseDir } from "./lib/forge-report-writer.js";
function loadObservations(sessionId) {
    const obsDir = path.join(os.tmpdir(), "kadmon", sessionId);
    const obsFile = path.join(obsDir, "observations.jsonl");
    if (!fs.existsSync(obsFile))
        return [];
    const lines = fs.readFileSync(obsFile, "utf-8").split("\n").filter(Boolean);
    const events = [];
    for (const line of lines) {
        try {
            events.push(JSON.parse(line));
        }
        catch {
            // skip malformed lines
        }
    }
    return events;
}
function fileMtimeMs(filePath) {
    return fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : 0;
}
export function findActiveSessionDir(tmpBase) {
    const kadmonTmp = tmpBase ?? path.join(os.tmpdir(), "kadmon");
    if (!fs.existsSync(kadmonTmp))
        return null;
    const entries = fs
        .readdirSync(kadmonTmp, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => {
        const obsFile = path.join(kadmonTmp, e.name, "observations.jsonl");
        const archiveFile = path.join(kadmonTmp, e.name, "observations.archive.jsonl");
        const obsMtime = fileMtimeMs(obsFile);
        const archiveMtime = fileMtimeMs(archiveFile);
        return {
            name: e.name,
            // A session is "active" if EITHER file exists — post forge-blind-fix,
            // a live file may have already been rotated into the archive (ADR
            // per session-end-all.js Phase 5), so observations.jsonl alone is no
            // longer a reliable signal.
            hasObs: obsMtime > 0 || archiveMtime > 0,
            mtime: Math.max(obsMtime, archiveMtime),
        };
    })
        .filter((e) => e.hasObs)
        .sort((a, b) => b.mtime - a.mtime);
    return entries.length > 0 ? entries[0].name : null;
}
async function main() {
    const project = detectProject();
    if (!project) {
        console.error("Not in a git repository. Cannot detect project.");
        process.exit(1);
    }
    await openDb();
    try {
        const sessionId = findActiveSessionDir();
        const events = sessionId ? loadObservations(sessionId) : [];
        const pending = summarizePendingClusterReports({
            baseDir: forgeReportsBaseDir(),
            projectHash: project.projectHash,
        });
        const output = renderDashboard(project.projectHash, events, pending);
        console.log(output);
    }
    finally {
        closeDb();
    }
}
main().catch((err) => {
    console.error("Dashboard error:", err);
    process.exit(1);
});
