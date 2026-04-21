#!/usr/bin/env node
/**
 * smoke-all-hooks.ts
 * Capa 2 smoke test: itera los 21 hooks registrados en .claude/settings.json,
 * genera stdin sintético, ejecuta cada hook con execFileSync, reporta pass/fail.
 *
 * Usage: npx tsx scripts/smoke-all-hooks.ts
 * Exit:  0 si todos pasan, 1 si alguno falla
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HookDef {
  name: string;
  script: string;
  event: "PreToolUse" | "PostToolUse" | "PostToolUseFailure" | "PreCompact" | "SessionStart" | "Stop";
  matcher: string;
}

export interface HookResult {
  hook: HookDef;
  exitCode: number;
  stderr: string;
  stdout: string;
  durationMs: number;
  error?: string;
}

export type Status = "pass" | "fail" | "unexpected";

// ---------------------------------------------------------------------------
// Warning-type hooks: exit 1 is expected behavior (non-blocking warning)
// ---------------------------------------------------------------------------
const WARNING_HOOKS = new Set([
  "git-push-reminder",
  "ts-review-reminder",
  "console-log-warn",
  "deps-change-reminder",
  "quality-gate",
  "post-edit-typecheck",
  "agent-metadata-sync",
]);

// Guard hooks: exit 2 is expected when their synthetic stdin triggers the guard
const GUARD_HOOKS = new Set([
  "no-context-guard",
  "config-protection",
  "block-no-verify",
  "commit-format-guard",
  "commit-quality",
]);

// ---------------------------------------------------------------------------
// parseSettings
// ---------------------------------------------------------------------------

interface SettingsHook {
  type: string;
  command: string;
}

interface SettingsMatcher {
  matcher: string;
  hooks: SettingsHook[];
}

type EventName = HookDef["event"];

interface SettingsJson {
  hooks?: Partial<Record<EventName, SettingsMatcher[]>>;
}

/**
 * Reads .claude/settings.json and returns flat list of HookDef objects.
 * Extracts hook name from the node script path (basename without .js).
 */
