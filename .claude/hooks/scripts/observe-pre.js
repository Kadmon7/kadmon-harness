#!/usr/bin/env node
// Hook: observe-pre | Trigger: PreToolUse (*)
// Purpose: Append tool call metadata to observations JSONL. Target: <50ms
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
  const toolName = input.tool_name ?? "";
  const metadata = { command: input.tool_input?.command ?? null };
  if (toolName === "Agent") {
    metadata.agentType = input.tool_input?.subagent_type ?? null;
    metadata.agentDescription = input.tool_input?.description ?? null;
  }
  const event = {
    timestamp: new Date().toISOString(),
    sessionId: sid,
    eventType: "tool_pre",
    toolName,
    filePath: input.tool_input?.file_path ?? input.tool_input?.path ?? null,
    metadata,
  };
  fs.appendFileSync(
    path.join(dir, "observations.jsonl"),
    JSON.stringify(event) + "\n",
  );
} catch (err) {
  console.error(JSON.stringify({ error: `observe-pre: ${err.message}` }));
}
process.exit(0);
