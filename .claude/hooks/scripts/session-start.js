#!/usr/bin/env node
// Hook: session-start | Trigger: SessionStart (*)
// Purpose: Load previous context, initialize session
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { parseStdin } from "./parse-stdin.js";
import { generateSummary } from "./generate-session-summary.js";

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
    let statusLine = "";
    try {
      const {
        openDb,
        getRecentSessions,
        getActiveInstincts,
        getPromotableInstincts,
        getOrphanedSessions,
      } = await import(
        new URL("../../../dist/scripts/lib/state-store.js", import.meta.url)
          .href
      );
      const { startSession, endSession } = await import(
        new URL("../../../dist/scripts/lib/session-manager.js", import.meta.url)
          .href
      );
      await openDb(process.env.KADMON_TEST_DB || undefined);

      // Recover orphaned sessions (best-effort, most recent only)
      try {
        const orphans = getOrphanedSessions(projectHash, sid, 1);
        if (orphans.length > 0) {
          const orphan = orphans[0];
          const orphanObsPath = path.join(
            os.tmpdir(),
            "kadmon",
            orphan.id,
            "observations.jsonl",
          );
          let recoveryData = {};

          if (fs.existsSync(orphanObsPath)) {
            const { summary, tasks } = generateSummary(orphanObsPath);
            const obsLines = fs
              .readFileSync(orphanObsPath, "utf8")
              .split("\n")
              .filter(Boolean);
            let msgCount = 0;
            const filesSet = new Set();
            const toolsSet = new Set();
            for (const line of obsLines) {
              try {
                const e = JSON.parse(line);
                if (e.eventType === "tool_pre") msgCount++;
                if (e.toolName) toolsSet.add(e.toolName);
                if (e.filePath && ["Edit", "Write"].includes(e.toolName))
                  filesSet.add(e.filePath);
              } catch {}
            }
            recoveryData = {
              messageCount: Math.max(orphan.messageCount, msgCount),
              filesModified:
                filesSet.size > 0 ? [...filesSet] : orphan.filesModified,
              toolsUsed: toolsSet.size > 0 ? [...toolsSet] : orphan.toolsUsed,
              summary: summary || orphan.summary,
              tasks: tasks.length > 0 ? tasks : orphan.tasks,
            };
          }

          endSession(orphan.id, recoveryData);
          context += `\n- Recovered orphaned session ${orphan.id.slice(0, 8)}...`;
        }
      } catch (orphanErr) {
        console.error(
          JSON.stringify({
            warn: `session-start orphan recovery: ${orphanErr.message}`,
          }),
        );
      }

      const sessions = getRecentSessions(projectHash, 1);
      const instincts = getActiveInstincts(projectHash);
      const promotable = getPromotableInstincts(projectHash);
      instinctCount = instincts.length;

      if (sessions.length > 0) {
        const last = sessions[0];
        context += `\n## Previous Session\n- Date: ${last.startedAt} | Branch: ${last.branch}`;
        if (last.summary) context += `\n- Summary: ${last.summary}`;
        if (last.tasks.length) context += `\n- Tasks: ${last.tasks.join(", ")}`;
        context += `\n- Messages: ${last.messageCount} | Compactions: ${last.compactionCount} | Files: ${last.filesModified.length}`;
        if (last.filesModified.length > 0) {
          const topFiles = last.filesModified
            .slice(0, 3)
            .map((f) => path.basename(f));
          let filesLine = `\n- Key files: ${topFiles.join(", ")}`;
          if (last.filesModified.length > 3)
            filesLine += ` (+${last.filesModified.length - 3} more)`;
          context += filesLine;
        }

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

      // Build mini-dashboard status line
      const promoLabel =
        promotable.length > 0 ? ` (${promotable.length} promotable)` : "";
      const lastSession = sessions.length > 0 ? sessions[0] : null;
      const lastCost = lastSession
        ? `$${lastSession.estimatedCostUsd.toFixed(2)}`
        : "$0.00";
      const lastMsgs = lastSession ? lastSession.messageCount : 0;
      statusLine = `\n## Status\n- Instincts: ${instincts.length} active${promoLabel} | Last session: ${lastCost} | ${lastMsgs} msgs`;

      // Start new session
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
      `\u{1F680} Kadmon Session Started\n- Project: ${projectHash}\n- Branch: ${branch}\n- Instincts: ${instinctCount}${context}${statusLine}`,
    );
  } catch (err) {
    console.error(JSON.stringify({ error: `session-start: ${err.message}` }));
  }
  process.exit(0);
}
main();
