#!/usr/bin/env node
// Hook: commit-format-guard | Trigger: PreToolUse (Bash)
// Purpose: Block git commits that don't follow conventional commit format. Exit 2 on violation.
import { parseStdin, isDisabled } from "./parse-stdin.js";
import { logHookEvent } from "./log-hook-event.js";

const TYPES = "feat|fix|docs|chore|refactor|test|style|perf";
const PATTERN = new RegExp(`^(${TYPES})(\\(.+\\))?: .+`);

try {
  if (isDisabled("commit-format-guard")) process.exit(0);
  const input = parseStdin();
  const cmd = input.tool_input?.command ?? "";

  // Only check git commit with -m flag
  if (!cmd.includes("git commit") || !cmd.includes("-m")) process.exit(0);

  // Extract message: handle both "msg" and HEREDOC $(cat <<'EOF'\ntype: msg\n...)
  let msg = "";

  if (cmd.includes("<<")) {
    // HEREDOC format: split by newlines, find first non-empty line after <<EOF
    const eofIdx = cmd.search(/<<'?EOF'?/);
    if (eofIdx !== -1) {
      const afterEof = cmd.slice(eofIdx);
      const lines = afterEof.split(/\\n|\n/).map((l) => l.trim());
      // First non-empty line after the <<EOF marker is the commit message
      msg =
        lines.find(
          (l, i) => i > 0 && l && !l.startsWith("EOF") && !l.startsWith(")"),
        ) ?? "";
    }
  } else {
    // Standard format: git commit -m "type: msg" or -m 'type: msg'
    const msgMatch = cmd.match(/git commit.*-m\s+["']([^"']+)["']/);
    if (msgMatch) msg = msgMatch[1].trim();
  }

  if (!msg) process.exit(0); // Can't parse message (e.g., --amend), allow

  if (!PATTERN.test(msg)) {
    const error = `conventional commit format required. Got: "${msg}"`;
    logHookEvent(input.session_id, {
      hookName: "commit-format-guard",
      eventType: "pre_tool",
      toolName: "Bash",
      exitCode: 2,
      blocked: true,
      error,
    });
    console.error(
      JSON.stringify({
        block: true,
        message: `\u{1F6AB} conventional commit format required: type(scope): description\nTypes: ${TYPES}\nGot: "${msg}"`,
      }),
    );
    process.exit(2);
  }
} catch (err) {
  console.error(
    JSON.stringify({ error: `commit-format-guard: ${err.message}` }),
  );
}
process.exit(0);
