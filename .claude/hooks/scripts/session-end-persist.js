#!/usr/bin/env node
// Hook: session-end-persist | Trigger: Stop (*)
// Purpose: Persist final session summary to SQLite
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

    try {
      const { openDb } = await import(
        new URL("../../../dist/scripts/lib/state-store.js", import.meta.url)
          .href
      );
      const { endSession } = await import(
        new URL("../../../dist/scripts/lib/session-manager.js", import.meta.url)
          .href
      );
      await openDb(process.env.KADMON_TEST_DB || undefined);
      const result = endSession(sid, {
        filesModified: [...filesModified],
        toolsUsed: [...toolsUsed],
        messageCount,
      });
      if (result) {
        console.log(
          `\u{2705} Session persisted: ${messageCount} tools, ${filesModified.size} files`,
        );
      } else {
        console.error(
          JSON.stringify({
            warn: `session-end-persist: endSession returned null for ${sid} — data may be lost`,
          }),
        );
      }
    } catch (dbErr) {
      console.error(
        JSON.stringify({ warn: `session-end-persist db: ${dbErr.message}` }),
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({ error: `session-end-persist: ${err.message}` }),
    );
  }
  process.exit(0);
}
main();
