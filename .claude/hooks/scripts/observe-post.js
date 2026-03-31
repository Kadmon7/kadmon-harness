#!/usr/bin/env node
// Hook: observe-post | Trigger: PostToolUse (*)
// Purpose: Append tool result metadata to observations JSONL. Target: <50ms
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseStdin } from "./parse-stdin.js";
try {
  const input = parseStdin();
  const sid = input.session_id ?? "";
  if (!sid) process.exit(0);
  const dir = path.join(os.tmpdir(), "kadmon", sid);
  fs.mkdirSync(dir, { recursive: true });
  const toolError = input.tool_error ?? null;
  const event = {
    timestamp: new Date().toISOString(),
    sessionId: sid,
    eventType: "tool_post",
    toolName: input.tool_name ?? "",
    filePath: input.tool_input?.file_path ?? input.tool_input?.path ?? null,
    success: !toolError,
    ...(toolError ? { error: String(toolError).slice(0, 200) } : {}),
  };
  fs.appendFileSync(
    path.join(dir, "observations.jsonl"),
    JSON.stringify(event) + "\n",
  );
  const tcFile = path.join(dir, "tool_count.txt");
  let count = 0;
  try {
    count = parseInt(fs.readFileSync(tcFile, "utf8").trim(), 10) || 0;
  } catch {}
  fs.writeFileSync(tcFile, String(count + 1));
} catch (err) {
  console.error(JSON.stringify({ error: `observe-post: ${err.message}` }));
}
process.exit(0);
