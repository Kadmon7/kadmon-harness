#!/usr/bin/env node
// Hook: agent-metadata-sync | Trigger: PostToolUse (Edit|Write)
// Purpose: Auto-sync agent frontmatter changes to CLAUDE.md + agents.md catalogs
import fs from "node:fs";
import path from "node:path";
import { parseStdin, isDisabled } from "./parse-stdin.js";
import { logHookEvent } from "./log-hook-event.js";

const HOOK_NAME = "agent-metadata-sync";
const start = Date.now();

try {
  if (isDisabled(HOOK_NAME)) process.exit(0);

  const input = parseStdin();
  const filePath = input?.tool_input?.file_path ?? "";

  // Fast bail: not an agent file
  if (!filePath || !/[/\\]\.claude[/\\]agents[/\\][^/\\]+\.md$/.test(filePath)) {
    process.exit(0);
  }

  // Read the edited agent file
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (readErr) {
    process.stderr.write(
      JSON.stringify({ warning: `${HOOK_NAME}: could not read agent file: ${filePath}` }) + "\n",
    );
    logHookEvent(input.session_id, {
      hookName: HOOK_NAME,
      eventType: "post_tool",
      toolName: input.tool_name ?? "Edit",
      exitCode: 1,
      blocked: false,
      durationMs: Date.now() - start,
      error: `could not read: ${filePath}`,
    });
    process.exit(1);
  }

  // Parse YAML frontmatter (between first --- and second ---)
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    process.stderr.write(
      JSON.stringify({ warning: `${HOOK_NAME}: no frontmatter found in ${filePath}` }) + "\n",
    );
    logHookEvent(input.session_id, {
      hookName: HOOK_NAME,
      eventType: "post_tool",
      toolName: input.tool_name ?? "Edit",
      exitCode: 1,
      blocked: false,
      durationMs: Date.now() - start,
      error: `no frontmatter in ${filePath}`,
    });
    process.exit(1);
  }

  const frontmatter = frontmatterMatch[1];

  // Extract agent name: prefer `name:` field, fall back to filename
  const nameMatch = frontmatter.match(/^name:\s*(\S+)/m);
  const agentName = nameMatch ? nameMatch[1] : path.basename(filePath, ".md");

  // Extract model field
  const modelMatch = frontmatter.match(/^model:\s*(\S+)/m);
  if (!modelMatch) {
    process.stderr.write(
      JSON.stringify({
        warning: `${HOOK_NAME}: no model field in frontmatter of ${filePath}`,
      }) + "\n",
    );
    logHookEvent(input.session_id, {
      hookName: HOOK_NAME,
      eventType: "post_tool",
      toolName: input.tool_name ?? "Edit",
      exitCode: 1,
      blocked: false,
      durationMs: Date.now() - start,
      error: `missing model in ${filePath}`,
    });
    process.exit(1);
  }

  const newModel = modelMatch[1];

  // Resolve catalog paths — env overrides are test-only; production always uses cwd-relative paths
  const isTestEnv =
    process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  const claudeMdPath =
    isTestEnv && process.env.KADMON_SYNC_CLAUDE_MD_PATH
      ? process.env.KADMON_SYNC_CLAUDE_MD_PATH
      : path.resolve(process.cwd(), "CLAUDE.md");
  const agentsMdPath =
    isTestEnv && process.env.KADMON_SYNC_AGENTS_MD_PATH
      ? process.env.KADMON_SYNC_AGENTS_MD_PATH
      : path.resolve(process.cwd(), ".claude/rules/common/agents.md");

  const warnings = [];
  let changed = false;

  // Helper: escape string for use inside a RegExp literal
  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Sync CLAUDE.md agents table: | agentName | model |
  const claudeMd = fs.readFileSync(claudeMdPath, "utf8");
  const claudeRowPattern = new RegExp(
    `(\\|\\s*${escapeRegex(agentName)}\\s*\\|\\s*)[a-zA-Z0-9]+( \\|)`,
  );
  if (claudeRowPattern.test(claudeMd)) {
    const updated = claudeMd.replace(claudeRowPattern, `$1${newModel}$2`);
    if (updated !== claudeMd) {
      fs.writeFileSync(claudeMdPath, updated, "utf8");
      changed = true;
    }
  } else {
    warnings.push(`agent "${agentName}" not found in catalog: CLAUDE.md`);
  }

  // Sync agents.md catalog: | agentName | model | ... |
  const agentsMd = fs.readFileSync(agentsMdPath, "utf8");
  const agentsRowPattern = new RegExp(
    `(\\|\\s*${escapeRegex(agentName)}\\s*\\|\\s*)[a-zA-Z0-9]+( \\|)`,
  );
  if (agentsRowPattern.test(agentsMd)) {
    const updated = agentsMd.replace(agentsRowPattern, `$1${newModel}$2`);
    if (updated !== agentsMd) {
      fs.writeFileSync(agentsMdPath, updated, "utf8");
      changed = true;
    }
  } else {
    warnings.push(`agent "${agentName}" not found in catalog: agents.md`);
  }

  if (warnings.length > 0) {
    for (const w of warnings) {
      process.stderr.write(JSON.stringify({ warning: w }) + "\n");
    }
    logHookEvent(input.session_id, {
      hookName: HOOK_NAME,
      eventType: "post_tool",
      toolName: input.tool_name ?? "Edit",
      exitCode: 1,
      blocked: false,
      durationMs: Date.now() - start,
      error: warnings.join("; "),
    });
    process.exit(1);
  }

  logHookEvent(input.session_id, {
    hookName: HOOK_NAME,
    eventType: "post_tool",
    toolName: input.tool_name ?? "Edit",
    exitCode: 0,
    blocked: false,
    durationMs: Date.now() - start,
  });
  process.exit(0);
} catch (err) {
  process.stderr.write(
    JSON.stringify({
      error: `${HOOK_NAME}: ${err instanceof Error ? err.message : String(err)}`,
    }) + "\n",
  );
  // NEVER exit 2 — do not block saves
  process.exit(0);
}
