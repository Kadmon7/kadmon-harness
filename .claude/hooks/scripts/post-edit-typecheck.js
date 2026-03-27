#!/usr/bin/env node
// Hook: post-edit-typecheck | Trigger: PostToolUse (Edit|Write)
// Purpose: Run tsc --noEmit after .ts edits
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { parseStdin } from "./parse-stdin.js";
try {
  const input = parseStdin();
  const fp = input.tool_input?.file_path ?? "";
  if (!fp || path.extname(fp) !== ".ts") process.exit(0);
  if (fp.includes("node_modules") || fp.includes("dist")) process.exit(0);
  try {
    execSync("npx tsc --noEmit --skipLibCheck", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (tscErr) {
    if (tscErr.stdout)
      console.log(`\u{1F534} TypeScript errors:\n${tscErr.stdout}`);
    if (tscErr.stderr) console.log(tscErr.stderr);
  }
} catch (err) {
  console.error(
    JSON.stringify({ error: `post-edit-typecheck: ${err.message}` }),
  );
}
process.exit(0);
