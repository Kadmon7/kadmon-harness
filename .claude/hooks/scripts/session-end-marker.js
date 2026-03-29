#!/usr/bin/env node
// Hook: session-end-marker | Trigger: Stop (*)
// Purpose: Write marker file indicating session ended cleanly.
// If the marker is missing at next session start, it means a crash/Ctrl+C occurred.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseStdin } from "./parse-stdin.js";

try {
  const input = parseStdin();
  const sid = input.session_id ?? "";
  if (!sid) process.exit(0);

  const sessionDir = path.join(os.tmpdir(), "kadmon", sid);
  if (fs.existsSync(sessionDir)) {
    fs.writeFileSync(
      path.join(sessionDir, "clean-exit.marker"),
      JSON.stringify({ sessionId: sid, exitedAt: new Date().toISOString() }),
    );
  }
} catch (err) {
  console.error(
    JSON.stringify({ error: `session-end-marker: ${err.message}` }),
  );
}
process.exit(0);
