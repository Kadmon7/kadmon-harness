// Kadmon Harness — /medik Check #16: graphify-health (AUD-25 / R-13)
// Verifies the optional graphify-out/ knowledge graph is present and fresh
// relative to HEAD. Absence is a NOTE (opt-in feature, not adopted here —
// same spirit as Check #8/#14 absent-target NOTE). A present dir with a
// missing graph.json IS a WARN (broken/incomplete build). Staleness is a
// deliberately advisory NOTE, not a WARN — R-13 is LOW/advisory and a WARN
// on every post-commit build would cry wolf.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const MS_PER_DAY = 86_400_000;
export function evaluateGraphHealth(input) {
    if (!input.dirExists) {
        return {
            status: "NOTE",
            category: "knowledge-hygiene",
            message: "no graphify-out/ in this project — knowledge graph not adopted here, skipped",
        };
    }
    if (!input.graphJsonExists) {
        return {
            status: "WARN",
            category: "knowledge-hygiene",
            message: "graphify-out/ present but graph.json missing — run `graphify .` to build the graph",
        };
    }
    if (input.headCommitMs === null) {
        return {
            status: "PASS",
            category: "knowledge-hygiene",
            message: "graphify-out/graph.json present (freshness check skipped: git unavailable)",
        };
    }
    if (input.graphMtimeMs < input.headCommitMs) {
        const staleDays = Math.ceil((input.headCommitMs - input.graphMtimeMs) / MS_PER_DAY);
        return {
            status: "NOTE",
            category: "knowledge-hygiene",
            message: `graphify-out/graph.json is ${staleDays} day(s) behind HEAD — consider \`graphify update .\``,
        };
    }
    return {
        status: "PASS",
        category: "knowledge-hygiene",
        message: "graphify-out/graph.json fresh (built at/after HEAD commit)",
    };
}
function getHeadCommitMs(cwd) {
    try {
        // execFileSync with arg array — NO shell interpolation (security rule, no command injection surface)
        // timeout 3000ms + stdin=ignore — matches stale-plans.ts hang-safety on network FS / credential prompts
        const output = execFileSync("git", ["log", "-1", "--format=%ct"], {
            encoding: "utf8",
            cwd,
            timeout: 3000,
            stdio: ["ignore", "pipe", "pipe"],
        });
        const trimmed = output.trim();
        if (trimmed.length === 0)
            return null;
        const epochSeconds = parseInt(trimmed, 10);
        if (isNaN(epochSeconds))
            return null;
        return epochSeconds * 1000;
    }
    catch {
        // git not available, no commits, or error — treat as unavailable (do not fail the check)
        return null;
    }
}
export function runCheck(ctx) {
    const graphOutDir = path.join(ctx.cwd, "graphify-out");
    if (!fs.existsSync(graphOutDir)) {
        return evaluateGraphHealth({ dirExists: false });
    }
    const graphJson = path.join(graphOutDir, "graph.json");
    if (!fs.existsSync(graphJson)) {
        return evaluateGraphHealth({ dirExists: true, graphJsonExists: false });
    }
    // Only spawn git once graph.json actually exists — the common consumer
    // case (no graphify-out/ at all) never pays for a git subprocess (perf: spektr LOW-1).
    const graphMtimeMs = fs.statSync(graphJson).mtimeMs;
    const headCommitMs = getHeadCommitMs(ctx.cwd);
    return evaluateGraphHealth({
        dirExists: true,
        graphJsonExists: true,
        graphMtimeMs,
        headCommitMs,
    });
}
