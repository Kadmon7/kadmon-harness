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
 * in sync. Sprint E adds `npx tsx scripts/verify-deny-sync.ts` as a drift check.
 *
 * Path note: `Read(/c/Users/kadmo/.ssh/**)` is a Git-Bash absolute path that
 * only matches on the maintainer's Windows machine. It is intentionally kept
 * verbatim — Mac collaborators (Joe/Eden) get a no-op rule and no false-deny;
 * adding a portable equivalent is Sprint E scope (`~/.ssh/**` syntax).
 */
export declare const CANONICAL_DENY_RULES: readonly ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)", "Read(/c/Users/kadmo/.ssh/**)", "Bash(wget:*)", "Bash(nc:*)", "Bash(ncat:*)", "Bash(ssh:*)", "Bash(scp:*)", "Bash(git push --force:*)", "Bash(git push -f:*)", "Bash(git reset --hard:*)", "Bash(rm -rf /:*)", "Bash(rm -rf /*:*)", "Bash(> .env:*)"];
