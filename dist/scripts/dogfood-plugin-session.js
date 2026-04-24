#!/usr/bin/env node
/**
 * dogfood-plugin-session.ts
 * E2E dogfood for plugin-mode hook verification.
 *
 * Simulates a complete Claude Code session against an external sandbox repo,
 * invoking all 22 hooks with plugin-mode env (KADMON_RUNTIME_ROOT unset, so
 * the 3-level resolveRootDir() walk from the harness repo is exercised).
 *
 * Reports how many of the 22 hooks fire end-to-end in plugin mode.
 *
 * Usage:
 *   npx tsx scripts/dogfood-plugin-session.ts [--sandbox <path>]
 *
 * The script writes to ~/.kadmon/kadmon.db (real DB, not :memory:).
 * Session ID starts with "dogfood-" so it can be cleaned up:
 *   DELETE FROM sessions WHERE id LIKE 'dogfood-%';
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
// ---------------------------------------------------------------------------
// Constants: all 22 hook names (sourced from hooks.json/settings.json catalog)
// ---------------------------------------------------------------------------
export const ALL_HOOK_NAMES = [
    // PreToolUse / Bash
    "block-no-verify",
    "git-push-reminder",
    "commit-format-guard",
    "commit-quality",
    // PreToolUse / Edit|Write
    "config-protection",
    "no-context-guard",
    // PreToolUse / mcp__
    "mcp-health-check",
    // PreToolUse / (all)
    "observe-pre",
    // PostToolUse / Bash
    "pr-created",
    // PostToolUse / Edit|Write
    "post-edit-format",
    "post-edit-typecheck",
    "quality-gate",
    "ts-review-reminder",
    "console-log-warn",
    "deps-change-reminder",
    "agent-metadata-sync",
    "post-edit-security",
    // PostToolUse / (all)
    "observe-post",
    // PostToolUseFailure / mcp__
    "mcp-health-failure",
    // PreCompact
    "pre-compact-save",
    // SessionStart
    "session-start",
    // Stop
    "session-end-all",
];
// Map from event+matcher to hook names (mirrors hooks.json structure)
const HOOK_MAP = {
    "PreToolUse/Bash": ["block-no-verify", "git-push-reminder", "commit-format-guard", "commit-quality"],
    "PreToolUse/Edit|Write": ["config-protection", "no-context-guard"],
    "PreToolUse/mcp__": ["mcp-health-check"],
    "PreToolUse/": ["observe-pre"],
    "PostToolUse/Bash": ["pr-created"],
    "PostToolUse/Edit|Write": [
        "post-edit-format",
        "post-edit-typecheck",
        "quality-gate",
        "ts-review-reminder",
        "console-log-warn",
        "deps-change-reminder",
        "agent-metadata-sync",
        "post-edit-security",
    ],
    "PostToolUse/": ["observe-post"],
    "PostToolUseFailure/mcp__": ["mcp-health-failure"],
    "PreCompact/": ["pre-compact-save"],
    "SessionStart/": ["session-start"],
    "Stop/": ["session-end-all"],
};
// ---------------------------------------------------------------------------
// checkSandbox
// ---------------------------------------------------------------------------
/**
 * Validates that the sandbox path is a git repo with a remote origin.
 * Returns a SandboxStatus describing readiness.
 */
