// Session Summary Generator — heuristic-based, no LLM calls
// Reads observations.jsonl and produces a human-readable summary
// of what happened in the session.

import fs from "node:fs";
import path from "node:path";

/**
 * Generate a heuristic session summary from observations.
 * @param {string} obsPath - Path to observations.jsonl
 * @returns {{ summary: string, tasks: string[], topFiles: string[] }}
 */
export function generateSummary(obsPath) {
  if (!fs.existsSync(obsPath)) {
    return { summary: "", tasks: [], topFiles: [] };
  }

  const lines = fs.readFileSync(obsPath, "utf8").split("\n").filter(Boolean);
  if (lines.length === 0) {
    return { summary: "", tasks: [], topFiles: [] };
  }

  const editCounts = new Map();
  const readFiles = new Set();
  const toolCounts = new Map();
  const tasks = new Set();
  const agentTypes = new Set();
  let hadTests = false;
  let hadCommit = false;
  let hadTypecheck = false;
  let lastCommitMsg = "";

  for (const line of lines) {
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }

    const tool = e.toolName ?? "";
    const filePath = e.filePath ?? "";
    const meta = e.metadata ?? {};

    // Count tools
    if (e.eventType === "tool_pre" && tool) {
      toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
    }

    // Track file edits
    if (
      e.eventType === "tool_pre" &&
      (tool === "Edit" || tool === "Write") &&
      filePath
    ) {
      const short = path.basename(filePath);
      editCounts.set(short, (editCounts.get(short) || 0) + 1);
    }

    // Track reads
    if (e.eventType === "tool_pre" && tool === "Read" && filePath) {
      readFiles.add(path.basename(filePath));
    }

    // Detect test runs
    if (e.eventType === "tool_pre" && tool === "Bash") {
      const cmd = meta.command ?? "";
      if (/vitest|jest|mocha|npm test/i.test(cmd)) hadTests = true;
      if (/tsc\s+--noEmit|tsc\b/.test(cmd)) hadTypecheck = true;
      if (/git\s+commit/.test(cmd)) {
        hadCommit = true;
        const match = cmd.match(
          /(?:feat|fix|docs|chore|refactor|test|style|perf)(?:\([^)]*\))?:\s*(.+?)(?:\n|$)/,
        );
        if (match) lastCommitMsg = match[0].trim();
      }
    }

    // Track agent dispatches as tasks
    if (e.eventType === "tool_pre" && tool === "Agent") {
      const desc = meta.description ?? "";
      const agentType = meta.agentType ?? meta.subagent_type ?? "";
      if (desc) tasks.add(desc);
      if (agentType) agentTypes.add(agentType);
    }

    // Detect slash commands in Bash (Skill tool invocations)
    if (e.eventType === "tool_pre" && tool === "Skill") {
      const skillName = meta.skill ?? "";
      if (skillName) tasks.add(`/${skillName}`);
    }
  }

  // Build top edited files
  const topFiles = [...editCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Build summary parts
  const parts = [];

  // What was edited
  if (topFiles.length > 0) {
    parts.push(`Edited ${editCounts.size} file(s): ${topFiles.join(", ")}`);
  }

  // Agents used
  if (agentTypes.size > 0) {
    parts.push(`Agents: ${[...agentTypes].join(", ")}`);
  }

  // Verification status
  const checks = [];
  if (hadTests) checks.push("tests");
  if (hadTypecheck) checks.push("typecheck");
  if (checks.length > 0) parts.push(`Ran: ${checks.join(", ")}`);

  // Commit info
  if (hadCommit && lastCommitMsg) {
    parts.push(`Committed: ${lastCommitMsg}`);
  } else if (hadCommit) {
    parts.push("Committed changes");
  }

  // Tool usage summary
  const totalTools = [...toolCounts.values()].reduce((a, b) => a + b, 0);
  parts.push(`${totalTools} tool calls total`);

  return {
    summary: parts.join(". ") + ".",
    tasks: [...tasks],
    topFiles,
  };
}