export function parseSettings(settingsPath: string): HookDef[] {
  const raw = fs.readFileSync(settingsPath, "utf8");
  let settings: SettingsJson;
  try {
    settings = JSON.parse(raw) as SettingsJson;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON in ${settingsPath}: ${msg}`);
  }
  const result: HookDef[] = [];

  const validEvents: EventName[] = [
    "PreToolUse",
    "PostToolUse",
    "PostToolUseFailure",
    "PreCompact",
    "SessionStart",
    "Stop",
  ];

  for (const event of validEvents) {
    const matchers = settings.hooks?.[event];
    if (!matchers) continue;

    for (const matcherBlock of matchers) {
      const matcher = matcherBlock.matcher ?? "";
      for (const hook of matcherBlock.hooks) {
        // Extract the .js script path from the command string
        // Pattern: node .claude/hooks/scripts/<name>.js
        const scriptMatch = hook.command.match(/node\s+(\S+\.js)/);
        if (!scriptMatch) continue;

        const script = scriptMatch[1].replace(/\\/g, "/");
        const name = path.basename(script, ".js");

        result.push({ name, script, event, matcher });
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// generateStdin
// ---------------------------------------------------------------------------

const SMOKE_UUID = randomUUID();
const SMOKE_SESSION_ID = `smoke-${SMOKE_UUID}`;
// A path that will never appear in observations (triggers no-context-guard)
const SMOKE_EDIT_PATH = `/tmp/smoke-no-context-${SMOKE_UUID}.ts`;

/**
 * Produces minimal valid JSON stdin for a given hook based on its event and matcher.
 */
export function generateStdin(hook: HookDef): string {
  const { event, matcher, name } = hook;

  if (event === "PreToolUse") {
    if (matcher === "Bash") {
      return JSON.stringify({
        session_id: SMOKE_SESSION_ID,
        tool_name: "Bash",
        tool_input: { command: "git status" },
      });
    }
    if (matcher === "Edit|Write") {
      // no-context-guard gets a unique path that won't be in observations
      const filePath = name === "no-context-guard"
        ? SMOKE_EDIT_PATH
        : "/tmp/smoke-edit.ts";
      return JSON.stringify({
        session_id: SMOKE_SESSION_ID,
        tool_name: "Edit",
        tool_input: {
          file_path: filePath,
          old_string: "a",
          new_string: "b",
        },
      });
    }
    if (matcher === "mcp__") {
      return JSON.stringify({
        session_id: SMOKE_SESSION_ID,
        tool_name: "mcp__fake__tool",
        tool_input: {},
      });
    }
    // empty matcher (observe-pre)
    return JSON.stringify({
      session_id: SMOKE_SESSION_ID,
      tool_name: "Read",
      tool_input: { file_path: "/tmp/smoke-read.ts" },
    });
  }

  if (event === "PostToolUse") {
    if (matcher === "Bash") {
      return JSON.stringify({
        session_id: SMOKE_SESSION_ID,
        tool_name: "Bash",
        tool_input: { command: "ls" },
        tool_response: { output: "" },
      });
    }
    if (matcher === "Edit|Write") {
      return JSON.stringify({
        session_id: SMOKE_SESSION_ID,
        tool_name: "Edit",
        tool_input: { file_path: "/tmp/smoke-edit.ts" },
        tool_response: { success: true },
      });
    }
    // empty matcher (observe-post)
    return JSON.stringify({
      session_id: SMOKE_SESSION_ID,
      tool_name: "Read",
      tool_input: { file_path: "/tmp/smoke-read.ts" },
      tool_response: { content: "" },
    });
  }

  if (event === "PostToolUseFailure") {
    return JSON.stringify({
      session_id: SMOKE_SESSION_ID,
      tool_name: "mcp__fake__tool",
      tool_response: { error: "timeout" },
    });
  }

  if (event === "PreCompact") {
    return JSON.stringify({
      session_id: SMOKE_SESSION_ID,
      trigger: "manual",
    });
  }

  // SessionStart and Stop
  return JSON.stringify({
    session_id: SMOKE_SESSION_ID,
    cwd: process.cwd(),
  });
}

// ---------------------------------------------------------------------------
// runHook
// ---------------------------------------------------------------------------

const HOOK_TIMEOUT_MS = 3000;

/**
 * Type guard for execFileSync error shape. Node's child_process always
 * throws an Error subclass with these optional fields, but the lint rules
 * forbid `as` casts — this narrows unknown safely.
 */
function isSpawnError(e: unknown): e is Error & {
  status?: number;
  stdout?: string;
  stderr?: string;
  code?: string;
} {
  return e instanceof Error;
}

/**
 * Executes a hook script with synthetic stdin. Returns exit code, stderr, stdout, duration.
 * Wraps execFileSync errors (non-zero exits) — never throws.
 */
export function runHook(hook: HookDef, stdin: string): HookResult {
  const repoRoot = process.cwd();
  const scriptPath = path.resolve(repoRoot, hook.script);
  const start = Date.now();

  // Isolation env: use :memory: DB, clear disabled hooks
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    KADMON_TEST_DB: ":memory:",
    KADMON_DISABLED_HOOKS: "",
    // Suppress agent-metadata-sync from touching real CLAUDE.md
    KADMON_SYNC_CLAUDE_MD_PATH: "/dev/null",
    KADMON_SYNC_AGENTS_MD_PATH: "/dev/null",
    VITEST: "true",
  };

  try {
    const stdout = execFileSync("node", [scriptPath], {
      encoding: "utf8",
      input: stdin,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: HOOK_TIMEOUT_MS,
      env,
      cwd: repoRoot,
    });
    const durationMs = Date.now() - start;
    return { hook, exitCode: 0, stderr: "", stdout, durationMs };
  } catch (err: unknown) {
    const durationMs = Date.now() - start;

    if (!isSpawnError(err)) {
      return {
        hook,
        exitCode: -1,
        stderr: "",
        stdout: "",
        durationMs,
        error: typeof err === "string" ? err : "unknown non-Error thrown",
      };
    }

    // ETIMEDOUT or ENOENT → error field
    if (err.code === "ETIMEDOUT" || err.code === "ENOENT") {
      return {
        hook,
        exitCode: -1,
        stderr: err.stderr ?? "",
        stdout: err.stdout ?? "",
        durationMs,
        error: err.message || err.code,
      };
    }

    // Non-zero exit from the hook itself
    return {
      hook,
      exitCode: err.status ?? 1,
      stderr: err.stderr ?? "",
      stdout: err.stdout ?? "",
      durationMs,
    };
  }
}

// ---------------------------------------------------------------------------
// classify
// ---------------------------------------------------------------------------

/**
 * Decides pass/fail based on exit code and hook identity.
 * Rules:
 *   exit 0 → always pass
 *   exit 1 → pass for warning-type hooks, fail otherwise
 *   exit 2 → pass for guard hooks (triggered as expected), fail for observe/lifecycle hooks
 *   error  → fail
 */
export function classify(result: HookResult): { status: Status; reason: string } {
  const { hook, exitCode, error } = result;
  const { name } = hook;

  if (error) {
    return { status: "fail", reason: `error: ${error}` };
  }

  if (exitCode === 0) {
    return { status: "pass", reason: "exit 0 (allowed)" };
  }

  if (exitCode === 1) {
    if (WARNING_HOOKS.has(name)) {
      return { status: "pass", reason: "exit 1 (warning expected for this hook)" };
    }
    return { status: "fail", reason: "exit 1 (unexpected non-zero for non-warning hook)" };
  }

  if (exitCode === 2) {
    if (GUARD_HOOKS.has(name)) {
      return { status: "pass", reason: "exit 2 (guard triggered as expected)" };
    }
    return { status: "fail", reason: "exit 2 (unexpected block for non-guard hook)" };
  }

  return { status: "fail", reason: `unexpected exit code ${exitCode}` };
}

// ---------------------------------------------------------------------------
// reportTable
// ---------------------------------------------------------------------------

/**
 * Renders a formatted table of hook smoke results + summary line.
 */
export function reportTable(results: HookResult[]): string {
  const lines: string[] = [];
  lines.push("=== SMOKE TEST: HOOKS ===");
  lines.push("");

  // Column widths
  const COL_NAME = 28;
  const COL_EVENT = 22;
  const COL_MATCHER = 14;
  const COL_EXIT = 6;
  const COL_MS = 8;
  const COL_STATUS = 12;

  const header = [
    "hook".padEnd(COL_NAME),
    "event".padEnd(COL_EVENT),
    "matcher".padEnd(COL_MATCHER),
    "exit".padEnd(COL_EXIT),
    "ms".padEnd(COL_MS),
    "status".padEnd(COL_STATUS),
    "reason",
  ].join("  ");

  lines.push(header);
  lines.push("-".repeat(header.length));

  let passCount = 0;
  let failCount = 0;

  for (const result of results) {
    const { status, reason } = classify(result);
    const icon = status === "pass" ? "pass" : "fail";

    if (status === "pass") passCount++;
    else failCount++;

    const row = [
      result.hook.name.slice(0, COL_NAME).padEnd(COL_NAME),
      result.hook.event.slice(0, COL_EVENT).padEnd(COL_EVENT),
      (result.hook.matcher || "(empty)").slice(0, COL_MATCHER).padEnd(COL_MATCHER),
      String(result.exitCode).padEnd(COL_EXIT),
      `${result.durationMs}ms`.padEnd(COL_MS),
      icon.padEnd(COL_STATUS),
      reason,
    ].join("  ");

    lines.push(row);
  }

  lines.push("-".repeat(header.length));
  lines.push(`Summary: ${passCount} pass, ${failCount} fail out of ${results.length}`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

const isCli =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const settingsPath = path.resolve(".claude/settings.json");

  console.log("Reading hooks from .claude/settings.json...");
  const hooks = parseSettings(settingsPath);
  console.log(`Found ${hooks.length} hooks. Running smoke test...\n`);

  const results: HookResult[] = [];
  for (const hook of hooks) {
    const stdin = generateStdin(hook);
    const result = runHook(hook, stdin);
    results.push(result);

    const { status, reason } = classify(result);
    const icon = status === "pass" ? "✓" : "✗";
    const exitStr = result.error ? `err` : String(result.exitCode);
    process.stdout.write(
      `${icon} ${hook.name.padEnd(28)} ${hook.event.padEnd(22)} ${(hook.matcher || "(empty)").padEnd(14)} exit=${exitStr}  ${result.durationMs}ms  ${status} (${reason})\n`,
    );
  }

  console.log("\n" + "-".repeat(80));
  const passCount = results.filter((r) => classify(r).status === "pass").length;
  const failCount = results.length - passCount;
  console.log(
    `Summary: ${passCount} pass, ${failCount} fail, 0 error out of ${results.length}`,
  );
  console.log(`Exit: ${failCount > 0 ? 1 : 0}`);

  process.exit(failCount > 0 ? 1 : 0);
}
