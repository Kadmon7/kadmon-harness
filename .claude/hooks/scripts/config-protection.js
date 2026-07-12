#!/usr/bin/env node
// Hook: config-protection | Trigger: PreToolUse (Edit|Write)
// Purpose: Block weakening of linter/compiler configs
import fs from "node:fs";
import path from "node:path";
import { parseStdin, wasTruncated, isDisabled } from "./parse-stdin.js";
import { logHookEvent } from "./log-hook-event.js";
const PROTECTED = [
  ".eslintrc",
  ".prettierrc",
  "tsconfig.json",
  ".eslintignore",
  "biome.json",
  ".prettierignore",
  ".editorconfig",
  "vitest.config",
  "eslint.config",
];
// Extracts the brace-balanced body following a single key-match position
// (e.g. `rules: {` or `"rules": {`), so a nested object value (e.g. a
// rule's array-of-options `["error", {...}]`) does not prematurely
// terminate the scan the way a single `[^}]*` regex would.
//
// String-literal-aware: braces inside a double-quoted string value (e.g.
// a "desc" field containing a literal `}`) are not counted, so a `}`
// character in string content cannot prematurely zero out depth and
// truncate the block before a later disabled rule in the same block.
// Backslash escapes are honored (`\"` does not end the string, `\\` is a
// literal backslash) so an escaped quote cannot flip inString incorrectly.
// This is a small heuristic scanner, not a full JS/JSON parser — it does
// NOT handle comments or template literals; scope is intentionally
// limited to double-quoted strings, which cover both JSON and the
// flat-config string values this hook inspects.
function extractBraceBlockAt(text, matchEnd) {
  let i = matchEnd;
  let depth = 1;
  let inString = false;
  let escaped = false;
  const start = i;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  return depth === 0 ? text.slice(start, i) : null;
}
// Extracts EVERY brace-balanced `rules: {...}` block in the text, not just
// the first. A config can legitimately contain multiple `rules:` blocks
// (ESLint v9 flat-config arrays with several config objects, or
// `.eslintrc` `overrides[]` entries) — checking only the first match lets a
// disabled rule hide in any later block.
function extractAllBraceBlocks(text, keyRe) {
  const blocks = [];
  for (const m of text.matchAll(keyRe)) {
    const block = extractBraceBlockAt(text, m.index + m[0].length);
    if (block !== null) blocks.push(block);
  }
  return blocks;
}
// Matches both quoted-JSON (`"rules":`) and ESLint v9 flat-config
// (unquoted `rules:`) key forms. Global so matchAll can find every
// occurrence, not just the first.
const RULES_KEY_RE = /["']?rules["']?\s*:\s*\{/g;
const DISABLED_VALUE_RE = /:\s*("off"|0)\s*[,}\]]/;
const DANGEROUS = [
  { re: /"strict"\s*:\s*false/, msg: "Disabling strict mode" },
  { re: /"noImplicitAny"\s*:\s*false/, msg: "Disabling noImplicitAny" },
  {
    // Only flag "off"/0 values for keys that are actually rule-severity or
    // linter-toggle settings — i.e. nested inside a "rules" block (ESLint
    // rule severities, isolated via brace-balanced extraction so nested
    // object values don't hide a later disabled rule), or the "enabled"
    // toggle used by biome-style linter configs. A blanket
    // `:\s*("off"|0)` match previously false-positived on any unrelated
    // key (e.g. "maxWarnings": 0, "retry": 0). Every "rules" block is
    // checked — not just the first — so a second block (flat-config
    // array entry, or an `.eslintrc` `overrides[]` entry) cannot hide a
    // disabled rule.
    test: (content) => {
      const rulesBlocks = extractAllBraceBlocks(content, RULES_KEY_RE);
      if (rulesBlocks.some((block) => DISABLED_VALUE_RE.test(block)))
        return true;
      return /"enabled"\s*:\s*("off"|false|0)\s*[,}\]]/.test(content);
    },
    msg: "Disabling lint rules",
  },
];
try {
  if (isDisabled("config-protection")) process.exit(0);
  const start = Date.now();
  let input;
  try {
    input = parseStdin();
  } catch (parseErr) {
    console.error(
      JSON.stringify({
        error: `config-protection: failed to parse stdin — ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      }),
    );
    process.exit(2);
  }
  // Block on truncated input — attacker could bypass by overflowing stdin
  if (wasTruncated(input)) {
    logHookEvent(input.session_id, {
      hookName: "config-protection",
      eventType: "pre_tool",
      toolName: input.tool_name,
      exitCode: 2,
      blocked: true,
      durationMs: Date.now() - start,
      error: "stdin truncated",
    });
    console.error(
      JSON.stringify({
        block: true,
        message:
          "\u{1F6AB} config-protection: stdin truncated — cannot verify safety",
      }),
    );
    process.exit(2);
  }
  const filePath = input.tool_input?.file_path ?? "";
  const content =
    input.tool_input?.content ?? input.tool_input?.new_string ?? "";
  const fileName = path.basename(filePath);
  if (!PROTECTED.some((f) => fileName.startsWith(f))) process.exit(0);
  for (const { re, test, msg } of DANGEROUS) {
    if (test ? test(content) : re.test(content)) {
      logHookEvent(input.session_id, {
        hookName: "config-protection",
        eventType: "pre_tool",
        toolName: input.tool_name,
        exitCode: 2,
        blocked: true,
        durationMs: Date.now() - start,
        error: `${msg} in ${fileName}`,
      });
      console.error(
        JSON.stringify({
          block: true,
          message: `\u{1F6AB} config-protection: ${msg} in ${fileName}`,
        }),
      );
      process.exit(2);
    }
  }
  if (/"skipLibCheck"\s*:\s*true/.test(content))
    console.error(`\u{26A0}\u{FE0F} skipLibCheck=true in ${fileName}`);
} catch (err) {
  console.error(
    JSON.stringify({
      error: `config-protection: ${err instanceof Error ? err.message : String(err)}`,
    }),
  );
}
process.exit(0);
