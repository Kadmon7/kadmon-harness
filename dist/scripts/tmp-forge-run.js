// Temporary /forge invocation script — deleted after use
import { runForgePipeline } from "./lib/forge-pipeline.js";
import { detectProject } from "./lib/project-detect.js";
const sessionId = process.argv[2];
if (!sessionId) {
    console.error("usage: forge-run <sessionId>");
    process.exit(1);
}
const project = detectProject();
if (!project) {
    console.error("project detect failed");
    process.exit(1);
}
const preview = await runForgePipeline({
    projectHash: project.projectHash,
    sessionId,
    dryRun: true,
});
console.log(JSON.stringify(preview, null, 2));
