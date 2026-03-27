#!/usr/bin/env node
// Hook: quality-gate | Trigger: PostToolUse (Edit|Write)
// Purpose: Run ESLint on edited TS/JS files
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { parseStdin } from "./parse-stdin.js";
try {
  const input = parseStdin();
  const fp = input.tool_input?.file_path ?? "";
  if (!fp) process.exit(0);
  const ext = path.extname(fp);
  if (![".ts", ".js"].includes(ext)) process.exit(0);
  if (
    fp.includes("node_modules") ||
    fp.includes("dist") ||
    fp.includes(".claude")
  )
    process.exit(0);
  try {
    execSync(`npx eslint --no-eslintrc --rule "no-unused-vars:warn" "${fp}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (lintErr) {
    if (lintErr.stdout) console.log(`\u{1F4CF} ESLint:\n${lintErr.stdout}`);
  }
} catch (err) {
  console.error(JSON.stringify({ error: `quality-gate: ${err.message}` }));
}
process.exit(0);
