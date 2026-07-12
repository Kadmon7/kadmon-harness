#!/usr/bin/env node
// Hook: mcp-health-failure | Trigger: PostToolUseFailure (mcp__*)
// Purpose: Record MCP failure for health tracking
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseStdin } from "./parse-stdin.js";

// Append-only JSONL log. fs.appendFileSync is atomic (O_APPEND) and needs no
// prior read, so concurrent sessions/failures can never clobber each other's
// entries the way the old read-modify-write JSON file could (lost-update
// race: two near-simultaneous writes would read the same base state and the
// second writer's write would silently discard the first writer's update).
const MAX_LOG_LINES = 200; // target line count kept after rotation
// Rotate only once well past the cap (hysteresis) so the read-modify-write
// rotation step stays rare (~1-in-MAX_LOG_LINES calls) instead of firing on
// every single append once the file reaches steady state — trimming back to
// exactly MAX_LOG_LINES on every call would make every subsequent write a
// read-modify-write again, reintroducing the same race we're fixing.
const TRIM_THRESHOLD = MAX_LOG_LINES * 2;

try {
  const input = parseStdin();
  const healthFile = path.join(os.tmpdir(), "kadmon", "mcp-health.jsonl");
  const dir = path.dirname(healthFile);
  fs.mkdirSync(dir, { recursive: true });
  const parts = (input.tool_name ?? "").split("__");
  const server = parts.length >= 2 ? parts[1] : "unknown";
  const entry = { server, timestamp: new Date().toISOString() };
  fs.appendFileSync(healthFile, JSON.stringify(entry) + "\n");

  // Best-effort rotation to bound file growth. This is diagnostics data, not
  // critical data — if this step races with another process's concurrent
  // append (only reachable during the rare rotation window), we may lose at
  // most one line here, which is an acceptable trade for keeping the file
  // bounded and the read side (mcp-health-check, which runs on every MCP
  // tool call) fast.
  try {
    const lines = fs
      .readFileSync(healthFile, "utf8")
      .split("\n")
      .filter(Boolean);
    if (lines.length > TRIM_THRESHOLD) {
      fs.writeFileSync(
        healthFile,
        lines.slice(-MAX_LOG_LINES).join("\n") + "\n",
      );
    }
  } catch {
    /* rotation is best-effort; ignore failures */
  }
} catch (err) {
  console.error(
    JSON.stringify({
      error: `mcp-health-failure: ${err instanceof Error ? err.message : String(err)}`,
    }),
  );
}
process.exit(0);
