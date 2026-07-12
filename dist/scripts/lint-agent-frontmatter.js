// Agent frontmatter linter CLI.
// Usage: npx tsx scripts/lint-agent-frontmatter.ts [--agents-dir <path>] [--skills-dir <path>]
// Defaults to the harness-local layout (.claude/agents / .claude/skills).
// Consumer repos (via /medik Check #8) pass explicit dirs so the linter can
// run from the harness install root against the consumer's .claude/ tree.
// Wired into /medik as a harness-health check; exits 1 on any violation,
// 2 on usage errors.
import { lintAgentFrontmatter, parseLintCliArgs, } from "./lib/lint-agent-frontmatter.js";
let options;
try {
    options = parseLintCliArgs(process.argv.slice(2));
}
catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    console.error("Usage: npx tsx scripts/lint-agent-frontmatter.ts [--agents-dir <path>] [--skills-dir <path>]");
    process.exit(2);
}
const result = lintAgentFrontmatter(options);
console.log(`Agent frontmatter linter — checked ${result.filesChecked} files`);
if (result.ok) {
    console.log("  OK — all declared skills parse as YAML lists and exist.");
    process.exit(0);
}
console.log(`  FAIL — ${result.violations.length} violation(s):`);
for (const v of result.violations) {
    console.log(`    [${v.file}] ${v.message}`);
}
process.exit(1);
