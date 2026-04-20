#!/usr/bin/env node
// Kadmon Harness — Sync Instincts to Auto Memory
// Bridges SQLite instincts → Claude Code Auto Memory topic files
// Usage: npx tsx scripts/sync-instincts-to-memory.ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, closeDb, getActiveInstincts } from "./lib/state-store.js";
import { detectProject } from "./lib/project-detect.js";
function sanitizeCwd(cwd) {
    return cwd.replace(/[/\\:]/g, "-").replace(/^-+/, "");
}
function getMemoryDir(cwd) {
    const sanitized = sanitizeCwd(cwd);
    return path.join(os.homedir(), ".claude", "projects", sanitized, "memory");
}
function instinctToTopicFile(instinct) {
    const confidenceLabel = instinct.confidence >= 0.7
        ? "high"
        : instinct.confidence >= 0.5
            ? "medium"
            : "low";
    return `---
name: instinct-${instinct.pattern
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 50)}
description: Learned pattern (${confidenceLabel} confidence): ${instinct.pattern}
type: feedback
---

${instinct.pattern}

**Why:** Observed ${instinct.occurrences} time(s) across sessions. Confidence: ${instinct.confidence.toFixed(1)}/1.0.

**How to apply:** ${instinct.action}
`;
}
function buildMemoryIndex(instincts) {
    const lines = [];
    lines.push("# Kadmon Instinct Memory");
    lines.push("");
    if (instincts.length === 0) {
        lines.push("No active instincts yet. Run `/learn` after a productive session.");
        return lines.join("\n");
    }
    lines.push(`${instincts.length} active instinct(s) synced from Kadmon Harness.`);
    lines.push("");
    for (const inst of instincts) {
        const slug = inst.pattern
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 50);
        const bar = inst.confidence >= 0.7 ? "HIGH" : inst.confidence >= 0.5 ? "MED" : "LOW";
        lines.push(`- [${bar}] [${inst.pattern}](instinct-${slug}.md) — ${inst.action.slice(0, 80)}`);
    }
    return lines.join("\n");
}
export async function syncInstinctsToMemory(cwd) {
    const project = detectProject(cwd);
    if (!project) {
        return { synced: 0, memoryDir: "" };
    }
    const resolvedCwd = cwd ?? process.cwd();
    const memoryDir = getMemoryDir(resolvedCwd);
    fs.mkdirSync(memoryDir, { recursive: true });
    await openDb();
    try {
        const instincts = getActiveInstincts(project.projectHash);
        // Remove old instinct topic files
        const existing = fs
            .readdirSync(memoryDir)
            .filter((f) => f.startsWith("instinct-"));
        for (const f of existing) {
            fs.unlinkSync(path.join(memoryDir, f));
        }
        // Write topic files for each active instinct
        for (const inst of instincts) {
            const slug = inst.pattern
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .slice(0, 50);
            const filename = `instinct-${slug}.md`;
            fs.writeFileSync(path.join(memoryDir, filename), instinctToTopicFile(inst));
        }
        // Write MEMORY.md index
        fs.writeFileSync(path.join(memoryDir, "MEMORY.md"), buildMemoryIndex(instincts));
        return { synced: instincts.length, memoryDir };
    }
    finally {
        closeDb();
    }
}
// CLI entry point
async function main() {
    const { synced, memoryDir } = await syncInstinctsToMemory();
    if (synced > 0) {
        console.log(`Synced ${synced} instinct(s) to Auto Memory: ${memoryDir}`);
    }
    else {
        console.log("No active instincts to sync.");
    }
}
main().catch((err) => {
    console.error("sync-instincts-to-memory error:", err);
    process.exit(1);
});
