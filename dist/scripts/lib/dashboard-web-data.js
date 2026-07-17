// Kadmon Harness — Web Dashboard: pure data assembly (plan-039)
//
// Two builders, zero http/console coupling so both are trivially unit-testable:
//   buildCatalog(rootDir)        — fs scans of agents/skills/commands/hooks/tests
//   buildTelemetry(projectHash)  — state-store getters -> TelemetryResponse
//
// No new npm dependencies (no YAML parser) — frontmatter extraction mirrors
// scripts/lib/medik-checks/frontmatter.ts's regex style.
import fs from "node:fs";
import path from "node:path";
import { getActiveInstincts, getRecentSessions, getOrphanedSessions, getCostSummaryByModel, getHookEventStats, getAgentInvocationStats, } from "./state-store.js";
// ─── Frontmatter helpers (no YAML dependency — mirror medik-checks/frontmatter.ts) ───
function getFrontmatterBlock(content) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    return match ? match[1] : "";
}
function extractFrontmatterField(frontmatter, field) {
    const quoted = new RegExp(`^${field}:\\s*"([^"]*)"`, "m").exec(frontmatter);
    if (quoted)
        return quoted[1];
    const bare = new RegExp(`^${field}:\\s*(.+)$`, "m").exec(frontmatter);
    return bare ? bare[1].trim() : null;
}
function readFrontmatter(filePath) {
    const block = getFrontmatterBlock(fs.readFileSync(filePath, "utf-8"));
    const fields = {};
    for (const field of ["name", "model", "description"]) {
        const value = extractFrontmatterField(block, field);
        if (value !== null)
            fields[field] = value;
    }
    return fields;
}
// ─── Catalog scanners ───
/** List of `.md` files in `dir` (excluding CATALOG.md) with parsed frontmatter. */
function readMarkdownFrontmatters(dir) {
    if (!fs.existsSync(dir))
        return [];
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".md") && f !== "CATALOG.md")
        .map((file) => ({ file, fields: readFrontmatter(path.join(dir, file)) }));
}
function scanAgents(rootDir) {
    const dir = path.join(rootDir, ".claude", "agents");
    return readMarkdownFrontmatters(dir).map(({ file, fields }) => ({
        name: fields.name ?? file.replace(/\.md$/, ""),
        model: fields.model ?? "unknown",
        description: fields.description ?? "",
    }));
}
function scanCommands(rootDir) {
    const dir = path.join(rootDir, ".claude", "commands");
    return readMarkdownFrontmatters(dir).map(({ file, fields }) => ({
        name: file.replace(/\.md$/, ""),
        description: fields.description ?? "",
    }));
}
function scanSkills(rootDir) {
    const dir = path.join(rootDir, ".claude", "skills");
    if (!fs.existsSync(dir))
        return [];
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        const skillFile = path.join(dir, entry.name, "SKILL.md");
        if (!fs.existsSync(skillFile))
            continue;
        const fields = readFrontmatter(skillFile);
        results.push({ name: fields.name ?? entry.name, description: fields.description ?? "" });
    }
    return results;
}
/** Unique hook script names referenced anywhere in settings.json's hooks tree. */
function countHooks(rootDir) {
    const settingsPath = path.join(rootDir, ".claude", "settings.json");
    if (!fs.existsSync(settingsPath))
        return 0;
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    }
    catch {
        return 0;
    }
    const hooksObj = parsed.hooks;
    if (!hooksObj || typeof hooksObj !== "object")
        return 0;
    const scriptNames = new Set();
    for (const eventGroups of Object.values(hooksObj)) {
        if (!Array.isArray(eventGroups))
            continue;
        for (const group of eventGroups) {
            if (!Array.isArray(group.hooks))
                continue;
            for (const hook of group.hooks) {
                if (typeof hook.command !== "string")
                    continue;
                const match = /scripts\/([\w-]+)\.js/.exec(hook.command);
                if (match)
                    scriptNames.add(match[1]);
            }
        }
    }
    return scriptNames.size;
}
function countTestFiles(rootDir) {
    const dir = path.join(rootDir, "tests");
    if (!fs.existsSync(dir))
        return 0;
    let count = 0;
    const walk = (current) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory())
                walk(full);
            else if (entry.isFile() && entry.name.endsWith(".test.ts"))
                count++;
        }
    };
    walk(dir);
    return count;
}
export function buildCatalog(rootDir) {
    return {
        agents: scanAgents(rootDir),
        skills: scanSkills(rootDir),
        commands: scanCommands(rootDir),
        hookCount: countHooks(rootDir),
        testFileCount: countTestFiles(rootDir),
        generatedAt: new Date().toISOString(),
    };
}
// ─── Telemetry ───
// Hook latency budgets mirrored from .claude/rules/common/hooks.md as
// constants (no runtime doc parsing): observe-pre/post 50ms, no-context-guard
// 100ms, everything else 500ms. The 3 toolchain-spawning hooks are a
// documented exception (exempt: true), not a real budget violation.
const BUDGET_50_HOOKS = new Set(["observe-pre", "observe-post"]);
const BUDGET_100_HOOKS = new Set(["no-context-guard"]);
const EXEMPT_HOOKS = new Set([
    "post-edit-typecheck",
    "quality-gate",
    "post-edit-format",
]);
function getHookBudget(hookName) {
    if (BUDGET_50_HOOKS.has(hookName))
        return { budgetMs: 50, exempt: false };
    if (BUDGET_100_HOOKS.has(hookName))
        return { budgetMs: 100, exempt: false };
    if (EXEMPT_HOOKS.has(hookName))
        return { budgetMs: 500, exempt: true };
    return { budgetMs: 500, exempt: false };
}
// excludeSessionId "" (never a real session id) + a generous limit turns
// getOrphanedSessions into a total-count query — buildTelemetry has no
// notion of "the current live session" to exclude, unlike the CLI dashboard.
const ORPHAN_SCAN_LIMIT = 1000;
export function buildTelemetry(projectHash) {
    const activeInstincts = getActiveInstincts(projectHash);
    const recentSessions = getRecentSessions(projectHash);
    const orphanCount = getOrphanedSessions(projectHash, "", ORPHAN_SCAN_LIMIT)
        .length;
    const costByModel = getCostSummaryByModel(projectHash);
    const hookStats = getHookEventStats(projectHash);
    const agentStats = getAgentInvocationStats(projectHash);
    return {
        projectHash,
        instincts: {
            counts: {
                active: activeInstincts.length,
                global: activeInstincts.filter((i) => i.scope === "global").length,
                project: activeInstincts.filter((i) => i.scope === "project").length,
            },
            items: activeInstincts.map((i) => ({
                id: i.id,
                pattern: i.pattern,
                confidence: i.confidence,
                occurrences: i.occurrences,
                scope: i.scope,
                lastReinforced: i.lastObservedAt ?? null,
            })),
        },
        sessions: {
            recent: recentSessions.map((s) => ({
                id: s.id,
                startedAt: s.startedAt,
                messageCount: s.messageCount,
                filesModified: s.filesModified.length,
                costUsd: s.estimatedCostUsd,
                summary: s.summary ?? null,
            })),
            orphanCount,
        },
        cost: {
            byModel: costByModel.map((c) => ({
                model: c.model,
                totalUsd: c.totalCostUsd,
                inputTokens: c.totalInputTokens,
                outputTokens: c.totalOutputTokens,
            })),
        },
        hookHealth: hookStats.map((h) => ({
            hookName: h.hookName,
            avgDurationMs: h.avgDurationMs,
            events: h.total,
            blocked: h.blocks,
            ...getHookBudget(h.hookName),
        })),
        agents: agentStats.map((a) => ({
            agentType: a.agentType,
            invocations: a.total,
            successRate: 1 - a.failureRate,
            avgDurationMs: a.avgDurationMs,
        })),
        generatedAt: new Date().toISOString(),
    };
}
