#!/usr/bin/env node
// Hook: evaluate-session | Trigger: Stop (*)
// Purpose: Extract patterns from session and create/update instincts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseStdin } from "./parse-stdin.js";
import { evaluateAndApplyPatterns } from "./evaluate-patterns-shared.js";

async function main() {
  try {
    const input = parseStdin();
    const sid = input.session_id ?? "";
    const cwd = input.cwd ?? process.cwd();
    if (!sid) process.exit(0);

    let instinctsUpdated = 0;
    try {
      const { openDb } = await import(
        new URL("../../../dist/scripts/lib/state-store.js", import.meta.url)
          .href
      );
      await openDb(process.env.KADMON_TEST_DB || undefined);
      instinctsUpdated = await evaluateAndApplyPatterns(sid, cwd);
    } catch (dbErr) {
      console.error(
        JSON.stringify({ warn: `evaluate-session db: ${dbErr.message}` }),
      );
    }

    // Sync instincts to Auto Memory for cross-session persistence
    try {
      const { syncInstinctsToMemory } = await import(
        new URL(
          "../../../dist/scripts/sync-instincts-to-memory.js",
          import.meta.url,
        ).href
      );
      const { synced } = await syncInstinctsToMemory(cwd);
      if (synced > 0) {
        console.log(`\u{1F4BE} Synced ${synced} instinct(s) to Auto Memory`);
      }
    } catch (syncErr) {
      console.error(
        JSON.stringify({ warn: `evaluate-session sync: ${syncErr.message}` }),
      );
    }

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
      console.log(
        `\u{1F9E0} Session evaluated: ${instinctsUpdated} instincts updated`,
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({ error: `evaluate-session: ${err.message}` }),
    );
  }
  process.exit(0);
}
main();
