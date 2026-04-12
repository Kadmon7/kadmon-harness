// Module: daily-log | Shared utility for daily session logs
// Used by: pre-compact-save.js, session-end-all.js, session-start.js
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Resolve the Claude memory directory path for a given working directory.
 * Converts path separators to hyphens to match Claude's project directory naming.
 *
 * @param {string} cwd - Working directory path
 * @returns {string} Full path to the memory directory
 */
export function resolveMemoryDir(cwd) {
  const projectDirName = cwd.replace(/[:\\/]/g, "-");
  return path.join(os.homedir(), ".claude", "projects", projectDirName, "memory");
}

/**
 * Get today's date as YYYY-MM-DD string.
 */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Get current time as HH:MM string.
 */
function now() {
  return new Date().toTimeString().slice(0, 5);
}

/**
 * Resolve the daily log file path for today.
 * @param {string} memoryDir - Base memory directory
 * @returns {string} Full path to today's log file
 */
function logPath(memoryDir) {
  return path.join(memoryDir, "logs", `${today()}.md`);
}

/**
 * Append a session entry to today's daily log file.
 * Creates the logs/ directory and file if they don't exist.
 *
 * @param {object} entry
 * @param {string} entry.sessionId - Session UUID
 * @param {string} entry.summary - Session summary text
 * @param {string[]} entry.tasks - Task list (may include [pending] prefix)
 * @param {string[]} entry.topFiles - Top modified files
 * @param {string[]} entry.commits - Commit messages
 * @param {string} memoryDir - Base memory directory
 */
export function appendDailyLog(entry, memoryDir) {
  const filePath = logPath(memoryDir);
  const logsDir = path.dirname(filePath);
  fs.mkdirSync(logsDir, { recursive: true });

  const isNew = !fs.existsSync(filePath);
  const sid = (entry.sessionId || "unknown").slice(0, 8);

  const parts = [`### ${now()} — ${sid}`];
  if (entry.summary) parts.push(`- Summary: ${entry.summary}`);
  if (entry.topFiles && entry.topFiles.length > 0)
    parts.push(`- Files: ${entry.topFiles.join(", ")}`);
  if (entry.tasks && entry.tasks.length > 0)
    parts.push(`- Tasks: ${entry.tasks.join(", ")}`);
  if (entry.commits && entry.commits.length > 0)
    parts.push(`- Commits: ${entry.commits.join(", ")}`);

  let content = "";
  if (isNew) {
    content = `# ${today()}\n\n${parts.join("\n")}\n`;
  } else {
    content = `\n${parts.join("\n")}\n`;
  }

  fs.appendFileSync(filePath, content, "utf8");
}

/**
 * Read today's daily log file content.
 * Returns empty string if no log exists for today.
 *
 * @param {string} memoryDir - Base memory directory
 * @returns {string} Log content or empty string
 */
export function readTodayLog(memoryDir) {
  const filePath = logPath(memoryDir);
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}
