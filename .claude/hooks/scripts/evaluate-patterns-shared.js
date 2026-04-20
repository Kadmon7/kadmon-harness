// Shared pattern evaluation logic used by session-end-all.js, pre-compact-save.js, and session-start.js
// Extracts tool sequences from observations and evaluates them against pattern definitions.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveRootDir } from "./ensure-dist.js";
import { logHookError } from "./hook-logger.js";

export function gitExec(args, cwd) {
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

  const rawLines = fs.readFileSync(obsPath, "utf8").split("\n").filter(Boolean);
  if (rawLines.length < minLines) return 0;

  // R5 guard (ADR-015): research_finding observations are emitted to the
  // same observations.jsonl by the /skavenger command, but they must NOT
  // contribute to ClusterReport pattern evaluation — research findings are
  // their own signal type consumed by alchemik during /evolve, not a
  // coding-behavior pattern. Filter them out before pattern eval while
  // leaving the raw file untouched for debugging. Unparseable lines pass
  // through (don't silently drop data the pattern engine already tolerates).
  const lines = rawLines.filter((line) => {
    try {
      const e = JSON.parse(line);
      return e.eventType !== "research_finding";
    } catch {
      return true;
    }
  });
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

  const rootDir = resolveRootDir(import.meta.url);
  const { getActiveInstincts } = await import(
    pathToFileURL(
      path.join(rootDir, "dist", "scripts", "lib", "state-store.js"),
    ).href
  );
  const { createInstinct, reinforceInstinct } = await import(
    pathToFileURL(
      path.join(rootDir, "dist", "scripts", "lib", "instinct-manager.js"),
    ).href
  );
  const { evaluatePatterns, loadPatternDefinitions } = await import(
    pathToFileURL(
      path.join(rootDir, "dist", "scripts", "lib", "pattern-engine.js"),
    ).href
  );

  // pattern-definitions.json lives ALONGSIDE this hook script (NOT under dist/),
  // so the relative URL is correct in BOTH local-dev and plugin mode (file ships
  // co-located in ${CLAUDE_PLUGIN_ROOT}/.claude/hooks/).
  // (CLAUDE_PLUGIN_ROOT is the hooks.json substitution token for the plugin install
  //  dir — distinct from CLAUDE_PLUGIN_DATA, which is the per-user data dir where
  //  dist/ lives and where KADMON_RUNTIME_ROOT points at runtime.)
  // Do not "fix" this to use rootDir — that would break plugin mode.
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
