#!/usr/bin/env node
// Hook: pre-compact-save | Trigger: PreCompact (*)
// Purpose: Save session state snapshot before context compaction
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

    console.log(
      `\u{1F4E6} Session state saved before compaction (${toolCount} tool calls, ${fileCount} files)`,
    );
  } catch (err) {
    console.error(
      JSON.stringify({ error: `pre-compact-save: ${err.message}` }),
    );
  }
  process.exit(0);
}
main();
