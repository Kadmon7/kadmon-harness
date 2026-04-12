#!/usr/bin/env node
// Hook: quality-gate | Trigger: PostToolUse (Edit|Write)
// Purpose: Run ESLint on edited TS/JS files
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseStdin, isDisabled } from "./parse-stdin.js";
try {
  if (isDisabled("quality-gate")) process.exit(0);
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
    execFileSync(
      "npx",
      ["eslint", "--no-eslintrc", "--rule", "no-unused-vars:warn", fp],
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 10000,
      },
    );
  } catch (lintErr) {
    if (lintErr.stdout) console.error(`\u{1F4CF} ESLint:\n${lintErr.stdout}`);
  }
} catch (err) {
  console.error(
    JSON.stringify({
      error: `quality-gate: ${err instanceof Error ? err.message : String(err)}`,
    }),
  );
}
process.exit(0);
