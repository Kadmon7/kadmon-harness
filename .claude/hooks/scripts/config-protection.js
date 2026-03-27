#!/usr/bin/env node
// Hook: config-protection | Trigger: PreToolUse (Edit|Write)
// Purpose: Block weakening of linter/compiler configs
import fs from "node:fs";
import path from "node:path";
import { parseStdin, wasTruncated } from "./parse-stdin.js";
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
const DANGEROUS = [
  { re: /"strict"\s*:\s*false/, msg: "Disabling strict mode" },
  { re: /"noImplicitAny"\s*:\s*false/, msg: "Disabling noImplicitAny" },
  { re: /:\s*("off"|0)\s*[,}\]]/, msg: "Disabling lint rules" },
];
try {
  const input = parseStdin();
  // Block on truncated input — attacker could bypass by overflowing stdin
  if (wasTruncated(input)) {
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
  for (const { re, msg } of DANGEROUS) {
    if (re.test(content)) {
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
    console.log(`\u{26A0}\u{FE0F} skipLibCheck=true in ${fileName}`);
} catch (err) {
  console.error(JSON.stringify({ error: `config-protection: ${err.message}` }));
}
process.exit(0);
