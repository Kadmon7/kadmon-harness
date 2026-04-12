// Session Summary Generator — heuristic-based, no LLM calls
// Reads observations.jsonl and produces a human-readable summary
// of what happened in the session.

import fs from "node:fs";
import path from "node:path";

/**
 * Extract file paths from Bash commands that modify files.
 * @param {string} cmd - Bash command string
 * @returns {Set<string>}
 */
export function extractBashFiles(cmd) {
  const files = new Set();
  const patterns = [
    /(?:>>?)\s*["']?([^\s"'|&;]+)/g, // echo "x" > file.txt
    /\bcp\s+\S+\s+["']?([^\s"'|&;]+)/g, // cp src dest
    /\bmv\s+\S+\s+["']?([^\s"'|&;]+)/g, // mv src dest
    /\btouch\s+["']?([^\s"'|&;]+)/g, // touch file
  ];
  for (const rx of patterns) {
    let m;
    while ((m = rx.exec(cmd)) !== null) {
      const f = m[1];
      if (f && !f.startsWith("-") && !f.startsWith("/dev/") && !f.includes("*"))
        files.add(f);
    }
  }
  return files;
}

/**
 * Generate a heuristic session summary from observations.
 * @param {string} obsPath - Path to observations.jsonl
 * @param {string} obsPath - Path to observations JSONL file
 * @param {string|null} [preReadContent] - Optional pre-read JSONL content (avoids redundant disk I/O)
 * @returns {{ summary: string, tasks: string[], topFiles: string[], bashFiles: string[] }}
 */
export function generateSummary(obsPath, preReadContent = null) {
  // Prefer pre-read content when caller already has it; fall back to disk read.
  let rawContent;
  if (preReadContent !== null && preReadContent !== undefined) {
    rawContent = preReadContent;
  } else {
    if (!fs.existsSync(obsPath)) {
      return { summary: "", tasks: [], topFiles: [], bashFiles: [] };
    }
    rawContent = fs.readFileSync(obsPath, "utf8");
  }

  const lines = rawContent.split("\n").filter(Boolean);
  if (lines.length === 0) {
    return { summary: "", tasks: [], topFiles: [], bashFiles: [] };
  }

  const editCounts = new Map();
  const readFiles = new Set();
  const bashFiles = new Set();
  const toolCounts = new Map();
  const tasks = new Set();
  const agentTypes = new Set();
  const trackedTasks = new Map(); // taskId → { subject, status }
  let taskCreateSeq = 0;
  let hadTests = false;
  let hadCommit = false;
  let hadTypecheck = false;
  let lastCommitMsg = "";
  let failedTools = 0;
  const errors = [];

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
      // Extract file modifications from bash commands
      for (const f of extractBashFiles(cmd)) bashFiles.add(f);
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

    // Track TaskCreate/TaskUpdate lifecycle
    if (
      e.eventType === "tool_pre" &&
      tool === "TaskCreate" &&
      meta.taskSubject
    ) {
      taskCreateSeq++;
      const id = `auto-${taskCreateSeq}`;
      trackedTasks.set(id, { subject: meta.taskSubject, status: "pending" });
    }
    if (e.eventType === "tool_pre" && tool === "TaskUpdate" && meta.taskId) {
      const existing = trackedTasks.get(meta.taskId);
      if (existing) {
        if (meta.taskStatus) existing.status = meta.taskStatus;
        if (meta.taskSubject) existing.subject = meta.taskSubject;
      } else if (meta.taskStatus) {
        // TaskUpdate for a task we didn't see created (e.g., from before compaction)
        trackedTasks.set(meta.taskId, {
          subject: meta.taskSubject ?? `Task #${meta.taskId}`,
          status: meta.taskStatus,
        });
      }
    }

    // Track failures and errors
    if (e.eventType === "tool_post" && e.success === false) {
      failedTools++;
      if (e.error && errors.length < 3) {
        errors.push(`${tool}: ${String(e.error).slice(0, 80)}`);
      }
    }
  }

  // Infer tasks as fallback when no Agent/Skill/TaskCreate events exist
  if (tasks.size === 0) {
    if (hadCommit && lastCommitMsg) {
      tasks.add(lastCommitMsg);
    } else if (editCounts.size > 0 && hadTests) {
      tasks.add("Developed and tested code changes");
    } else if (editCounts.size > 0) {
      tasks.add("Code modifications");
    } else if (readFiles.size > 0) {
      tasks.add("Code exploration and research");
    }
  }

  // Build top edited files
  const topFiles = [...editCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Build summary parts — commit message first (most informative)
  const parts = [];

  // Commit info (lead with this if available)
  if (hadCommit && lastCommitMsg) {
    parts.push(`Committed: ${lastCommitMsg}`);
  } else if (hadCommit) {
    parts.push("Committed changes");
  }

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

  // Failures and errors
  if (failedTools > 0) {
    parts.push(`${failedTools} tool failure(s)`);
    if (errors.length > 0) {
      parts.push(`Errors: ${errors.join("; ")}`);
    }
  }

  // Merge tracked tasks into tasks array
  // Pending tasks get [pending] prefix for carry-forward detection
  const pendingTasks = [];
  for (const [, t] of trackedTasks) {
    if (t.status === "completed" || t.status === "deleted") {
      tasks.add(t.subject);
    } else {
      pendingTasks.push(t.subject);
      tasks.add(`[pending] ${t.subject}`);
    }
  }

  if (pendingTasks.length > 0) {
    parts.push(`${pendingTasks.length} pending task(s)`);
  }

  // Tool usage summary
  const totalTools = [...toolCounts.values()].reduce((a, b) => a + b, 0);
  parts.push(`${totalTools} tool calls total`);

  return {
    summary: parts.join(". ") + ".",
    tasks: [...tasks],
    topFiles,
    bashFiles: [...bashFiles],
  };
}
