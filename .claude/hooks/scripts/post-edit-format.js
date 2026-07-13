#!/usr/bin/env node
// Hook: post-edit-format | Trigger: PostToolUse (Edit|Write)
// Purpose: Auto-format TS/JS/JSON files with Prettier
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseStdin, isDisabled } from "./parse-stdin.js";
import { resolveBin } from "./resolve-bin.js";

// AUD-31: prefer a direct `node <entry>` invocation of the locally-installed
// `prettier` package (resolved via resolve-bin.js) — skips npx's per-call
// re-resolution AND avoids a Windows-only footgun where the .bin/prettier.cmd
// shim can't be spawned safely without shell:true (see resolve-bin.js
// header comment). Falls back to the original `npx prettier` invocation,
// unchanged, when no local install resolves.
function runPrettier(fp) {
  // AUD-36: harden against flag-injection the same way runRuff/runEslint do —
  // resolve to an absolute path so a relative filename that starts with a
  // dash can't be misread by the tool's CLI arg parser as a flag.
  const safeFp = path.isAbsolute(fp) ? fp : path.resolve(fp);
  const prettierEntry = resolveBin("prettier");
  try {
    if (prettierEntry) {
      execFileSync(process.execPath, [prettierEntry, "--write", safeFp], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } else {
      execFileSync("npx", ["prettier", "--write", safeFp], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    }
  } catch {
    /* prettier not installed or failed — non-blocking */
  }
}

try {
  if (isDisabled("post-edit-format")) process.exit(0);
  const input = parseStdin();
  const fp = input.tool_input?.file_path ?? "";
  if (!fp) process.exit(0);
  const ext = path.extname(fp);
  if (![".ts", ".tsx", ".js", ".jsx", ".json"].includes(ext)) process.exit(0);
  if (fp.includes("node_modules") || fp.includes("dist")) process.exit(0);
  if (!fs.existsSync(fp)) process.exit(0);
  runPrettier(fp);
} catch (err) {
  console.error(JSON.stringify({ error: `post-edit-format: ${err instanceof Error ? err.message : String(err)}` }));
}
process.exit(0);
