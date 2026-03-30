// Shared pattern evaluation logic used by both evaluate-session.js and pre-compact-save.js
// Extracts tool sequences from observations and evaluates them against pattern definitions.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function gitExec(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Run pattern evaluation on observations and create/reinforce instincts.
 * @param {string} sid - Session ID
 * @param {string} cwd - Working directory for git commands
 * @param {number} minLines - Minimum observation lines required (default 10)
 * @returns {Promise<number>} Number of instincts updated
 */
export async function evaluateAndApplyPatterns(sid, cwd, minLines = 10) {
  const obsPath = path.join(os.tmpdir(), "kadmon", sid, "observations.jsonl");
  if (!fs.existsSync(obsPath)) return 0;

  const lines = fs.readFileSync(obsPath, "utf8").split("\n").filter(Boolean);
  if (lines.length < minLines) return 0;

  const remoteUrl = gitExec(["remote", "get-url", "origin"], cwd);
  if (!remoteUrl) return 0;

  const projectHash = crypto
    .createHash("sha256")
    .update(remoteUrl)
    .digest("hex")
    .slice(0, 16);

  const toolSequences = [];
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      if (e.eventType === "tool_pre") toolSequences.push(e.toolName);
    } catch {}
  }

  let instinctsUpdated = 0;

  const { getActiveInstincts } = await import(
    new URL("../../../dist/scripts/lib/state-store.js", import.meta.url).href
  );
  const { createInstinct, reinforceInstinct } = await import(
    new URL("../../../dist/scripts/lib/instinct-manager.js", import.meta.url)
      .href
  );
  const { evaluatePatterns, loadPatternDefinitions } = await import(
    new URL("../../../dist/scripts/lib/pattern-engine.js", import.meta.url).href
  );

  const defsUrl = new URL("../pattern-definitions.json", import.meta.url);
  const definitions = loadPatternDefinitions(fileURLToPath(defsUrl));
  const results = evaluatePatterns(definitions, toolSequences, lines);

  const existing = getActiveInstincts(projectHash);
  const existingPatterns = new Map(existing.map((i) => [i.pattern, i]));

  for (const r of results) {
    if (r.triggered) {
      if (existingPatterns.has(r.name)) {
        reinforceInstinct(existingPatterns.get(r.name).id, sid);
      } else {
        createInstinct(projectHash, r.name, r.action, sid, "project", r.domain);
      }
      instinctsUpdated++;
    }
  }

  return instinctsUpdated;
}
