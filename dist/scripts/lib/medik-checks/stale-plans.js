// Kadmon Harness — /medik Check #10: stale-plans (plan-028 Phase 4.3)
// Scans docs/plans/*.md for pending plans older than 3 days with recent git activity.
// No gray-matter dep — uses regex for frontmatter parsing.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const STATUS_RE = /^status:\s*(\w+)/m;
const DATE_RE = /^date:\s*(\d{4}-\d{2}-\d{2})/m;
const STALE_THRESHOLD_DAYS = 3;
function hasPlanRecentGitActivity(planPath, cwd) {
    try {
        // Use forward slashes for git — works cross-platform
        const relPath = path.relative(cwd, planPath).replace(/\\/g, "/");
        // execFileSync with arg array — NO shell interpolation (security rule, no command injection surface)
        // timeout 3000ms + stdin=ignore — matches medik-alv.ts runGit for hang-safety on network FS / credential prompts
        const output = execFileSync("git", ["log", "--since=7 days ago", "--", relPath], { encoding: "utf8", cwd, timeout: 3000, stdio: ["ignore", "pipe", "pipe"] });
        return output.trim().length > 0;
    }
    catch {
        // git not available or error — treat as no activity (do not fail the check)
        return false;
    }
}
export function runCheck(ctx) {
    const plansDir = path.join(ctx.cwd, "docs", "plans");
    if (!fs.existsSync(plansDir)) {
        return {
            status: "PASS",
            category: "knowledge-hygiene",
            message: "No stale pending plans",
        };
    }
    const files = fs
        .readdirSync(plansDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => path.join(plansDir, f));
    const stale = [];
    const nowMs = Date.now();
    for (const filePath of files) {
        let content;
        try {
            content = fs.readFileSync(filePath, "utf-8");
        }
        catch {
            continue;
        }
        const statusMatch = STATUS_RE.exec(content);
        if (!statusMatch)
            continue;
        const status = statusMatch[1].toLowerCase();
        if (status !== "pending")
            continue;
        const dateMatch = DATE_RE.exec(content);
        if (!dateMatch)
            continue;
        const dateMs = new Date(dateMatch[1]).getTime();
        if (isNaN(dateMs))
            continue;
        const ageMs = nowMs - dateMs;
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        if (ageDays > STALE_THRESHOLD_DAYS && hasPlanRecentGitActivity(filePath, ctx.cwd)) {
            stale.push(path.basename(filePath, ".md"));
        }
    }
    if (stale.length === 0) {
        return {
            status: "PASS",
            category: "knowledge-hygiene",
            message: "No stale pending plans",
        };
    }
    return {
        status: "WARN",
        category: "knowledge-hygiene",
        message: `${stale.length} stale pending plan${stale.length > 1 ? "s" : ""}: ${stale.join(", ")} (>3d without completion)`,
        details: stale,
    };
}
