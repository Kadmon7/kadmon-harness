#!/usr/bin/env node
// Hook: observe-pre | Trigger: PreToolUse (*)
// Purpose: Append tool call metadata to observations JSONL. Target: <50ms
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseStdin } from "./parse-stdin.js";
import { scrubSecrets } from "./scrub-secrets.js";
import { safeSessionDir } from "./safe-session-dir.js";
try {
  const input = parseStdin();
  const sid = input.session_id ?? "";
  const dir = safeSessionDir(path.join(os.tmpdir(), "kadmon"), sid);
  if (!dir) process.exit(0);
  fs.mkdirSync(dir, { recursive: true });
  const toolName = input.tool_name ?? "";
  // Secret scrubbing + 200-char truncation — same semantics as observe-post
  // (AUD-02: a Bash call carrying a credential must never land in plaintext).
  const rawCommand = input.tool_input?.command ?? null;
  const metadata = {
    command: rawCommand ? scrubSecrets(String(rawCommand)).slice(0, 200) : null,
  };
  // Free-text fields are scrubbed too so the AUD-02 invariant ("no credential
  // ever lands in plaintext") holds for every persisted field, not just command.
  const scrubField = (v) => (v == null ? null : scrubSecrets(String(v)).slice(0, 200));
  if (toolName === "Agent") {
    metadata.agentType = input.tool_input?.subagent_type ?? null;
    metadata.agentDescription = scrubField(input.tool_input?.description);
  }
  if (toolName === "TaskCreate") {
    metadata.taskSubject = scrubField(input.tool_input?.subject);
    metadata.taskDescription = scrubField(input.tool_input?.description);
  }
  if (toolName === "TaskUpdate") {
    metadata.taskId = input.tool_input?.taskId ?? null;
    metadata.taskStatus = input.tool_input?.status ?? null;
    metadata.taskSubject = scrubField(input.tool_input?.subject);
  }
  if (toolName === "Skill") {
    metadata.skillName = input.tool_input?.skill ?? null;
  }
  const event = {
    timestamp: new Date().toISOString(),
    sessionId: sid,
    eventType: "tool_pre",
    toolName,
    filePath: input.tool_input?.file_path ?? input.tool_input?.path ?? null,
    // tool_use_id lets session-end-all correlate parallel Agent pre/post
    // events by unique invocation id instead of global LIFO (AUD-06).
    ...(input.tool_use_id ? { toolUseId: input.tool_use_id } : {}),
    metadata,
  };
  fs.appendFileSync(
    path.join(dir, "observations.jsonl"),
    JSON.stringify(event) + "\n",
  );
  fs.writeFileSync(path.join(dir, "last_pre_ts.txt"), String(Date.now()));
} catch (err) {
  console.error(JSON.stringify({ error: `observe-pre: ${err instanceof Error ? err.message : String(err)}` }));
}
process.exit(0);
