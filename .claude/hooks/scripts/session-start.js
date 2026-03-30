#!/usr/bin/env node
// Hook: session-start | Trigger: SessionStart (*)
// Purpose: Load previous context, initialize session
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { parseStdin } from "./parse-stdin.js";

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

async function main() {
  try {
    const input = parseStdin();
    const sid = input.session_id ?? "";
    const cwd = input.cwd ?? process.cwd();
    if (!sid) process.exit(0);

    // Detect project
    const remoteUrl = gitExec(["remote", "get-url", "origin"], cwd);
    if (!remoteUrl) {
      console.log("Kadmon: Not in a git repo — session tracking disabled.");
      process.exit(0);
    }
    const projectHash = crypto
      .createHash("sha256")
      .update(remoteUrl)
      .digest("hex")
      .slice(0, 16);
    const branch = gitExec(["branch", "--show-current"], cwd) ?? "unknown";

    // Initialize session dir
    const sessionDir = path.join(os.tmpdir(), "kadmon", sid);
    fs.mkdirSync(sessionDir, { recursive: true });

    // Backup DB before opening (prevents data loss from silent failures)
    try {
      const dbFile = path.join(os.homedir(), ".kadmon", "kadmon.db");
      const backupFile = path.join(os.homedir(), ".kadmon", "kadmon.db.bak");
      if (fs.existsSync(dbFile)) fs.copyFileSync(dbFile, backupFile);
    } catch {
      /* never block session start for backup failure */
    }

    // Try loading previous session context from SQLite
    let context = "";
    let instinctCount = 0;
    try {
      const { openDb, getRecentSessions, getActiveInstincts } = await import(
        new URL("../../../dist/scripts/lib/state-store.js", import.meta.url)
          .href
      );
      await openDb(process.env.KADMON_TEST_DB || undefined);
      const sessions = getRecentSessions(projectHash, 1);
      const instincts = getActiveInstincts(projectHash);
      instinctCount = instincts.length;

      if (sessions.length > 0) {
        const last = sessions[0];
        context += `\n## Previous Session\n- Date: ${last.startedAt} | Branch: ${last.branch}`;
        if (last.summary) context += `\n- Summary: ${last.summary}`;
        if (last.tasks.length) context += `\n- Tasks: ${last.tasks.join(", ")}`;
        context += `\n- Files modified: ${last.filesModified.length}`;

        // Check if previous session ended cleanly (best-effort, temp dirs may be gone)
        try {
          const prevDir = path.join(os.tmpdir(), "kadmon", last.id);
          if (
            fs.existsSync(prevDir) &&
            !fs.existsSync(path.join(prevDir, "clean-exit.marker"))
          ) {
            context += `\n- \u{26A0}\u{FE0F} Previous session may not have ended cleanly`;
          }
        } catch {
          /* ignore — marker check is best-effort */
        }
      }

      if (instincts.length > 0) {
        context += `\n\n## Active Instincts (${instincts.length})`;
        for (const inst of instincts.slice(0, 5)) {
          const domainTag = inst.domain ? ` (${inst.domain})` : "";
          context += `\n- [${inst.confidence.toFixed(1)}] ${inst.pattern}${domainTag}`;
        }
      }

      // Start new session
      const { startSession } = await import(
        new URL("../../../dist/scripts/lib/session-manager.js", import.meta.url)
          .href
      );
      startSession(sid, { projectHash, remoteUrl, branch, rootDir: cwd });
    } catch (dbErr) {
      console.log(
        `WARNING: Kadmon state-store not available. Run 'npm run build' in kadmon-harness. (${dbErr.message})`,
      );
    }

    // Write instinct count for status line
    try {
      fs.writeFileSync(
        path.join(sessionDir, "instinct_count.txt"),
        String(instinctCount),
      );
    } catch {}

    console.log(
      `\u{1F680} Kadmon Session Started\n- Project: ${projectHash}\n- Branch: ${branch}\n- Instincts: ${instinctCount}${context}`,
    );
  } catch (err) {
    console.error(JSON.stringify({ error: `session-start: ${err.message}` }));
  }
  process.exit(0);
}
main();
