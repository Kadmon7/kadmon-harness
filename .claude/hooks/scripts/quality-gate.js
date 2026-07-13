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
import { resolveBin } from "./resolve-bin.js";

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

// AUD-31: prefer a direct `node <entry>` invocation of the locally-installed
// `eslint` package (resolved via resolve-bin.js) — skips npx's per-call
// re-resolution AND avoids a Windows-only footgun where the .bin/eslint.cmd
// shim can't be spawned safely without shell:true (see resolve-bin.js
// header comment). Falls back to the original `npx eslint` invocation,
// unchanged, when no local install resolves.
//
// AUD-35: ESLint 9's flat-config CLI dropped the entire `--eslintrc` flag
// family. `--no-eslintrc` is now an UNRECOGNIZED option, which makes the
// CLI's own arg parser fail (exit 2) before any file is ever linted — and
// because only `lintErr.stdout` was ever forwarded (never `.stderr`, where
// CLI arg-parse errors land), the probe was completely dead: no finding
// ever surfaced, for any file, ever.
//
// Investigated reproducing the old "single rule, independent of project
// config" behavior under v9 via `--no-config-lookup` + `--rule` (or a
// standalone `-c <temp-config>`): empirically, `--no-config-lookup`
// disables flat-config lookup ENTIRELY, and `--rule` only *overrides*
// rules inside a config object that already matches the file — with no
// config object supplied, nothing matches, so ESLint reports every file
// "ignored because no matching configuration was supplied" regardless of
// `--rule`. A standalone config that actually matches would need its own
// `files` glob AND a full TS parser (this repo's `.ts` sources don't parse
// under the default espree parser) — that's rebuilding a mini project
// config, not "a lightweight quality nudge, low-noise" (the hook's
// documented intent). DECISION: fall back to the project's own flat
// config instead — `eslint <file>` picks up whatever
// eslint.config.{js,mjs,cjs} governs wherever this hook is installed
// (this repo's own config for self-hosted edits, or a consumer project's
// config when distributed via the harness plugin/install). Same low-noise,
// warn-only, non-blocking contract; findings now actually reach the
// console instead of being silently dropped.
//
// Also: ESLint's default exit code only reflects rule severity "error",
// not "warn" — a warning-only run still exits 0, so `execFileSync` never
// throws for it. The success path below must forward stdout too, or every
// warn-level finding (exactly what "low-noise nudge" is meant to surface)
// would stay invisible even after the flag fix.
function runEslint(fp) {
  // AUD-36: harden against flag-injection the same way runRuff does below —
  // resolve to an absolute path so a relative filename that starts with a
  // dash can't be misread by the linter's CLI arg parser as a flag.
  const safeFp = path.isAbsolute(fp) ? fp : path.resolve(fp);
  const eslintEntry = resolveBin("eslint");
  // AUD-39: suppress ESLint's "File ignored because of a matching ignore
  // pattern..." warning. It only fires for files the flat config already
  // ignores (e.g. a root-level *.js in this repo) and adds noise for an
  // edit that had nothing to lint. No effect on non-ignored files.
  // (`--no-warn-ignored` requires ESLint >= 8.51.0; the hook already assumes
  // an ESLint 9 flat-config baseline per AUD-35, so this adds no new floor.)
  const args = ["--no-warn-ignored", safeFp];
  try {
    const out = eslintEntry
      ? execFileSync(process.execPath, [eslintEntry, ...args], {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 10000,
        })
      : execFileSync("npx", ["eslint", ...args], {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 10000,
        });
    if (out) console.error(`\u{1F4CF} ESLint:\n${out}`);
  } catch (lintErr) {
    if (lintErr.stdout) console.error(`\u{1F4CF} ESLint:\n${lintErr.stdout}`);
    if (lintErr.stderr) console.error(`\u{1F4CF} ESLint:\n${lintErr.stderr}`);
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
