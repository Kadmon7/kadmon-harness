// Manifest declarations consumed by install.sh / install.ps1 (plan-010 Phase 3).
// Glob-based, never hardcoded counts (per ADR-010 Implementation Notes — Sprint D
// shipped in parallel with ADR-009 / plan-015, so file counts may drift between
// planning and install time).

/**
 * Files to copy from the harness source repo into the target project at install
 * time. Split by category so install.sh / install.ps1 can branch on copy
 * strategy (rsync vs cp vs PowerShell Copy-Item) per category if needed.
 */
export const COPY_MANIFEST = {
  // Copied by install.sh (the rules gap — plugins cannot distribute these per
  // ADR-010 §"Converging evidence", almanak verification 2026-04-14).
  rules: [".claude/rules/**/*.md"],

  // Shipped by the plugin via canonical root symlinks (ADR-019, plan-019):
  // `./agents`, `./skills`, `./commands` at the repo root are symlinks to
  // `.claude/<type>/`. Claude Code's plugin loader auto-discovers from these
  // canonical paths (plugin.json no longer declares custom paths).
  // install.sh does NOT copy these — they ride the plugin distribution path
  // (${CLAUDE_PLUGIN_ROOT}).
  plugin_components: {
    agents: ".claude/agents/*.md",
    commands: ".claude/commands/*.md",
    skills: ".claude/skills/*/SKILL.md",
    hooks: [
      ".claude/hooks/scripts/*.js",
      ".claude/hooks/pattern-definitions.json",
    ],
  },

  // Runtime dependencies shipped via plugin dist/ (Q1 decision: pre-built JS).
  runtime: [
    "dist/scripts/lib/**/*.js",
    "scripts/lib/schema.sql",
    "scripts/lib/evolve-generate-templates/*.md",
  ],

  // NEVER distributed to targets.
  skip: [
    ".claude/settings.local.json",
    ".claude/agent-memory/**",
    "node_modules/**",
    "tests/**",
    "docs/**",
  ],
} as const;

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
export const CANONICAL_DENY_RULES = [
  "Read(./.env)",
  "Read(./.env.*)",
  "Read(./secrets/**)",
  "Read(/c/Users/kadmo/.ssh/**)",
  "Bash(wget:*)",
  "Bash(nc:*)",
  "Bash(ncat:*)",
  "Bash(ssh:*)",
  "Bash(scp:*)",
  "Bash(git push --force:*)",
  "Bash(git push -f:*)",
  "Bash(git reset --hard:*)",
  "Bash(rm -rf /:*)",
  "Bash(rm -rf /*:*)",
  "Bash(> .env:*)",
] as const;
