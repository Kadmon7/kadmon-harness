#!/usr/bin/env node
// Hook: observe-post | Trigger: PostToolUse (*)
// Purpose: Append tool result metadata to observations JSONL. Target: <50ms
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseStdin } from "./parse-stdin.js";
import { scrubSecrets } from "./scrub-secrets.js";
try {
  const input = parseStdin();
  const sid = input.session_id ?? "";
  if (!sid || !/^[a-zA-Z0-9_-]+$/.test(sid)) process.exit(0);
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
  // Secret scrubbing via shared scrub-secrets.js (AUD-02 — same redaction
  // rules as observe-pre). Bash metadata with secret scrubbing:
  const command = input.tool_input?.command ?? null;
  let resultSnippet = null;
  if (input.tool_name === "Bash" && input.tool_result) {
    // Scrub BEFORE slicing — truncating first can split a token at the
    // boundary and defeat the anchored redaction regexes (spektr LOW).
    resultSnippet = scrubSecrets(String(input.tool_result)).slice(0, 100);
  }
  const scrubbedError = toolError
    ? scrubSecrets(String(toolError)).slice(0, 200)
    : null;
  const scrubbedCommand = command
    ? scrubSecrets(String(command)).slice(0, 200)
    : null;
  // Agent posts carry agentType so session-end-all can pair parallel agents
  // by type instead of global LIFO (AUD-06).
  const isAgent = input.tool_name === "Agent";
  const hasMeta = scrubbedCommand || resultSnippet || isAgent;
  const event = {
    timestamp: new Date().toISOString(),
    sessionId: sid,
    eventType: "tool_post",
    toolName: input.tool_name ?? "",
    filePath: input.tool_input?.file_path ?? input.tool_input?.path ?? null,
    success: !toolError,
    ...(input.tool_use_id ? { toolUseId: input.tool_use_id } : {}),
    ...(scrubbedError ? { error: scrubbedError } : {}),
    ...(durationMs !== null ? { durationMs } : {}),
    ...(hasMeta
      ? {
          metadata: {
            ...(scrubbedCommand ? { command: scrubbedCommand } : {}),
            ...(resultSnippet ? { resultSnippet } : {}),
            ...(isAgent
              ? { agentType: input.tool_input?.subagent_type ?? null }
              : {}),
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
  console.error(JSON.stringify({ error: `observe-post: ${err instanceof Error ? err.message : String(err)}` }));
}
process.exit(0);