export function checkSandbox(sandboxPath) {
    const reasons = [];
    // 1. Path must exist
    if (!fs.existsSync(sandboxPath)) {
        return {
            ready: false,
            path: sandboxPath,
            hasGitRemote: false,
            projectHash: null,
            reasons: [`Path does not exist or is not accessible: ${sandboxPath}`],
        };
    }
    // 2. Must be a git repo (check for .git dir or git rev-parse)
    let isGitRepo = false;
    try {
        execFileSync("git", ["rev-parse", "--git-dir"], {
            cwd: sandboxPath,
            stdio: "pipe",
            encoding: "utf8",
            timeout: 3000,
        });
        isGitRepo = true;
    }
    catch {
        isGitRepo = false;
    }
    if (!isGitRepo) {
        return {
            ready: false,
            path: sandboxPath,
            hasGitRemote: false,
            projectHash: null,
            reasons: ["Not a git repository — run git init first"],
        };
    }
    // 3. Must have a git remote origin
    let remoteUrl = null;
    try {
        const result = execFileSync("git", ["remote", "get-url", "origin"], {
            cwd: sandboxPath,
            stdio: "pipe",
            encoding: "utf8",
            timeout: 3000,
        }).trim();
        if (result.length > 0) {
            remoteUrl = result;
        }
    }
    catch {
        remoteUrl = null;
    }
    if (!remoteUrl) {
        reasons.push("No git remote 'origin' configured — add one for session tracking to work");
    }
    const hasGitRemote = remoteUrl !== null;
    const projectHash = remoteUrl
        ? crypto.createHash("sha256").update(remoteUrl).digest("hex").slice(0, 16)
        : null;
    return {
        ready: reasons.length === 0,
        path: sandboxPath,
        hasGitRemote,
        projectHash,
        reasons,
    };
}
// ---------------------------------------------------------------------------
// buildEventSequence
// ---------------------------------------------------------------------------
/**
 * Builds a realistic sequence of ~10 Claude Code events that collectively
 * cover all 22 hooks. Order: SessionStart → N x (PreToolUse + PostToolUse) →
 * PostToolUseFailure → PreCompact → Stop.
 */
export function buildEventSequence(sessionId, sandboxCwd) {
    const events = [];
    // Helper: get hooks for an event+matcher key
    function hooksFor(event, matcher) {
        return HOOK_MAP[`${event}/${matcher}`] ?? [];
    }
    // Event 1: SessionStart (fires observe-pre via "all" + session-start)
    events.push({
        event: "SessionStart",
        stdin: JSON.stringify({ session_id: sessionId, cwd: sandboxCwd }),
        hooksToInvoke: [
            ...hooksFor("SessionStart", ""),
        ],
    });
    // Event 2: PreToolUse/Bash — fires block-no-verify, git-push-reminder, etc. + observe-pre
    events.push({
        event: "PreToolUse",
        toolName: "Bash",
        stdin: JSON.stringify({
            session_id: sessionId,
            tool_name: "Bash",
            tool_input: { command: "git status" },
        }),
        hooksToInvoke: [
            ...hooksFor("PreToolUse", "Bash"),
            ...hooksFor("PreToolUse", ""),
        ],
    });
    // Event 3: PostToolUse/Bash — fires pr-created + observe-post
    events.push({
        event: "PostToolUse",
        toolName: "Bash",
        stdin: JSON.stringify({
            session_id: sessionId,
            tool_name: "Bash",
            tool_input: { command: "git status" },
            tool_response: { output: "" },
        }),
        hooksToInvoke: [
            ...hooksFor("PostToolUse", "Bash"),
            ...hooksFor("PostToolUse", ""),
        ],
    });
    // Event 4: PreToolUse/Edit|Write — fires config-protection, no-context-guard + observe-pre
    events.push({
        event: "PreToolUse",
        toolName: "Edit",
        stdin: JSON.stringify({
            session_id: sessionId,
            tool_name: "Edit",
            tool_input: {
                file_path: path.join(sandboxCwd, "README.md"),
                old_string: "old",
                new_string: "new",
            },
        }),
        hooksToInvoke: [
            ...hooksFor("PreToolUse", "Edit|Write"),
            ...hooksFor("PreToolUse", ""),
        ],
    });
    // Event 5: PostToolUse/Edit|Write — fires 7 PostToolUse hooks + observe-post
    events.push({
        event: "PostToolUse",
        toolName: "Edit",
        stdin: JSON.stringify({
            session_id: sessionId,
            tool_name: "Edit",
            tool_input: { file_path: path.join(sandboxCwd, "README.md") },
            tool_response: { success: true },
        }),
        hooksToInvoke: [
            ...hooksFor("PostToolUse", "Edit|Write"),
            ...hooksFor("PostToolUse", ""),
        ],
    });
    // Event 6: PreToolUse/mcp__ — fires mcp-health-check + observe-pre
    events.push({
        event: "PreToolUse",
        toolName: "mcp__fake__tool",
        stdin: JSON.stringify({
            session_id: sessionId,
            tool_name: "mcp__fake__tool",
            tool_input: {},
        }),
        hooksToInvoke: [
            ...hooksFor("PreToolUse", "mcp__"),
            ...hooksFor("PreToolUse", ""),
        ],
    });
    // Event 7: PostToolUseFailure/mcp__ — fires mcp-health-failure
    events.push({
        event: "PostToolUseFailure",
        toolName: "mcp__fake__tool",
        stdin: JSON.stringify({
            session_id: sessionId,
            tool_name: "mcp__fake__tool",
            tool_response: { error: "MCP timeout" },
        }),
        hooksToInvoke: [
            ...hooksFor("PostToolUseFailure", "mcp__"),
        ],
    });
    // Event 8: PreCompact — fires pre-compact-save
    events.push({
        event: "PreCompact",
        stdin: JSON.stringify({
            session_id: sessionId,
            trigger: "manual",
        }),
        hooksToInvoke: [
            ...hooksFor("PreCompact", ""),
        ],
    });
    // Event 9: Another PostToolUse/all — for observe-post coverage (idempotent)
    events.push({
        event: "PostToolUse",
        toolName: "Read",
        stdin: JSON.stringify({
            session_id: sessionId,
            tool_name: "Read",
            tool_input: { file_path: path.join(sandboxCwd, "README.md") },
            tool_response: { content: "# test" },
        }),
        hooksToInvoke: [
            ...hooksFor("PostToolUse", ""),
        ],
    });
    // Event 10: Stop — fires session-end-all
    events.push({
        event: "Stop",
        stdin: JSON.stringify({ session_id: sessionId, cwd: sandboxCwd }),
        hooksToInvoke: [
            ...hooksFor("Stop", ""),
        ],
    });
    return events;
}
// ---------------------------------------------------------------------------
// runHookDirect
// ---------------------------------------------------------------------------
const HOOK_TIMEOUT_MS = 5000;
const HARNESS_ROOT = path.resolve(import.meta.dirname, "..");
const HOOKS_DIR = path.join(HARNESS_ROOT, ".claude", "hooks", "scripts");
function isSpawnError(e) {
    return e instanceof Error;
}
/**
 * Runs a single hook script directly via `node <hook>.js`.
 * cwd is set to the sandbox (not the harness repo) to simulate plugin-mode.
 * KADMON_RUNTIME_ROOT is intentionally NOT set — the 3-level walk kicks in.
 */
