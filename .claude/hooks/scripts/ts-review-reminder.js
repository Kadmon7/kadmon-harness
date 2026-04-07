#!/usr/bin/env node
// Hook: ts-review-reminder | Trigger: PostToolUse (Edit|Write)
// Purpose: Warn after 5+ .ts edits without code review. Exit 1 as warning.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseStdin, isDisabled } from "./parse-stdin.js";

const TS_THRESHOLD = 5;
const REVIEWER_TYPES = ["kody", "typescript-reviewer"];

try {
  if (isDisabled("ts-review-reminder")) process.exit(0);
  const input = parseStdin();
  const filePath = input.tool_input?.file_path ?? "";

  // Only care about .ts/.tsx files
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) process.exit(0);

  const sid = input.session_id ?? "";
  if (!sid) process.exit(0);

  const obsFile = path.join(os.tmpdir(), "kadmon", sid, "observations.jsonl");
  if (!fs.existsSync(obsFile)) process.exit(0);

  const lines = fs.readFileSync(obsFile, "utf8").split("\n").filter(Boolean);
  let tsEditCount = 0;
  let hasReview = false;

  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      const tn = e.toolName || e.tool_name || "";
      const fp = e.filePath || e.file_path || "";

      if (
        (tn === "Edit" || tn === "Write") &&
        (fp.endsWith(".ts") || fp.endsWith(".tsx"))
      ) {
        tsEditCount++;
      }
      if (
        tn === "Agent" &&
        e.metadata?.agentType &&
        REVIEWER_TYPES.includes(e.metadata.agentType)
      ) {
        hasReview = true;
      }
    } catch {
      /* skip malformed */
    }
  }

  if (tsEditCount >= TS_THRESHOLD && !hasReview) {
    console.log(
      `\u{1F50D} ${tsEditCount} .ts edits without review. Consider /chekpoint`,
    );
    process.exit(1);
  }
} catch (err) {
  console.error(
    JSON.stringify({ error: `ts-review-reminder: ${err.message}` }),
  );
}
process.exit(0);
