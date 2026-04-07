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
  // Duration: read pre-event timestamp for tool execution time
  let durationMs = null;
  const tsFile = path.join(dir, "last_pre_ts.txt");
  try {
    const preTs = parseInt(fs.readFileSync(tsFile, "utf8").trim(), 10);
    if (preTs > 0) durationMs = Date.now() - preTs;
  } catch {}
  // Bash metadata with secret scrubbing
  const command = input.tool_input?.command ?? null;
  let resultSnippet = null;
  if (input.tool_name === "Bash" && input.tool_result) {
    resultSnippet = String(input.tool_result)
      .slice(0, 100)
      .replace(/(?:sk|pk)[-_](?:live|test)[-_][A-Za-z0-9]{20,}/g, "[REDACTED]")
      .replace(/ghp_[A-Za-z0-9]{36,}/g, "[REDACTED]")
      .replace(/xox[bpas]-[A-Za-z0-9-]{10,}/g, "[REDACTED]")
      .replace(
        /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^\s"',]{8,}/gi,
        "[REDACTED]",
      );
  }
  const hasMeta = command || resultSnippet;
  const event = {
    timestamp: new Date().toISOString(),
    sessionId: sid,
    eventType: "tool_post",
    toolName: input.tool_name ?? "",
    filePath: input.tool_input?.file_path ?? input.tool_input?.path ?? null,
    success: !toolError,
    ...(toolError ? { error: String(toolError).slice(0, 200) } : {}),
    ...(durationMs !== null ? { durationMs } : {}),
    ...(hasMeta
      ? {
          metadata: {
            ...(command ? { command: String(command).slice(0, 200) } : {}),
            ...(resultSnippet ? { resultSnippet } : {}),
          },
        }
      : {}),
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
