import { runForgePipeline } from "./lib/forge-pipeline.js";
import { openDb } from "./lib/state-store.js";
await openDb();
const preview = await runForgePipeline({
    projectHash: "9444ca5b82301f2f",
    sessionId: "a330258f-13a2-4abb-9b76-e4b34003cf28",
    dryRun: true,
});
console.log(JSON.stringify({
    would_create: preview.would.create,
    would_reinforce: preview.would.reinforce,
    would_promote: preview.would.promote,
    would_prune: preview.would.prune,
    clusters: preview.clusterReport.clusters.map(c => ({
        domain: c.domain,
        members: c.members.length,
        suggestedCategory: c.suggestedCategory,
    })),
    unclustered_count: preview.clusterReport.unclustered.length,
}, null, 2));
