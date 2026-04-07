#!/usr/bin/env node
// Hook: no-context-guard | Trigger: PreToolUse (Edit|Write)
// Purpose: Enforce no_context — block Write/Edit without prior research
// Override: KADMON_NO_CONTEXT_GUARD=off
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseStdin, wasTruncated } from "./parse-stdin.js";
import { logHookEvent } from "./log-hook-event.js";
const EXEMPT_EXT = [".test.ts", ".spec.ts", ".md", ".json"];
function isExempt(fp) {
  if (!fp) return true;
  if (EXEMPT_EXT.some((e) => fp.endsWith(e))) return true;
  const b = path.basename(fp);
  if (b === "package.json" || b === "tsconfig.json") return true;
  return false;
}
function getResearched(obsPath) {
  const paths = new Set(),
    dirs = new Set();
  if (!fs.existsSync(obsPath)) return { paths, dirs };
  for (const line of fs
    .readFileSync(obsPath, "utf8")
    .split("\n")
    .filter(Boolean)) {
    try {
      const e = JSON.parse(line);
      const tn = e.toolName || e.tool_name;
      if (["Read", "Grep", "Glob"].includes(tn)) {
        const fp = e.filePath || e.file_path;
        if (fp) {
          paths.add(fp);
          dirs.add(path.dirname(fp));
        }
      }
    } catch {}
  }
  return { paths, dirs };
}
try {
  if (process.env.KADMON_NO_CONTEXT_GUARD === "off") process.exit(0);
  const input = parseStdin();
  if (wasTruncated(input)) {
    logHookEvent(input.session_id, {
      hookName: "no-context-guard",
      eventType: "pre_tool",
      toolName: input.tool_name,
      exitCode: 2,
      blocked: true,
      error: "stdin truncated",
    });
    console.error(
      JSON.stringify({
        block: true,
        message:
          "\u{1F6AB} no-context-guard: stdin truncated — cannot verify prior Read",
      }),
    );
    process.exit(2);
  }
  const target = input.tool_input?.file_path ?? "";
  if (!target || isExempt(target)) process.exit(0);
  const sid = input.session_id ?? "";
  if (!sid) process.exit(0);
  const obsPath = path.join(os.tmpdir(), "kadmon", sid, "observations.jsonl");
  if (!fs.existsSync(obsPath)) process.exit(0);
  const { paths, dirs } = getResearched(obsPath);
  if (paths.has(target) || dirs.has(path.dirname(target))) process.exit(0);
  logHookEvent(input.session_id, {
    hookName: "no-context-guard",
    eventType: "pre_tool",
    toolName: input.tool_name,
    exitCode: 2,
    blocked: true,
    error: `no_context: ${target}`,
  });
  console.error(
    JSON.stringify({
      block: true,
      message: `\u{1F6AB} no_context: Read "${target}" or files in its directory before editing it.`,
    }),
  );
  process.exit(2);
} catch (err) {
  console.error(JSON.stringify({ error: `no-context-guard: ${err.message}` }));
  process.exit(0);
}
