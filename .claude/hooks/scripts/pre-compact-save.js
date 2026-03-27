#!/usr/bin/env node
// Hook: pre-compact-save | Trigger: PreCompact (*)
// Purpose: Save session state + evaluate instincts before context compaction
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { parseStdin } from "./parse-stdin.js";

async function main() {
  try {
    const input = parseStdin();
    const sid = input.session_id ?? "";
    if (!sid) process.exit(0);

    const obsPath = path.join(os.tmpdir(), "kadmon", sid, "observations.jsonl");
    let fileCount = 0;
    let toolCount = 0;

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
          if (e.filePath) files.add(e.filePath);
        } catch {}
      }
      fileCount = files.size;
    }

    try {
      const { openDb, upsertSession, getSession } = await import(
        new URL("../../../dist/scripts/lib/state-store.js", import.meta.url)
          .href
      );
      await openDb(process.env.KADMON_TEST_DB || undefined);
      const session = getSession(sid);
      if (session) {
        upsertSession({
          ...session,
          id: sid,
          compactionCount: (session.compactionCount ?? 0) + 1,
        });
      }
    } catch (dbErr) {
      console.error(
        JSON.stringify({ warn: `pre-compact-save db: ${dbErr.message}` }),
      );
    }

    // Evaluate patterns and create/reinforce instincts (same as evaluate-session)
    let instinctsUpdated = 0;
    try {
      const obsPath2 = path.join(
        os.tmpdir(),
        "kadmon",
        sid,
        "observations.jsonl",
      );
      if (fs.existsSync(obsPath2)) {
        const obsLines = fs
          .readFileSync(obsPath2, "utf8")
          .split("\n")
          .filter(Boolean);
        if (obsLines.length >= 10) {
          const cwd = input.cwd ?? process.cwd();
          function gitExec(cmd) {
            try {
              return execSync(cmd, {
                cwd,
                encoding: "utf8",
                stdio: ["pipe", "pipe", "pipe"],
              }).trim();
            } catch {
              return null;
            }
          }
          const remoteUrl = gitExec("git remote get-url origin");
          if (remoteUrl) {
            const projectHash = crypto
              .createHash("sha256")
              .update(remoteUrl)
              .digest("hex")
              .slice(0, 16);
            const toolSequences = [];
            for (const line of obsLines) {
              try {
                const e = JSON.parse(line);
                if (e.eventType === "tool_pre") toolSequences.push(e.toolName);
              } catch {}
            }

            const { getActiveInstincts } = await import(
              new URL(
                "../../../dist/scripts/lib/state-store.js",
                import.meta.url,
              ).href
            );
            const { createInstinct, reinforceInstinct } = await import(
              new URL(
                "../../../dist/scripts/lib/instinct-manager.js",
                import.meta.url,
              ).href
            );
            const { evaluatePatterns, loadPatternDefinitions } = await import(
              new URL(
                "../../../dist/scripts/lib/pattern-engine.js",
                import.meta.url,
              ).href
            );

            const defsPath = new URL(
              "../pattern-definitions.json",
              import.meta.url,
            );
            const definitions = loadPatternDefinitions(
              defsPath.pathname.replace(/^\/([A-Z]:)/, "$1"),
            );
            const results = evaluatePatterns(
              definitions,
              toolSequences,
              obsLines,
            );

            const existing = getActiveInstincts(projectHash);
            const existingPatterns = new Map(
              existing.map((i) => [i.pattern, i]),
            );

            for (const r of results) {
              if (r.triggered) {
                if (existingPatterns.has(r.name)) {
                  reinforceInstinct(existingPatterns.get(r.name).id, sid);
                } else {
                  createInstinct(projectHash, r.name, r.action, sid);
                }
                instinctsUpdated++;
              }
            }
          }
        }
      }
    } catch (evalErr) {
      console.error(
        JSON.stringify({ warn: `pre-compact-save eval: ${evalErr.message}` }),
      );
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
