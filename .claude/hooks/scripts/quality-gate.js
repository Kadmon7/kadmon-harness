#!/usr/bin/env node
// Hook: quality-gate | Trigger: PostToolUse (Edit|Write)
// Purpose: Run a linter on edited code files
//   .ts/.tsx/.js/.jsx → ESLint (project rules)
//   .py               → ruff check <file> (warn if ruff not installed)
//   other             → exit 0 silently
// Always exits 0 — lint output is informational (plan-020 Phase B).
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseStdin, isDisabled } from "./parse-stdin.js";

const TS_JS_EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const PY_EXTS = new Set([".py"]);

function toolAvailable(cmd) {
  try {
    const probe = process.platform === "win32" ? "where" : "which";
    execFileSync(probe, [cmd], { stdio: ["ignore", "pipe", "pipe"], timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function runEslint(fp) {
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
}

function runRuff(fp) {
  // Harden against flag-injection: resolve to absolute path so ruff treats the arg
  // as a file even when the relative path would start with a dash.
  const safeFp = path.isAbsolute(fp) ? fp : path.resolve(fp);
  console.error(`quality-gate: running ruff on ${safeFp}`);
  if (!toolAvailable("ruff")) {
    console.error(`\u{26A0} quality-gate: ruff not installed; skipping ${safeFp}`);
    return;
  }
  try {
    execFileSync("ruff", ["check", safeFp], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    });
  } catch (lintErr) {
    if (lintErr.stdout) console.error(`\u{1F4CF} ruff:\n${lintErr.stdout}`);
    if (lintErr.stderr) console.error(`\u{1F4CF} ruff:\n${lintErr.stderr}`);
  }
}

try {
  if (isDisabled("quality-gate")) process.exit(0);
  const input = parseStdin();
  const fp = input.tool_input?.file_path ?? "";
  if (!fp) process.exit(0);
  const ext = path.extname(fp);
  if (!TS_JS_EXTS.has(ext) && !PY_EXTS.has(ext)) process.exit(0);
  if (
    fp.includes("node_modules") ||
    fp.includes("dist") ||
    fp.includes(".claude")
  )
    process.exit(0);
  if (TS_JS_EXTS.has(ext)) {
    runEslint(fp);
  } else if (PY_EXTS.has(ext)) {
    runRuff(fp);
  }
} catch (err) {
  console.error(
    JSON.stringify({
      error: `quality-gate: ${err instanceof Error ? err.message : String(err)}`,
    }),
  );
}
process.exit(0);
