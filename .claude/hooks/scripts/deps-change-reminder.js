#!/usr/bin/env node
// Hook: deps-change-reminder | Trigger: PostToolUse (Edit|Write)
// Purpose: Remind to run /almanak when dependency manifests change
//   package.json     → warn only when dependency sections change
//   pyproject.toml   → warn only when dependencies/[tool.*.dependencies] change
//   requirements.txt → warn on any edit (file is deps-only by convention)
// Exit 1 (warning) on match, exit 0 otherwise.
import path from "node:path";
import { parseStdin, isDisabled } from "./parse-stdin.js";
import { logHookEvent } from "./log-hook-event.js";

const PKG_JSON_DEPS = /"(?:dependencies|devDependencies|peerDependencies|optionalDependencies)"/i;
const PYPROJECT_DEPS = /^\s*dependencies\s*=|\[[^\]]*\.dependencies\]|\[project\.optional-dependencies\]/im;

function classifyManifest(filePath) {
  const base = path.basename(filePath);
  if (base === "package.json") return "package.json";
  if (base === "pyproject.toml") return "pyproject.toml";
  if (base === "requirements.txt") return "requirements.txt";
  return null;
}

try {
  if (isDisabled("deps-change-reminder")) process.exit(0);
  const start = Date.now();
  const input = parseStdin();
  const filePath = input.tool_input?.file_path ?? "";
  if (!filePath) process.exit(0);

  const kind = classifyManifest(filePath);
  if (!kind) process.exit(0);

  const content = input.tool_input?.new_string ?? input.tool_input?.content ?? "";

  let shouldWarn = false;
  if (kind === "package.json") {
    shouldWarn = PKG_JSON_DEPS.test(content);
  } else if (kind === "pyproject.toml") {
    shouldWarn = PYPROJECT_DEPS.test(content);
  } else if (kind === "requirements.txt") {
    // Any edit to requirements.txt is a dependency change by definition
    shouldWarn = true;
  }

  if (!shouldWarn) process.exit(0);

  logHookEvent(input.session_id, {
    hookName: "deps-change-reminder",
    eventType: "post_tool",
    toolName: input.tool_name,
    exitCode: 1,
    blocked: false,
    durationMs: Date.now() - start,
    error: `${kind} deps modified`,
  });
  console.error(
    JSON.stringify({
      warn: true,
      message: `${kind} modified. If dependency versions changed, run /almanak <library> breaking changes before committing.`,
    }),
  );
  process.exit(1);
} catch (err) {
  console.error(
    JSON.stringify({ error: `deps-change-reminder: ${err instanceof Error ? err.message : String(err)}` }),
  );
}
process.exit(0);
