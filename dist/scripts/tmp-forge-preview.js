// /forge preview runner — Phase 6 step 1-6 (Read → Gate).
// Prints the preview table. Does NOT mutate the DB. The apply step is in a separate script.
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { openDb, closeDb } from "./lib/state-store.js";
import { runForgePipeline } from "./lib/forge-pipeline.js";
import { detectProject } from "./lib/project-detect.js";
function findActiveSessionDir() {
    const kadmonTmp = path.join(os.tmpdir(), "kadmon");
    if (!fs.existsSync(kadmonTmp))
        return null;
    const entries = fs
        .readdirSync(kadmonTmp, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => {
        const obsFile = path.join(kadmonTmp, e.name, "observations.jsonl");
        const exists = fs.existsSync(obsFile);
        return {
            name: e.name,
            hasObs: exists,
            mtime: exists ? fs.statSync(obsFile).mtimeMs : 0,
        };
    })
        .filter((e) => e.hasObs)
        .sort((a, b) => b.mtime - a.mtime);
    return entries.length > 0 ? entries[0].name : null;
}
async function main() {
    const project = detectProject();
    if (!project)
        throw new Error("Not a git repository");
    const sessionId = findActiveSessionDir();
    if (!sessionId)
        throw new Error("No active session directory found");
    await openDb();
    try {
        const preview = await runForgePipeline({
            projectHash: project.projectHash,
            sessionId,
            dryRun: false,
        });
        const out = process.stdout;
        out.write(`\n## /forge preview — session ${sessionId}\n\n`);
        out.write(`projectHash: ${project.projectHash}\n`);
        const obsFile = path.join(os.tmpdir(), "kadmon", sessionId, "observations.jsonl");
        const obsCount = fs.existsSync(obsFile)
            ? fs.readFileSync(obsFile, "utf8").split("\n").filter(Boolean).length
            : 0;
        out.write(`observations: ${obsCount} lines\n\n`);
        out.write(`### Would create (${preview.would.create.length})\n`);
        for (const p of preview.would.create) {
            out.write(`  - ${p.pattern} (initial conf ${p.confidence})\n`);
        }
        if (preview.would.create.length === 0)
            out.write("  (none)\n");
        out.write(`\n### Would reinforce (${preview.would.reinforce.length})\n`);
        for (const r of preview.would.reinforce) {
            out.write(`  - ${r.after.pattern} (${r.before.confidence.toFixed(2)} -> ${r.after.confidence.toFixed(2)}, occ ${r.before.occurrences} -> ${r.after.occurrences})\n`);
        }
        if (preview.would.reinforce.length === 0)
            out.write("  (none)\n");
        out.write(`\n### Would promote (${preview.would.promote.length})\n`);
        for (const p of preview.would.promote) {
            out.write(`  - ${p.pattern} (conf ${p.confidence.toFixed(2)}, occ ${p.occurrences})\n`);
        }
        if (preview.would.promote.length === 0)
            out.write("  (none)\n");
        out.write(`\n### Would prune (${preview.would.prune.length})\n`);
        for (const p of preview.would.prune) {
            out.write(`  - ${p.pattern} (conf ${p.confidence.toFixed(2)}, contradictions ${p.contradictions})\n`);
        }
        if (preview.would.prune.length === 0)
            out.write("  (none)\n");
        out.write(`\n### Cluster report\n`);
        out.write(`${preview.clusterReport.clusters.length} clusters, ${preview.clusterReport.unclustered.length} unclustered (schemaVersion ${preview.clusterReport.schemaVersion})\n`);
        for (const c of preview.clusterReport.clusters) {
            out.write(`  - ${c.domain} (${c.members.length} members, suggested ${c.suggestedCategory})\n`);
        }
        if (preview.clusterReport.unclustered.length > 0) {
            out.write(`  unclustered singletons:\n`);
            for (const u of preview.clusterReport.unclustered) {
                out.write(`    - instinctId=${u.instinctId.slice(0, 8)}… membership=${u.membership.toFixed(2)}\n`);
            }
        }
        out.write(`  totals: active=${preview.clusterReport.totals.activeInstincts} clustered=${preview.clusterReport.totals.clusteredInstincts} unclustered=${preview.clusterReport.totals.unclusteredInstincts} promotable=${preview.clusterReport.totals.promotableInstincts}\n`);
        out.write(`\n### Totals\ncreate: ${preview.would.create.length}  reinforce: ${preview.would.reinforce.length}  promote: ${preview.would.promote.length}  prune: ${preview.would.prune.length}\n`);
        out.write(`\n(gate: preview only — no DB writes yet)\n`);
    }
    finally {
        closeDb();
    }
}
main().catch((err) => {
    process.stderr.write(`tmp-forge-preview failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
});
