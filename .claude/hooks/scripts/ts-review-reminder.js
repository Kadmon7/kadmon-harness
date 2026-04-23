#!/usr/bin/env node
// Hook: ts-review-reminder | Trigger: PostToolUse (Edit|Write)
// Purpose: Warn after 10+ code edits (.ts/.tsx/.py) without code review. Exit 1 as warning.
// File name kept for settings.json compatibility; counter is language-agnostic since plan-020 Phase B.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseStdin, isDisabled } from "./parse-stdin.js";
import { logHookEvent } from "./log-hook-event.js";

const EDIT_THRESHOLD = 10;
const CODE_EXTS = new Set([".ts", ".tsx", ".py"]);
const REVIEWER_TYPES = ["kody", "typescript-reviewer", "python-reviewer"];

function hasCodeExt(fp) {
  const ext = path.extname(fp);
  return CODE_EXTS.has(ext);
}

try {
  if (isDisabled("ts-review-reminder")) process.exit(0);
  const start = Date.now();
  const input = parseStdin();
  const filePath = input.tool_input?.file_path ?? "";

  // Only care about reviewable code files
  if (!hasCodeExt(filePath)) process.exit(0);

  const sid = input.session_id ?? "";
  if (!sid) process.exit(0);

  const obsFile = path.join(os.tmpdir(), "kadmon", sid, "observations.jsonl");
  if (!fs.existsSync(obsFile)) process.exit(0);

  const lines = fs.readFileSync(obsFile, "utf8").split("\n").filter(Boolean);
  let editCount = 0;
  let hasReview = false;

  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      const tn = e.toolName || e.tool_name || "";
      const fp = e.filePath || e.file_path || "";

      if ((tn === "Edit" || tn === "Write") && hasCodeExt(fp)) {
        editCount++;
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

  if (editCount >= EDIT_THRESHOLD && !hasReview) {
    logHookEvent(sid, {
      hookName: "ts-review-reminder",
      eventType: "post_tool",
      toolName: "Edit",
      exitCode: 1,
      blocked: false,
      durationMs: Date.now() - start,
      error: `${editCount} code edits without review`,
    });
    console.error(
      `\u{1F50D} ${editCount} code edits without review. Consider /chekpoint`,
    );
    process.exit(1);
  }
} catch (err) {
  console.error(
    JSON.stringify({ error: `ts-review-reminder: ${err instanceof Error ? err.message : String(err)}` }),
  );
}
process.exit(0);
