// Agent frontmatter linter CLI.
// Usage: npx tsx scripts/lint-agent-frontmatter.ts
// Wired into /medik as a harness-health check; exits 1 on any violation.
import { lintAgentFrontmatter } from "./lib/lint-agent-frontmatter.js";
const result = lintAgentFrontmatter({
    agentsDir: ".claude/agents",
    skillsDir: ".claude/skills",
});
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
