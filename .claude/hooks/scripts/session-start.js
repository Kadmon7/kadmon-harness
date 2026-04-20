#!/usr/bin/env node
// Hook: session-start | Trigger: SessionStart (*)
// Purpose: Load previous context, initialize session
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { parseStdin } from "./parse-stdin.js";
import { generateSummary } from "./generate-session-summary.js";
import {
  evaluateAndApplyPatterns,
  gitExec,
} from "./evaluate-patterns-shared.js";
import { readTodayLog, resolveMemoryDir } from "./daily-log.js";
import { ensureDist, isDistStale, resolveRootDir } from "./ensure-dist.js";
import { logHookError } from "./hook-logger.js";
import { rotateBackup } from "./backup-rotate.js";

async function main() {
  try {
    const input = parseStdin();
    const sid = input.session_id ?? "";
    const cwd = input.cwd ?? process.cwd();
    if (!sid) process.exit(0);

    // Detect project
    const remoteUrl = gitExec(["remote", "get-url", "origin"], cwd);
    if (!remoteUrl) {
      console.error("Kadmon: Not in a git repo — session tracking disabled.");
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

    // Backup DB with rotation before opening (prevents data loss)
    try {
      const dbFile = path.join(os.homedir(), ".kadmon", "kadmon.db");
      if (fs.existsSync(dbFile)) rotateBackup(dbFile, 3);
    } catch {
      /* never block session start for backup failure */
    }

    // Auto-build dist/ if stale (prevents silent lifecycle hook failures)
    const rootDir = resolveRootDir(import.meta.url);
    let distRebuilt = false;
    try {
      const buildResult = ensureDist(rootDir);
      distRebuilt = buildResult.rebuilt;
      if (buildResult.error) {
        logHookError("session-start", buildResult.error, {
          phase: "ensure-dist",
        });
      }
    } catch (buildErr) {
      logHookError("session-start", buildErr, { phase: "ensure-dist" });
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
        pathToFileURL(
          path.join(rootDir, "dist", "scripts", "lib", "state-store.js"),
        ).href
      );
      const { startSession, endSession } = await import(
        pathToFileURL(
          path.join(rootDir, "dist", "scripts", "lib", "session-manager.js"),
        ).href
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

          // Evaluate patterns after closing orphan (matches Stop lifecycle order)
          let orphanInstincts = 0;
          try {
            orphanInstincts = await evaluateAndApplyPatterns(orphan.id, cwd);
          } catch {
            /* best-effort — don't block recovery */
          }

          const instinctNote =
            orphanInstincts > 0
              ? ` (${orphanInstincts} instincts recovered)`
              : "";
          context += `\n- Recovered orphaned session ${orphan.id.slice(0, 8)}...${instinctNote}`;
        }
      } catch (orphanErr) {
        logHookError("session-start", orphanErr, { phase: "orphan-recovery" });
        console.error(
          JSON.stringify({
            warn: `session-start orphan recovery: ${orphanErr instanceof Error ? orphanErr.message : String(orphanErr)}`,
          }),
        );
      }

      // Prune stale instincts before loading (best-effort)
      try {
        const { pruneInstincts } = await import(
          pathToFileURL(
            path.join(rootDir, "dist", "scripts", "lib", "instinct-manager.js"),
          ).href
        );
        pruneInstincts(projectHash);
      } catch {
        /* best-effort — don't block session start */
      }

      const sessions = getRecentSessions(projectHash, 3);
      const instincts = getActiveInstincts(projectHash);
      const promotable = getPromotableInstincts(projectHash);
      instinctCount = instincts.length;

      if (sessions.length > 0) {
        const last = sessions[0];
        context += `\n## Previous Session`;
        context += `\n- Date: ${last.startedAt} | Branch: ${last.branch}`;
        if (last.summary) context += `\n- Summary: ${last.summary}`;
        const pendingTasks = last.tasks.filter((t) =>
          t.startsWith("[pending] "),
        );
        const completedTasks = last.tasks.filter(
          (t) => !t.startsWith("[pending] "),
        );
        if (completedTasks.length)
          context += `\n- Tasks: ${completedTasks.join(", ")}`;
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

        // Show older sessions as trajectory (compact format)
        if (sessions.length > 1) {
          context += `\n\n## Session History (${sessions.length} recent)`;
          for (let i = 1; i < sessions.length; i++) {
            const s = sessions[i];
            const date = s.startedAt ? s.startedAt.slice(0, 10) : "unknown";
            const sum = s.summary ? s.summary.slice(0, 120) : "(no summary)";
            context += `\n- [${date}] ${sum}`;
          }
        }

        // Show pending tasks from previous session for carry-forward
        if (pendingTasks.length > 0) {
          context += `\n\n## Pending Work (from last session)`;
          for (const t of pendingTasks.slice(0, 5)) {
            context += `\n- ${t.replace("[pending] ", "")}`;
          }
          if (pendingTasks.length > 5) {
            context += `\n- (+${pendingTasks.length - 5} more)`;
          }
        }
      }

      // Git context for session continuity
      const gitStatus = gitExec(["status", "--short"], cwd);
      const lastCommit = gitExec(["log", "--oneline", "-1"], cwd);
      if (gitStatus || lastCommit) {
        context += "\n\n## Git Context";
        if (lastCommit) context += `\n- Last commit: ${lastCommit}`;
        if (gitStatus) {
          const changedCount = gitStatus.split("\n").filter(Boolean).length;
          context += `\n- Uncommitted changes: ${changedCount} file(s)`;
        } else {
          context += "\n- Working tree clean";
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

      // Start new session (returns session with compactionCount)
      const currentSession = startSession(sid, {
        projectHash,
        remoteUrl,
        branch,
        rootDir: cwd,
      });

      // Post-compact context reinjection
      if (currentSession.compactionCount > 0) {
        context += "\n\n## Post-Compact Context Recovery";
        context += `\n- Compaction #${currentSession.compactionCount}`;
        if (currentSession.summary)
          context += `\n- Current work: ${currentSession.summary}`;
        if (
          currentSession.filesModified &&
          currentSession.filesModified.length > 0
        ) {
          context += `\n- Files in progress: ${currentSession.filesModified
            .slice(0, 5)
            .map((f) => path.basename(f))
            .join(", ")}`;
        }
        const pendingTasks = (currentSession.tasks || []).filter((t) =>
          t.startsWith("[pending] "),
        );
        if (pendingTasks.length > 0) {
          context += "\n- Pending tasks:";
          for (const t of pendingTasks.slice(0, 5))
            context += `\n  - ${t.replace("[pending] ", "")}`;
        }

        // Resolve memory dir once — used by both daily log and feedback blocks below
        const memoryDir = resolveMemoryDir(cwd);

        // Load today's daily log
        try {
          const todayLog = readTodayLog(memoryDir);
          if (todayLog) {
            context += "\n\n## Today's Session Log";
            context += `\n${todayLog}`;
          }
        } catch {}

        // Load feedback memories (behavioral corrections)
        try {
          const files = fs
            .readdirSync(memoryDir)
            .filter((f) => f.startsWith("feedback_") && f.endsWith(".md"));
          if (files.length > 0) {
            context += "\n\n## Behavioral Corrections (from memory)";
            for (const f of files.slice(0, 10)) {
              try {
                const content = fs.readFileSync(
                  path.join(memoryDir, f),
                  "utf8",
                );
                const firstLine = content
                  .split("\n")
                  .find(
                    (l) =>
                      l.trim() &&
                      !l.startsWith("---") &&
                      !l.startsWith("name:") &&
                      !l.startsWith("description:") &&
                      !l.startsWith("type:"),
                  );
                if (firstLine) context += `\n- ${firstLine.trim()}`;
              } catch {}
            }
          }
        } catch {}
      }
    } catch (dbErr) {
      logHookError("session-start", dbErr, { phase: "db-init" });
      console.error(
        `WARNING: Kadmon state-store not available. Run 'npm run build' in kadmon-harness. (${dbErr instanceof Error ? dbErr.message : String(dbErr)})`,
      );
    }

    // Cleanup old session dirs in /tmp/kadmon/ (> 7 days, not current, not test dirs)
    try {
      const kadmonTmp = path.join(os.tmpdir(), "kadmon");
      if (fs.existsSync(kadmonTmp)) {
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const uuidPattern =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const entry of fs.readdirSync(kadmonTmp)) {
          if (entry === sid) continue;
          // Clean test-* dirs older than 24h (safety net for interrupted test runs)
          if (entry.startsWith("test-")) {
            const testDirPath = path.join(kadmonTmp, entry);
            try {
              const testStat = fs.statSync(testDirPath);
              if (
                testStat.isDirectory() &&
                now - testStat.mtimeMs > 24 * 60 * 60 * 1000
              ) {
                fs.rmSync(testDirPath, { recursive: true, force: true });
              }
            } catch {
              /* skip */
            }
            continue;
          }
          if (!uuidPattern.test(entry)) continue; // only delete UUID-shaped session dirs
          const dirPath = path.join(kadmonTmp, entry);
          try {
            const stat = fs.statSync(dirPath);
            if (stat.isDirectory() && now - stat.mtimeMs > sevenDaysMs) {
              fs.rmSync(dirPath, { recursive: true, force: true });
            }
          } catch {
            /* skip unreadable dirs */
          }
        }
      }
    } catch {
      /* never block session start for cleanup failure */
    }

    // Health check: warn if dist/ is still stale after auto-build attempt
    let distNote = "";
    try {
      const distCheck = isDistStale(rootDir);
      if (distCheck.stale) {
        distNote = `\nWARNING: dist/ is ${distCheck.reason}. Lifecycle hooks may not persist data. Run 'npm run build' to fix.`;
      } else if (distRebuilt) {
        distNote = "\n(auto-rebuilt dist/)";
      }
    } catch {}

    console.log(
      `\u{1F680} Kadmon Session Started\n- Project: ${projectHash}\n- Branch: ${branch}\n- Instincts: ${instinctCount}${context}${statusLine}${distNote}`,
    );
  } catch (err) {
    logHookError("session-start", err, { phase: "main" });
    console.error(JSON.stringify({ error: `session-start: ${err instanceof Error ? err.message : String(err)}` }));
  }
  process.exit(0);
}
main();
