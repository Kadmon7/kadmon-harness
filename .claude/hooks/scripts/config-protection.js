#!/usr/bin/env node
// Hook: config-protection | Trigger: PreToolUse (Edit|Write)
// Purpose: Block weakening of linter/compiler configs
import fs from 'node:fs';
import path from 'node:path';
const PROTECTED = ['.eslintrc', '.prettierrc', 'tsconfig.json', '.eslintignore'];
const DANGEROUS = [
  { re: /"strict"\s*:\s*false/, msg: 'Disabling strict mode' },
  { re: /"noImplicitAny"\s*:\s*false/, msg: 'Disabling noImplicitAny' },
  { re: /:\s*("off"|0)\s*[,}\]]/, msg: 'Disabling lint rules' },
];
try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const filePath = input.tool_input?.file_path ?? '';
  const content = input.tool_input?.content ?? input.tool_input?.new_string ?? '';
  const fileName = path.basename(filePath);
  if (!PROTECTED.some(f => fileName.startsWith(f))) process.exit(0);
  for (const { re, msg } of DANGEROUS) {
    if (re.test(content)) {
      console.error(JSON.stringify({ block: true, message: `config-protection: ${msg} in ${fileName}` }));
      process.exit(2);
    }
  }
  if (/"skipLibCheck"\s*:\s*true/.test(content)) console.log(`Warning: skipLibCheck=true in ${fileName}`);
} catch (err) { console.error(JSON.stringify({ error: `config-protection: ${err.message}` })); }
process.exit(0);
