/**
 * Files to copy from the harness source repo into the target project at install
 * time. Split by category so install.sh / install.ps1 can branch on copy
 * strategy (rsync vs cp vs PowerShell Copy-Item) per category if needed.
 */
export declare const COPY_MANIFEST: {
    readonly rules: readonly [".claude/rules/**/*.md"];
    readonly plugin_components: {
        readonly agents: ".claude/agents/*.md";
        readonly commands: ".claude/commands/*.md";
        readonly skills: ".claude/skills/*/SKILL.md";
        readonly hooks: readonly [".claude/hooks/scripts/*.js", ".claude/hooks/pattern-definitions.json"];
    };
    readonly runtime: readonly ["dist/scripts/lib/**/*.js", "scripts/lib/schema.sql", "scripts/lib/evolve-generate-templates/*.md"];
    readonly skip: readonly [".claude/settings.local.json", ".claude/agent-memory/**", "node_modules/**", "tests/**", "docs/**"];
};
/**
 * Canonical permissions.deny rules merged into every target's
 * .claude/settings.json by install.sh / install.ps1 (per ADR-010 Q4). Extracted
 * verbatim from the harness's own .claude/settings.json so the harness eats its
 * own dog food — what we forbid for ourselves is what we forbid for targets.
 *
 * Edit policy: add a new rule here AND to .claude/settings.json so the two stay
 * in sync. Sprint E adds `npx tsx scripts/verify-permissions-sync.ts` as a drift
 * check (ADR-021).
 *
 * Path note: `Read(/c/Users/kadmo/.ssh/**)` was removed in ADR-021 Q2. Claude
 * Code defaults to ASK for Read() outside the project root, so ~/.ssh/** is
 * already gated without an explicit deny. The hardcoded Git-Bash path leaked
 * maintainer identity ("kadmon") into every collaborator's settings.json.
 * If explicit deny is needed in the future, verify tilde-expansion semantics via
 * docs.claude.com before adding `Read(~/.ssh/**)`.
 */
export declare const CANONICAL_DENY_RULES: readonly ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)", "Bash(wget:*)", "Bash(nc:*)", "Bash(ncat:*)", "Bash(ssh:*)", "Bash(scp:*)", "Bash(git push --force:*)", "Bash(git push -f:*)", "Bash(git reset --hard:*)", "Bash(rm -rf /:*)", "Bash(rm -rf /*:*)", "Bash(> .env:*)"];
/**
 * Canonical permissions.allow rules merged into every target's
 * .claude/settings.json by install.sh / install.ps1 (ADR-021 Q1).
 *
 * This is the CORE subset of 9 items — the intersection of tools used by every
 * harness-based project (git/npm/node toolchain + shell navigation + Skill
 * dispatch for plugins). The full harness allow list (63+ items) is NOT merged
 * because many entries are project-specific (yt-dlp for /skavenger, ElevenLabs
 * WebFetch for KAIRON, Context7 MCP for harness-only use). Copying all 63
 * violates least-privilege for projects that never use those tools.
 *
 * Edit policy: add a new rule here AND to .claude/settings.json so the two stay
 * in sync. Sprint E adds `npx tsx scripts/verify-permissions-sync.ts` as a drift
 * check for both allow and deny arrays (ADR-021).
 */
export declare const CANONICAL_ALLOW_RULES: readonly ["Bash(git:*)", "Bash(npm:*)", "Bash(npx:*)", "Bash(node:*)", "Bash(cd:*)", "Bash(ls:*)", "Bash(pwd:*)", "Bash(which:*)", "Skill(*:*)"];
