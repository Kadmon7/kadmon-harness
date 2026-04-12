#!/usr/bin/env node
// Hook: post-edit-format | Trigger: PostToolUse (Edit|Write)
// Purpose: Auto-format TS/JS/JSON files with Prettier
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseStdin, isDisabled } from "./parse-stdin.js";
try {
  if (isDisabled("post-edit-format")) process.exit(0);
  const input = parseStdin();
  const fp = input.tool_input?.file_path ?? "";
  if (!fp) process.exit(0);
  const ext = path.extname(fp);
  if (![".ts", ".js", ".json"].includes(ext)) process.exit(0);
  if (fp.includes("node_modules") || fp.includes("dist")) process.exit(0);
  if (!fs.existsSync(fp)) process.exit(0);
  try {
    execFileSync("npx", ["prettier", "--write", fp], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    /* prettier not installed or failed — non-blocking */
  }
} catch (err) {
  console.error(JSON.stringify({ error: `post-edit-format: ${err instanceof Error ? err.message : String(err)}` }));
}
process.exit(0);
