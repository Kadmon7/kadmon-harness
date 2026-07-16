// Kadmon Harness — /release Wave 1: status-flips.ts (plan-037 Step 1.5, ADR-037 D5)
// Scans the ## [Unreleased] CHANGELOG section for referenced ADR-NNN / plan-NNN / roadmap
// doc references and proposes a status flip when one is warranted. NEVER writes — the
// human decides which flips actually shipped (D5).
import fs from "node:fs";
import path from "node:path";
import { log } from "../utils.js";
const UNRELEASED_HEADING_RE = /^## \[Unreleased\]\s*$/m;
const NEXT_HEADING_RE = /^## \[/m;
const ADR_REF_RE = /\bADR-(\d{3,})\b/g;
const PLAN_REF_RE = /\bplan-(\d{3,})\b/g;
const ROADMAP_REF_RE = /docs\/roadmap\/([\w.-]+\.md)/g;
const STATUS_RE = /^status:\s*(\S+)/m;
const CHECKBOX_OPEN_RE = /^- \[ \] .+$/;
function toPosix(relPath) {
    return relPath.replace(/\\/g, "/");
}
/** Extracts the body between "## [Unreleased]" and the next "## [" heading. */
function extractUnreleasedSection(changelog) {
    const startMatch = UNRELEASED_HEADING_RE.exec(changelog);
    if (!startMatch)
        return "";
    const afterStart = changelog.slice(startMatch.index + startMatch[0].length);
    const nextMatch = NEXT_HEADING_RE.exec(afterStart);
    return nextMatch ? afterStart.slice(0, nextMatch.index) : afterStart;
}
/** Finds a file in `dir` whose name starts with `prefix` and ends with .md. Read-only. */
function findDocByPrefix(dir, prefix) {
    if (!fs.existsSync(dir))
        return null;
    const match = fs.readdirSync(dir).find((f) => f.startsWith(prefix) && f.endsWith(".md"));
    return match ? path.join(dir, match) : null;
}
// Shared by proposeAdrFlip / proposePlanFlip / proposeRoadmapFlips / proposeStatusFlips
// (CHANGELOG.md) — each caller treats a null return as "skip this doc's flip
// proposal(s)", so filePath is included in the log meta to disambiguate which
// caller/file failed (a single generic message would otherwise be untraceable
// across 4+ call sites).
function readFileSafe(filePath) {
    try {
        return fs.readFileSync(filePath, "utf8");
    }
    catch (e) {
        log("warn", "readFileSafe failed: falling back to returning null (treated as unreadable, this doc's flip proposal(s) skipped)", {
            operation: "readFileSafe",
            filePath,
            fallback: "returning null (treated as unreadable, this doc's flip proposal(s) skipped)",
            error: e instanceof Error ? e.message : String(e),
        });
        return null;
    }
}
function proposeAdrFlip(cwd, num, reason) {
    const filePath = findDocByPrefix(path.join(cwd, "docs", "decisions"), `ADR-${num}-`);
    if (!filePath)
        return null;
    const content = readFileSafe(filePath);
    if (content === null)
        return null;
    const statusMatch = STATUS_RE.exec(content);
    if (!statusMatch)
        return null;
    const current = statusMatch[1];
    if (current !== "proposed")
        return null;
    return { file: toPosix(path.relative(cwd, filePath)), current, proposed: "accepted", reason };
}
function proposePlanFlip(cwd, num, reason) {
    const filePath = findDocByPrefix(path.join(cwd, "docs", "plans"), `plan-${num}-`);
    if (!filePath)
        return null;
    const content = readFileSafe(filePath);
    if (content === null)
        return null;
    const statusMatch = STATUS_RE.exec(content);
    if (!statusMatch)
        return null;
    const current = statusMatch[1];
    if (current !== "pending" && current !== "in-progress")
        return null;
    return { file: toPosix(path.relative(cwd, filePath)), current, proposed: "completed", reason };
}
function proposeRoadmapFlips(cwd, relPath, reason) {
    const filePath = path.join(cwd, relPath);
    const content = readFileSafe(filePath);
    if (content === null)
        return [];
    const posixPath = toPosix(relPath);
    return content
        .split("\n")
        .filter((line) => CHECKBOX_OPEN_RE.test(line))
        .map(() => ({ file: posixPath, current: "[ ]", proposed: "[x]", reason }));
}
/**
 * Scans the ## [Unreleased] CHANGELOG section for referenced ADR-NNN / plan-NNN / roadmap
 * file references and proposes a status flip for each doc that is not already at its
 * target status. Never writes — output only (ADR-037 D5).
 */
export function proposeStatusFlips(ctx) {
    const changelogPath = path.join(ctx.cwd, "CHANGELOG.md");
    const changelog = readFileSafe(changelogPath);
    if (changelog === null)
        return [];
    const section = extractUnreleasedSection(changelog);
    if (!section.trim())
        return [];
    const proposals = [];
    const seen = new Set();
    let match;
    ADR_REF_RE.lastIndex = 0;
    while ((match = ADR_REF_RE.exec(section)) !== null) {
        const num = match[1];
        const key = `adr:${num}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        const proposal = proposeAdrFlip(ctx.cwd, num, `Referenced as ADR-${num} in [Unreleased]`);
        if (proposal)
            proposals.push(proposal);
    }
    PLAN_REF_RE.lastIndex = 0;
    while ((match = PLAN_REF_RE.exec(section)) !== null) {
        const num = match[1];
        const key = `plan:${num}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        const proposal = proposePlanFlip(ctx.cwd, num, `Referenced as plan-${num} in [Unreleased]`);
        if (proposal)
            proposals.push(proposal);
    }
    ROADMAP_REF_RE.lastIndex = 0;
    while ((match = ROADMAP_REF_RE.exec(section)) !== null) {
        const relPath = `docs/roadmap/${match[1]}`;
        const key = `roadmap:${relPath}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        proposals.push(...proposeRoadmapFlips(ctx.cwd, relPath, `Referenced at ${relPath} in [Unreleased]`));
    }
    return proposals;
}