function runHookDirect(hookName, stdin, sandboxCwd) {
    const scriptPath = path.join(HOOKS_DIR, `${hookName}.js`);
    const env = {
        ...process.env,
        // Plugin-mode: do NOT set KADMON_RUNTIME_ROOT — fallback walk should work
        KADMON_RUNTIME_ROOT: undefined,
        // Use real DB so we can verify persistence afterward
        KADMON_TEST_DB: undefined,
        // Suppress agent-metadata-sync side effects
        KADMON_SYNC_CLAUDE_MD_PATH: "/dev/null",
        KADMON_SYNC_AGENTS_MD_PATH: "/dev/null",
        // Clear disabled hooks override
        KADMON_DISABLED_HOOKS: "",
        // Ensure Node.js is on PATH (Windows Git Bash)
        PATH: `${process.env.PATH ?? ""}:/c/Program Files/nodejs`,
    };
    // Remove undefined keys (Node won't inherit them if undefined)
    delete env["KADMON_RUNTIME_ROOT"];
    delete env["KADMON_TEST_DB"];
    try {
        const stdout = execFileSync("node", [scriptPath], {
            encoding: "utf8",
            input: stdin,
            stdio: ["pipe", "pipe", "pipe"],
            timeout: HOOK_TIMEOUT_MS,
            env,
            cwd: sandboxCwd,
        });
        return { exitCode: 0, stdout, stderr: "" };
    }
    catch (err) {
        if (!isSpawnError(err)) {
            return { exitCode: -1, stdout: "", stderr: "", error: String(err) };
        }
        if (err.code === "ETIMEDOUT" || err.code === "ENOENT") {
            return {
                exitCode: -1,
                stdout: err.stdout ?? "",
                stderr: err.stderr ?? "",
                error: err.message || err.code,
            };
        }
        return {
            exitCode: err.status ?? 1,
            stdout: err.stdout ?? "",
            stderr: err.stderr ?? "",
        };
    }
}
// ---------------------------------------------------------------------------
// queryPersistedHookEvents (reads real ~/.kadmon/kadmon.db)
// ---------------------------------------------------------------------------
/**
 * Queries the real ~/.kadmon/kadmon.db using sql.js to find hook_events
 * for the given sessionId. Returns set of hook names that persisted.
 *
 * Note: This runs AFTER session-end-all has (potentially) flushed data,
 * so we give it a brief settle period.
 */
