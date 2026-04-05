#!/usr/bin/env node
// Hook: session-end-all | Trigger: Stop (*)
// Purpose: Consolidated Stop hook — replaces 4 separate hooks to avoid sql.js race condition.
// Order: persist session → evaluate patterns → track cost → write marker
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseStdin } from "./parse-stdin.js";
import { generateSummary } from "./generate-session-summary.js";
import { evaluateAndApplyPatterns } from "./evaluate-patterns-shared.js";
import { appendDailyLog } from "./daily-log.js";
import { ensureDist } from "./ensure-dist.js";
import { logHookError } from "./hook-logger.js";

function estimateTokensFromTranscript(transcriptPath) {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
    const content = fs.readFileSync(transcriptPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);

    let inputChars = 0;
    let outputChars = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const role = entry.role ?? entry.type ?? "";
        const text =
          typeof entry.content === "string"
            ? entry.content
            : JSON.stringify(entry.content ?? "");

        if (role === "user" || role === "system") {
          inputChars += text.length;
        } else if (role === "assistant") {
          outputChars += text.length;
        }
      } catch {
        /* skip malformed lines */
      }
    }

    const codeChars = (content.match(/[{}\[\]();=]/g) ?? []).length;
    const codeRatio = content.length > 0 ? codeChars / content.length : 0;
    const charsPerToken = codeRatio > 0.05 ? 3.0 : 4.0;
    return {
      inputTokens: Math.ceil(inputChars / charsPerToken),
      outputTokens: Math.ceil(outputChars / charsPerToken),
    };
  } catch {
    return null;
  }
}

