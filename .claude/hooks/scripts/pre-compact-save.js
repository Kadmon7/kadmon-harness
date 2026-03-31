#!/usr/bin/env node
// Hook: pre-compact-save | Trigger: PreCompact (*)
// Purpose: Save session state + evaluate instincts before context compaction
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseStdin } from "./parse-stdin.js";
import { evaluateAndApplyPatterns } from "./evaluate-patterns-shared.js";
import { generateSummary } from "./generate-session-summary.js";

async function main() {
  try {
    const input = parseStdin();
    const sid = input.session_id ?? "";
    if (!sid) process.exit(0);

    const obsPath = path.join(os.tmpdir(), "kadmon", sid, "observations.jsonl");
    let fileCount = 0;
    let toolCount = 0;
    let messageCount = 0;
    const filesModified = new Set();
    const toolsUsed = new Set();

    if (fs.existsSync(obsPath)) {
      const lines = fs
        .readFileSync(obsPath, "utf8")
        .split("\n")
        .filter(Boolean);
      toolCount = lines.length;
      const files = new Set();
      for (const line of lines) {
        try {
          const e = JSON.parse(line);
          if (e.eventType === "tool_pre") messageCount++;
          if (e.toolName) toolsUsed.add(e.toolName);
          if (e.filePath && ["Edit", "Write"].includes(e.toolName))
            filesModified.add(e.filePath);
          if (e.filePath) files.add(e.filePath);
        } catch {}
      }
      fileCount = files.size;
    }

    // Generate summary from observations (best-effort)
    let summary;
    let tasks = [];
    try {
      const result = generateSummary(obsPath);
      if (result.summary) summary = result.summary;
      if (result.tasks.length > 0) tasks = result.tasks;
    } catch (sumErr) {
      console.error(
        JSON.stringify({ warn: `pre-compact-save summary: ${sumErr.message}` }),
      );
    }

    try {
      const { openDb, upsertSession, getSession } = await import(
        new URL("../../../dist/scripts/lib/state-store.js", import.meta.url)
          .href
      );
      const { endSession } = await import(
        new URL("../../../dist/scripts/lib/session-manager.js", import.meta.url)
          .href
      );
      await openDb(process.env.KADMON_TEST_DB || undefined);
      const session = getSession(sid);
      if (session) {
        // First update compaction count and session data
        upsertSession({
          ...session,
          id: sid,
          compactionCount: (session.compactionCount ?? 0) + 1,
          messageCount: Math.max(session.messageCount ?? 0, messageCount),
          filesModified:
            filesModified.size > 0 ? [...filesModified] : session.filesModified,
          toolsUsed: toolsUsed.size > 0 ? [...toolsUsed] : session.toolsUsed,
          summary: summary ?? session.summary,
          tasks: tasks.length > 0 ? tasks : session.tasks,
        });
        // Then close the session cleanly — next session-start won't find an orphan
        endSession(sid, {});
      }
    } catch (dbErr) {
      console.error(
        JSON.stringify({ warn: `pre-compact-save db: ${dbErr.message}` }),
      );
    }

    // Evaluate patterns using shared logic
    let instinctsUpdated = 0;
    try {
      const cwd = input.cwd ?? process.cwd();
      instinctsUpdated = await evaluateAndApplyPatterns(sid, cwd);
    } catch (evalErr) {
      console.error(
        JSON.stringify({ warn: `pre-compact-save eval: ${evalErr.message}` }),
      );
    }

    // Reset tool count after compaction
    const countFile = path.join(os.tmpdir(), "kadmon", sid, "tool_count.txt");
    try {
      fs.writeFileSync(countFile, "0");
    } catch {}

    // Write instinct count for status line
    if (instinctsUpdated > 0) {
      try {
        const icFile = path.join(
          os.tmpdir(),
          "kadmon",
          sid,
          "instinct_count.txt",
        );
        let prev = 0;
        try {
          prev = parseInt(fs.readFileSync(icFile, "utf8"), 10) || 0;
        } catch {}
        fs.writeFileSync(icFile, String(prev + instinctsUpdated));
      } catch {}
    }

    const instinctMsg =
      instinctsUpdated > 0
        ? ` | \u{1F9E0} ${instinctsUpdated} instincts updated`
        : "";
    console.log(
      `\u{1F4E6} Session state saved before compaction (${toolCount} tool calls, ${fileCount} files${instinctMsg})`,
    );
  } catch (err) {
    console.error(
      JSON.stringify({ error: `pre-compact-save: ${err.message}` }),
    );
  }
  process.exit(0);
}
main();