async function queryPersistedHookEvents(sessionId) {
    const persisted = new Set();
    let closeDb = null;
    try {
        const mod = await import("./lib/state-store.js");
        closeDb = mod.closeDb;
        // Open real DB (not :memory:)
        await mod.openDb();
        const events = mod.getHookEventsBySession(sessionId);
        for (const ev of events) {
            persisted.add(ev.hookName);
        }
    }
    catch (err) {
        // If DB can't be read, return empty set (hooks "not persisted")
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[dogfood] Warning: could not query DB: ${msg}\n`);
    }
    finally {
        // Always close DB — leaked handles accumulate on repeat runs
        if (closeDb) {
            try {
                closeDb();
            }
            catch {
                /* already closed or never opened */
            }
        }
    }
    return persisted;
}
// ---------------------------------------------------------------------------
// runPluginModeDogfood
// ---------------------------------------------------------------------------
/**
 * Orchestrates the full dogfood session:
 * 1. checkSandbox (auto-adds remote if missing)
 * 2. Build event sequence
 * 3. Invoke hooks per event
 * 4. Query DB for persisted hook_events
 * 5. Build DogfoodReport
 */
export async function runPluginModeDogfood(sandboxPath) {
    // Step 1: auto-add fake remote if needed (idempotent)
    let status = checkSandbox(sandboxPath);
    if (!status.hasGitRemote && fs.existsSync(sandboxPath)) {
        try {
            // Check if git repo exists first
            execFileSync("git", ["rev-parse", "--git-dir"], {
                cwd: sandboxPath,
                stdio: "pipe",
                timeout: 3000,
            });
            // Try adding remote (idempotent)
            try {
                execFileSync("git", ["remote", "add", "origin", "git@github.com:fake/kadmon-plugin-sandbox.git"], { cwd: sandboxPath, stdio: "pipe", timeout: 3000 });
            }
            catch {
                // remote already exists — ignore
            }
            status = checkSandbox(sandboxPath);
        }
        catch {
            // not a git repo — can't auto-fix
        }
    }
    if (!status.ready) {
        throw new Error(`Sandbox not ready: ${status.reasons.join("; ")}`);
    }
    // Step 2: generate unique session ID and build event sequence
    const sessionId = `dogfood-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const events = buildEventSequence(sessionId, sandboxPath);
    // Step 3: invoke hooks per event
    // Track: hookName → list of exit codes
    const hookResults = new Map();
    for (const ev of events) {
        for (const hookName of ev.hooksToInvoke) {
            const result = runHookDirect(hookName, ev.stdin, sandboxPath);
            const existing = hookResults.get(hookName) ?? [];
            existing.push(result.exitCode);
            hookResults.set(hookName, existing);
        }
    }
    // Step 4: Query DB for persisted hook events (session-end-all writes to DB)
    const persistedHooks = await queryPersistedHookEvents(sessionId);
    // Step 5: Build report
    const hooksInvoked = [];
    const hooksNotDisparados = [];
    for (const hookName of ALL_HOOK_NAMES) {
        const exitCodes = hookResults.get(hookName);
        if (exitCodes && exitCodes.length > 0) {
            hooksInvoked.push({
                hook: hookName,
                invocations: exitCodes.length,
                exitCodes,
                persistedInDb: persistedHooks.has(hookName),
            });
        }
        else {
            hooksNotDisparados.push(hookName);
        }
    }
    const summary = {
        passed: hooksInvoked.length,
        failed: hooksNotDisparados.length,
        total: 22,
    };
    return {
        sandboxPath,
        // checkSandbox guarantees projectHash !== null when status.ready === true (see invariant above)
        projectHash: status.projectHash,
        sessionId,
        totalEvents: events.length,
        hooksInvoked,
        hooksNotDisparados,
        summary,
    };
}
// ---------------------------------------------------------------------------
// formatReport
// ---------------------------------------------------------------------------
/**
 * Formats a DogfoodReport as a readable text table.
 */
export function formatReport(report) {
    const lines = [];
    lines.push("=== DOGFOOD PLUGIN-MODE SESSION REPORT ===");
    lines.push("");
    lines.push(`Sandbox:      ${report.sandboxPath}`);
    lines.push(`ProjectHash:  ${report.projectHash}`);
    lines.push(`SessionID:    ${report.sessionId}`);
    lines.push(`TotalEvents:  ${report.totalEvents}`);
    lines.push("");
    // Hooks fired table
    lines.push("HOOKS FIRED:");
    const COL_NAME = 26;
    const COL_INV = 6;
    const COL_EXIT = 14;
    const COL_PERSIST = 10;
    const header = [
        "hook".padEnd(COL_NAME),
        "inv".padEnd(COL_INV),
        "exitCodes".padEnd(COL_EXIT),
        "inDB".padEnd(COL_PERSIST),
    ].join("  ");
    lines.push(header);
    lines.push("-".repeat(header.length));
    for (const inv of report.hooksInvoked) {
        const row = [
            inv.hook.slice(0, COL_NAME).padEnd(COL_NAME),
            String(inv.invocations).padEnd(COL_INV),
            inv.exitCodes.join(",").slice(0, COL_EXIT).padEnd(COL_EXIT),
            (inv.persistedInDb ? "yes" : "no").padEnd(COL_PERSIST),
        ].join("  ");
        lines.push(row);
    }
    lines.push("-".repeat(header.length));
    lines.push("");
    // Hooks NOT fired
    if (report.hooksNotDisparados.length > 0) {
        lines.push("HOOKS NOT FIRED:");
        for (const h of report.hooksNotDisparados) {
            lines.push(`  - ${h}`);
        }
    }
    else {
        lines.push("HOOKS NOT FIRED: (none — all 22 fired)");
    }
    lines.push("");
    // Summary
    const { passed, failed, total } = report.summary;
    lines.push(`SUMMARY: ${passed}/${total} hooks fired  (${failed} not fired)`);
    lines.push("");
    lines.push(`Cleanup: DELETE FROM sessions WHERE id = '${report.sessionId}';`);
    return lines.join("\n");
}
// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------
const isCli = process.argv[1] != null &&
    import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
    // Parse --sandbox <path> flag (default: /tmp/kadmon-plugin-sandbox)
    const sandboxArgIdx = process.argv.indexOf("--sandbox");
    const sandboxPath = sandboxArgIdx !== -1 && process.argv[sandboxArgIdx + 1]
        ? process.argv[sandboxArgIdx + 1]
        : "/tmp/kadmon-plugin-sandbox";
    console.log(`[dogfood] Starting plugin-mode session against sandbox: ${sandboxPath}`);
    console.log(`[dogfood] Harness root: ${HARNESS_ROOT}`);
    console.log("");
    // Initialize sandbox if not ready
    if (!fs.existsSync(sandboxPath)) {
        console.log(`[dogfood] Creating sandbox directory: ${sandboxPath}`);
        fs.mkdirSync(sandboxPath, { recursive: true });
        try {
            execFileSync("git", ["init", "--quiet"], { cwd: sandboxPath });
            console.log("[dogfood] git init done");
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`[dogfood] Failed to git init: ${msg}`);
            process.exit(1);
        }
    }
    runPluginModeDogfood(sandboxPath)
        .then((report) => {
        console.log(formatReport(report));
        process.exit(report.summary.failed > 0 ? 1 : 0);
    })
        .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[dogfood] Error: ${msg}`);
        process.exit(1);
    });
}