async function main() {
  const output = [];
  try {
    const input = parseStdin();
    const sid = input.session_id ?? "";
    const cwd = input.cwd ?? process.cwd();
    if (!sid) process.exit(0);

    const obsPath = path.join(os.tmpdir(), "kadmon", sid, "observations.jsonl");
    const filesModified = new Set();
    const toolsUsed = new Set();
    let messageCount = 0;

    if (fs.existsSync(obsPath)) {
      for (const line of fs
        .readFileSync(obsPath, "utf8")
        .split("\n")
        .filter(Boolean)) {
        try {
          const e = JSON.parse(line);
          if (e.eventType === "tool_pre") messageCount++;
          if (e.toolName) toolsUsed.add(e.toolName);
          if (e.filePath && ["Edit", "Write"].includes(e.toolName))
            filesModified.add(e.filePath);
        } catch {}
      }
    }

    // Auto-build dist/ if stale (prevents silent data loss)
    const rootDir = path.resolve(
      fileURLToPath(new URL(".", import.meta.url)),
      "..",
      "..",
      "..",
    );
    try {
      const buildResult = ensureDist(rootDir);
      if (buildResult.error) {
        logHookError("session-end-all", buildResult.error, {
          phase: "ensure-dist",
        });
      }
    } catch (buildErr) {
      logHookError("session-end-all", buildErr, { phase: "ensure-dist" });
    }

    // --- Phase 1: Persist session (was session-end-persist.js) ---
    const { summary, tasks: extractedTasks } = generateSummary(obsPath);

    let dbReady = false;
    try {
      const { openDb, insertCostEvent, upsertSession, getSession } =
        await import(
          new URL("../../../dist/scripts/lib/state-store.js", import.meta.url)
            .href
        );
      const { endSession } = await import(
        new URL("../../../dist/scripts/lib/session-manager.js", import.meta.url)
          .href
      );
      await openDb(process.env.KADMON_TEST_DB || undefined);
      dbReady = true;

      const result = endSession(sid, {
        filesModified: [...filesModified],
        toolsUsed: [...toolsUsed],
        messageCount,
        summary: summary || undefined,
        tasks: extractedTasks.length > 0 ? extractedTasks : undefined,
      });

      if (result) {
        output.push(
          `\u{2705} Session persisted: ${messageCount} tools, ${filesModified.size} files`,
        );
      } else {
        output.push(
          `\u{26A0}\u{FE0F} Session ${sid.slice(0, 8)} not found in DB`,
        );
      }

      // --- Phase 1b: Write daily log ---
      try {
        const memoryDir = path.join(
          os.homedir(),
          ".claude",
          "projects",
          "C--Command-Center-Kadmon-Harness",
          "memory",
        );
        let lastCommit = "";
        try {
          lastCommit = execFileSync("git", ["log", "--oneline", "-1"], {
            cwd,
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
          }).trim();
        } catch {}
        appendDailyLog(
          {
            sessionId: sid,
            summary: summary || "(session end — no summary)",
            tasks: extractedTasks,
            topFiles: [...filesModified]
              .slice(0, 5)
              .map((f) => path.basename(f)),
            commits: lastCommit ? [lastCommit] : [],
          },
          memoryDir,
        );
      } catch {
        /* never block session end for log failure */
      }

      // --- Phase 2: Evaluate patterns (was evaluate-session.js) ---
      try {
        const instinctsUpdated = await evaluateAndApplyPatterns(sid, cwd);
        if (instinctsUpdated > 0) {
          output.push(`\u{1F9E0} ${instinctsUpdated} instincts updated`);
        }
      } catch (evalErr) {
        logHookError("session-end-all", evalErr, { phase: "pattern-eval" });
        console.error(
          JSON.stringify({ warn: `session-end-all eval: ${evalErr.message}` }),
        );
      }

      // --- Phase 3: Track cost (was cost-tracker.js) ---
      try {
        let inputTokens =
          input.usage?.input_tokens ?? input.total_input_tokens ?? 0;
        let outputTokens =
          input.usage?.output_tokens ?? input.total_output_tokens ?? 0;
        let model = input.model ?? input.display_name ?? "opus";

        // Fallback 1: estimate from transcript
        if (!inputTokens && !outputTokens && input.transcript_path) {
          const estimate = estimateTokensFromTranscript(input.transcript_path);
          if (estimate) {
            inputTokens = estimate.inputTokens;
            outputTokens = estimate.outputTokens;
          }
        }

        // Fallback 2: estimate from observations
        if (!inputTokens && !outputTokens && fs.existsSync(obsPath)) {
          const lineCount = fs
            .readFileSync(obsPath, "utf8")
            .split("\n")
            .filter(Boolean).length;
          const toolCalls = Math.ceil(lineCount / 2);
          if (toolCalls > 0) {
            inputTokens = toolCalls * 1200;
            outputTokens = toolCalls * 600;
          }
        }

        if (inputTokens || outputTokens) {
          const { calculateCost, formatCost } = await import(
            new URL(
              "../../../dist/scripts/lib/cost-calculator.js",
              import.meta.url,
            ).href
          );

          const cost = calculateCost(model, inputTokens, outputTokens);
          insertCostEvent({
            sessionId: sid,
            timestamp: new Date().toISOString(),
            model,
            inputTokens,
            outputTokens,
            estimatedCostUsd: cost.totalCostUsd,
          });

          // Update session totals (re-read session to get latest after endSession)
          const session = getSession(sid);
          if (session) {
            upsertSession({
              ...session,
              id: sid,
              totalInputTokens: (session.totalInputTokens ?? 0) + inputTokens,
              totalOutputTokens:
                (session.totalOutputTokens ?? 0) + outputTokens,
              estimatedCostUsd:
                (session.estimatedCostUsd ?? 0) + cost.totalCostUsd,
            });
          }

          output.push(
            `\u{1F4B0} Cost: ${formatCost(cost.totalCostUsd)} (${model}: ${inputTokens} in, ${outputTokens} out)`,
          );
        }
      } catch (costErr) {
        logHookError("session-end-all", costErr, { phase: "cost-tracking" });
        console.error(
          JSON.stringify({ warn: `session-end-all cost: ${costErr.message}` }),
        );
      }
    } catch (dbErr) {
      logHookError("session-end-all", dbErr, { phase: "db-init" });
      console.error(
        JSON.stringify({ warn: `session-end-all db: ${dbErr.message}` }),
      );
    }

    // --- Phase 4: Write marker (was session-end-marker.js) ---
    try {
      const sessionDir = path.join(os.tmpdir(), "kadmon", sid);
      if (fs.existsSync(sessionDir)) {
        fs.writeFileSync(
          path.join(sessionDir, "clean-exit.marker"),
          JSON.stringify({
            sessionId: sid,
            exitedAt: new Date().toISOString(),
          }),
        );
      }
    } catch {}

    // --- Phase 5: Cleanup observations (from session-end-persist) ---
    try {
      const sessionDir = path.join(os.tmpdir(), "kadmon", sid);
      if (fs.existsSync(sessionDir) && messageCount >= 10) {
        for (const file of ["observations.jsonl", "tool_count.txt"]) {
          const filePath = path.join(sessionDir, file);
          try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          } catch {}
        }
      }
    } catch {}

    if (output.length > 0) {
      console.log(output.join(" | "));
    }
  } catch (err) {
    console.error(JSON.stringify({ error: `session-end-all: ${err.message}` }));
  }
  process.exit(0);
}
main();
