#!/usr/bin/env node
// Hook: commit-format-guard | Trigger: PreToolUse (Bash)
// Purpose: Block git commits that don't follow conventional commit format. Exit 2 on violation.
import { parseStdin } from "./parse-stdin.js";

const TYPES = "feat|fix|docs|chore|refactor|test|style|perf";
const PATTERN = new RegExp(`^(${TYPES})(\\(.+\\))?: .+`);

try {
  const input = parseStdin();
  const cmd = input.tool_input?.command ?? "";

  // Only check git commit with -m flag
  if (!cmd.includes("git commit") || !cmd.includes("-m")) process.exit(0);

  // Extract message: handle both "msg" and HEREDOC $(cat <<'EOF'\ntype: msg\n...)
  let msg = "";

  // HEREDOC format: git commit -m "$(cat <<'EOF'\nfeat: ...\n...EOF\n)"
  const heredocMatch = cmd.match(/<<'?EOF'?\s*[\n\\n]+(.+?)[\n\\n]/);
  if (heredocMatch) {
    msg = heredocMatch[1].trim();
  } else {
    // Standard format: git commit -m "type: msg" or -m 'type: msg'
    const msgMatch = cmd.match(/git commit.*-m\s+["']([^"']+)["']/);
    if (msgMatch) msg = msgMatch[1].trim();
  }

  if (!msg) process.exit(0); // Can't parse message (e.g., --amend), allow

  if (!PATTERN.test(msg)) {
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
