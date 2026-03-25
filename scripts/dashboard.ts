#!/usr/bin/env node
// Kadmon Harness — CLI Dashboard Entry Point
// Usage: npx tsx scripts/dashboard.ts

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, closeDb } from "./lib/state-store.js";
import { detectProject } from "./lib/project-detect.js";
import { renderDashboard } from "./lib/dashboard.js";
import type { ObservabilityEvent } from "./lib/types.js";

function loadObservations(sessionId: string): ObservabilityEvent[] {
  const obsDir = path.join(os.tmpdir(), "kadmon", sessionId);
  const obsFile = path.join(obsDir, "observations.jsonl");

  if (!fs.existsSync(obsFile)) return [];

  const lines = fs.readFileSync(obsFile, "utf-8").split("\n").filter(Boolean);
  const events: ObservabilityEvent[] = [];

  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as ObservabilityEvent);
    } catch {
      // skip malformed lines
    }
  }

  return events;
}

function findLatestSessionDir(): string | null {
  const kadmonTmp = path.join(os.tmpdir(), "kadmon");
  if (!fs.existsSync(kadmonTmp)) return null;

  const entries = fs
    .readdirSync(kadmonTmp, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({
      name: e.name,
      mtime: fs.statSync(path.join(kadmonTmp, e.name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return entries.length > 0 ? entries[0].name : null;
}

async function main(): Promise<void> {
  const project = detectProject();
  if (!project) {
    console.error("Not in a git repository. Cannot detect project.");
    process.exit(1);
  }

  await openDb();

  try {
    const sessionId = findLatestSessionDir();
    const events = sessionId ? loadObservations(sessionId) : [];

    const output = renderDashboard(project.projectHash, events);
    console.log(output);
  } finally {
    closeDb();
  }
}

main().catch((err: unknown) => {
  console.error("Dashboard error:", err);
  process.exit(1);
});
