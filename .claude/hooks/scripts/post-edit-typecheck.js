#!/usr/bin/env node
// Hook: post-edit-typecheck | Trigger: PostToolUse (Edit|Write)
// Purpose: Run a typechecker after code edits
//   .ts/.tsx       → tsc --noEmit (project-level)
//   .py            → mypy <file> → pyright <file> → python -m py_compile <file> (first available)
//   other          → exit 0 silently
// Always exits 0 — typecheck errors are informational only (plan-020 Phase B).
import path from "node:path";
import { execSync, execFileSync } from "node:child_process";
import { parseStdin, isDisabled } from "./parse-stdin.js";

const TS_EXTS = new Set([".ts", ".tsx"]);
const PY_EXTS = new Set([".py"]);
const PY_TOOLS = ["mypy", "pyright", "python"];

function toolAvailable(cmd) {
  try {
    const probe = process.platform === "win32" ? "where" : "which";
    execFileSync(probe, [cmd], { stdio: ["ignore", "pipe", "pipe"], timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function runTsc() {
  try {
    execSync("npx tsc --noEmit --skipLibCheck", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15000,
    });
  } catch (tscErr) {
    if (tscErr.stdout) console.error(`\u{1F534} TypeScript errors:\n${tscErr.stdout}`);
    if (tscErr.stderr) console.error(tscErr.stderr);
  }
}

function runPyTool(label, cmd, args, timeoutMs) {
  console.error(`post-edit-typecheck: running ${label} on ${args[args.length - 1]}`);
  try {
    execFileSync(cmd, args, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: timeoutMs,
    });
    console.error(`\u{2713} ${label} clean`);
  } catch (err) {
    if (err.stdout) console.error(`\u{1F534} ${label}:\n${err.stdout}`);
    if (err.stderr) console.error(`\u{1F534} ${label}:\n${err.stderr}`);
  }
}

function runPythonCheck(fp) {
  // Harden against flag-injection: resolve to absolute path so tools treat it as a file
  // argument even when the relative path would start with a dash.
  const safeFp = path.isAbsolute(fp) ? fp : path.resolve(fp);
  if (toolAvailable("mypy")) {
    runPyTool("mypy", "mypy", [safeFp], 15000);
    return;
  }
  if (toolAvailable("pyright")) {
    runPyTool("pyright", "pyright", [safeFp], 15000);
    return;
  }
  if (toolAvailable("python")) {
    runPyTool("python py_compile", "python", ["-m", "py_compile", safeFp], 10000);
    return;
  }
  console.error(
    `\u{26A0} post-edit-typecheck: no Python typechecker found (tried ${PY_TOOLS.join(", ")}); skipping ${safeFp}`,
  );
}

try {
  if (isDisabled("post-edit-typecheck")) process.exit(0);
  const input = parseStdin();
  const fp = input.tool_input?.file_path ?? "";
  if (!fp) process.exit(0);
  if (fp.includes("node_modules") || fp.includes("dist")) process.exit(0);
  const ext = path.extname(fp);
  if (TS_EXTS.has(ext)) {
    runTsc();
  } else if (PY_EXTS.has(ext)) {
    runPythonCheck(fp);
  }
} catch (err) {
  console.error(
    JSON.stringify({
      error: `post-edit-typecheck: ${err instanceof Error ? err.message : String(err)}`,
    }),
  );
}
process.exit(0);
