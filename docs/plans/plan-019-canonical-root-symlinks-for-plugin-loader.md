---
number: 19
title: Canonical Root Symlinks for Plugin Loader
date: 2026-04-20
status: completed
needs_tdd: true
route: A
adr: ADR-019-canonical-root-symlinks-for-plugin-loader.md
---

## Plan: Canonical Root Symlinks for Plugin Loader [konstruct]

### Overview

Execute ADR-019 by creating three canonical root symlinks (`./agents`, `./skills`, `./commands`) that resolve into `.claude/<type>/`, so Claude Code's plugin loader finds all 16 agents + 46 skills + 11 commands at its expected default paths without any physical reorganization. This plan supersedes the pre-research Decision B ("install.sh copy fallback") and inserts BEFORE plan-010 Phase 4, narrowing that phase's scope to rules + `permissions.deny` + `.kadmon-version` only. Shipping architecture becomes plugin-first correct; `install.sh` scope shrinks by ~60%.

### Assumptions

- **ADR-019 is accepted** — validated by reading `docs/decisions/ADR-019-canonical-root-symlinks-for-plugin-loader.md` (status: `accepted`, date: 2026-04-20).
- **Self-use layout is `.claude/<type>/`** — validated by existing 609 passing tests asserting on `.claude/agents/`, `.claude/skills/`, `.claude/commands/`. Symlinks at root add a second access path without removing the first.
- **Claude Code plugin loader auto-discovers from `./agents/`, `./skills/`, `./commands/`** when those fields are omitted from `plugin.json` — validated by the verbatim quote from `code.claude.com/docs/en/plugins-reference` cited in ADR-019 §Research evidence and by the almanak agent's live-doc fetch on 2026-04-20.
- **Symlinks are preserved end-to-end in the plugin cache** — verbatim: *"Symlinks are preserved in the cache rather than dereferenced, and they resolve to their target at runtime."* This is the load-bearing fact for Option B.
- **Current `plugin.json` declares `commands` and `skills` but not `agents`** — validated by reading `.claude-plugin/plugin.json` (7 fields: name, version, description, author, license, commands, skills, hooks).
- **`tests/plugin/manifest-schema.test.ts` has 11 `it(...)` cases today** — validated by reading the file. Tests 4-5 assert that `plugin.json.commands`/`skills` fields exist and match directory-style patterns; those assertions must be removed. Tests 6 + 3 assert on disk presence and can stay. Test 11's script-path regex is unaffected.
- **Windows Developer Mode + `core.symlinks = true`** is ON on the development machine (symlinks creatable and resolvable). If not, Phase A.2 halts with a clear error and the user toggles Developer Mode + `git config --global core.symlinks true` before retrying. Mac has zero setup cost.
- **Parallel sessions may be editing elsewhere** — before any destructive-looking step (file delete, revert, etc.), pause and confirm. Plan is additive; no deletes needed.
- **`scripts/lib/install-manifest.ts` exists and exports `COPY_MANIFEST` and `CANONICAL_DENY_RULES`** — validated by plan-010 Step 3.3. Phase C.4 narrows `COPY_MANIFEST` to remove agents/skills/commands categories.
- **`tests/lib/install-manifest.test.ts` exists with ≥ 3 assertions on `COPY_MANIFEST` structure** — validated by plan-010 Step 3.3 (test existence; actual content depends on plan-010 phase-3 shipping state). Phase C.5 adjusts if present; skips if absent.

### Phase 0: Research (complete)

Research is ADR-019. The four convergent research agents' evidence, the user's plugin-first rejection of Decision B, and the verbatim plugins-reference quote are all recorded there. No additional reading required for this plan.

- [x] Read `docs/decisions/ADR-019-canonical-root-symlinks-for-plugin-loader.md`
- [x] Read `C:\Users\kadmo\.claude\plans\eager-sniffing-pizza.md` (superseded draft, used for scope reference only)
- [x] Read `docs/plans/plan-010-harness-distribution-hybrid.md` (parent Sprint D plan; Phase 4 scope changes)
- [x] Read `docs/plans/plan-017-agent-template-system.md` (format reference)
- [x] Read `tests/plugin/manifest-schema.test.ts` (11 existing cases; assertions at tests 4-5 must change)
- [x] Read `.claude-plugin/plugin.json` (current state: `commands`, `skills`, `hooks` fields; no `agents` field)

### Phase A: Symlinks + plugin.json cleanup (TDD for schema test update)

**Goal**: create the three canonical root symlinks, drop the `commands` and `skills` fields from `plugin.json`, update the schema test to match the new contract. Single-phase commit, independently mergeable without Phase B/C. All 709+ tests remain green.

- [ ] Step A.1: Update `tests/plugin/manifest-schema.test.ts` — red step (M)
  - File: `tests/plugin/manifest-schema.test.ts`
  - Changes (all in one edit pass):
    1. **Test 2** — drop the `expect(typeof manifest.commands).toBe("string")` and `expect(typeof manifest.skills).toBe("string")` lines (and the corresponding `toMatch(/^\.\//)` assertions). Retain `name`, `version`, `description`, `hooks` assertions. Update the description comment to explain: "per ADR-019, commands + skills fields removed from plugin.json; loader auto-discovers from canonical root paths (`./commands`, `./skills`) which are symlinks into `.claude/<type>/`".
    2. **Test 4** — the `manifest.commands` read + `toMatch` can go, OR replace with a direct disk read: `expect(countGlob2(COMMANDS_DIR, ".md")).toBeGreaterThanOrEqual(11)` AND `expect(fs.lstatSync(path.join(REPO_ROOT, "commands")).isSymbolicLink()).toBe(true)`. Keep test name but update description.
    3. **Test 5** — same pattern: remove `manifest.skills` read; replace with disk-read + symlink existence check at `skills`. Assert `countGlob3(SKILLS_BASE_DIR, "SKILL.md") >= 40` AND `fs.lstatSync(path.join(REPO_ROOT, "skills")).isSymbolicLink()`.
    4. **NEW test (slot after test 6)** — "canonical root symlinks exist and resolve to `.claude/<type>/`":
       ```ts
       it("canonical root symlinks exist and resolve to .claude/<type>/ per ADR-019", () => {
         for (const type of ["agents", "skills", "commands"] as const) {
           const linkPath = path.join(REPO_ROOT, type);
           const targetPath = path.join(REPO_ROOT, ".claude", type);
           const stat = fs.lstatSync(linkPath);
           expect(stat.isSymbolicLink(), type + " must be a symlink").toBe(true);
           const resolved = fs.realpathSync(linkPath);
           const expectedResolved = fs.realpathSync(targetPath);
           expect(resolved).toBe(expectedResolved);
         }
       });
       ```
    5. **Update `PluginJson` interface** — remove `commands?: string` and `skills?: string`. The interface stays but is narrower (only `hooks?: string` as a component path).
  - Verify: `npx vitest run tests/plugin/manifest-schema.test.ts` — the existing tests 4-5 FAIL (they still read `manifest.commands`/`skills` which are undefined after Step A.3); the new symlink-existence test FAILS (symlinks don't exist yet). This is the RED step.
  - Depends on: Phase 0 research complete.
  - Risk: Low — edits are within a single test file. No production code touched.

- [ ] Step A.2: Create three root symlinks (S)
  - Files: `agents` → `.claude/agents`, `skills` → `.claude/skills`, `commands` → `.claude/commands` (all at repo root, NEW)
  - Commands (from repo root, Git Bash):
    ```bash
    cd /c/Command-Center/Kadmon-Harness
    ln -s .claude/agents agents
    ln -s .claude/skills skills
    ln -s .claude/commands commands
    ```
  - Verify (mechanical):
    ```bash
    test -L agents && echo "agents OK" || echo "agents FAIL"
    test -L skills && echo "skills OK" || echo "skills FAIL"
    test -L commands && echo "commands OK" || echo "commands FAIL"
    ls agents/ | wc -l       # expect 16
    ls skills/ | wc -l       # expect 46
    ls commands/ | wc -l     # expect 11
    ```
  - Verify (git sees symlinks, not copies): `git status` — the three entries should appear as new symlinks (mode 120000), not as new directories with all their children. `git ls-files -s agents skills commands` after adding should show `120000` at the start of each line.
  - Depends on: A.1 (red test confirmed).
  - Risk: Medium on Windows. If `core.symlinks = false` OR Developer Mode OFF, `ln -s` creates a hardlink or text file instead of a symlink, and git commits a non-symlink blob. If A.2's verify step shows `test -L` returning false, STOP. Toggle Developer Mode and run `git config --global core.symlinks true`, then delete the three entries and re-run. Confirm `test -L` passes before proceeding to A.3.

- [ ] Step A.3: Prune `commands` + `skills` from `.claude-plugin/plugin.json` (S)
  - File: `.claude-plugin/plugin.json`
  - Action: remove the two lines `"commands": "./.claude/commands/"` and `"skills": "./.claude/skills/"`. Retain `name`, `version`, `description`, `author`, `license`, `hooks`. The file goes from 7 visible fields to 6.
  - Final shape:
    ```json
    {
      "name": "kadmon-harness",
      "version": "1.1.0",
      "description": "Claude Code's operative layer — agents, commands, skills, and hooks distributed via plugin (ADR-019 canonical root symlinks); rules and permissions distributed via install.sh/install.ps1 bootstrap (ADR-010).",
      "author": { "name": "Kadmon7" },
      "license": "UNLICENSED",
      "hooks": "./.claude-plugin/hooks.json"
    }
    ```
  - Note: the `description` field is updated to reference ADR-019 so the supersede relationship is self-documenting.
  - Verify: `npx tsx -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json', 'utf8'))))"` — **caveat: `npx tsx -e` is broken on Windows per CLAUDE.md pitfall.** Use instead: `node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))))"` or simply `cat .claude-plugin/plugin.json` and visually confirm `commands` and `skills` are absent. JSON must still parse.
  - Depends on: A.2 (symlinks resolve so the plugin loader has somewhere to go when `commands`/`skills` fields are absent).
  - Risk: Low — two line removal.

- [ ] Step A.4: Add defensive symlink preservation lines to `.gitattributes` (S)
  - File: `.gitattributes`
  - Action: append three lines if not already present:
    ```
    agents symlink
    skills symlink
    commands symlink
    ```
  - Rationale (inline comment above the block): `# ADR-019: defensive — git auto-detects symlinks from mode 120000, but explicit markers protect against future .gitattributes edits accidentally coercing these to text.`
  - Note: these are belt-and-suspenders. Git defaults to detecting symlinks at mode 120000 regardless of `.gitattributes`. The explicit markers prevent a future contributor's `* text=auto` rule from inadvertently converting symlinks to text files.
  - Verify: `git check-attr symlink agents` should print `agents: symlink: set` after the edit. Also `git ls-files -s agents` should show `120000` as the mode.
  - Depends on: A.2 (symlinks exist), A.3 (manifest pruned — not strictly required but groups related changes).
  - Risk: Low.

- [ ] Step A.5: Run full test suite — green step (S)
  - Action: run the schema test in isolation first, then the full suite.
  - Commands:
    ```bash
    npx vitest run tests/plugin/manifest-schema.test.ts
    npx vitest run
    ```
  - Verify: schema test is green (test 1 still passes; tests 2-6 pass with new contract; new symlink-existence test passes; tests 7-11 unchanged and green). Full suite: 709 tests (baseline 709 per CLAUDE.md/memory post-plan-018) + 1 new symlink-existence test = **710 passing / 710 total**. Zero regressions.
  - If a legacy test elsewhere in the suite coincidentally depends on `plugin.json.commands` or `plugin.json.skills` being present, that test also needs update in A.1 — but this would surface here and not before. Unlikely (no grep match found in reconnaissance).
  - Depends on: A.1 (test updates), A.2 (symlinks), A.3 (manifest pruned), A.4 (gitattributes).
  - Risk: Low — regression catches are the point.

- [ ] Step A.6: Run `npm run build` (S)
  - Action: `npm run build`
  - Verify: clean `tsc` output, no new errors. `dist/` regenerates but no meaningful diff (symlinks aren't in `scripts/lib/`; `plugin.json` isn't TypeScript).
  - Depends on: A.5.
  - Risk: Low.

**Phase A completion criteria**
- [ ] Three root symlinks exist (`agents`, `skills`, `commands`) resolving into `.claude/<type>/`.
- [ ] `.claude-plugin/plugin.json` has 6 fields, no `commands` or `skills`.
- [ ] `.gitattributes` contains explicit symlink markers.
- [ ] `tests/plugin/manifest-schema.test.ts` has 12 tests (11 existing + 1 new symlink-existence), all passing.
- [ ] Full suite: 710/710 green.
- [ ] `npx tsc --noEmit` → 0 errors.
- [ ] `npm run build` → clean.

### Phase B: Re-dogfood mini-validation (MANUAL, single session, ~15 min)

**Goal**: prove the plugin loader sees 16 agents + 46 skills + 11 commands when installed via `/plugin install` against the new symlink layout. No code changes in this phase — it's a verification gate that blocks Phase C until Phase A works in the wild, not just in tests.

- [ ] Step B.1: Reinstall the plugin locally (S, manual)
  - Action: open a fresh Claude Code session from a directory OTHER than the harness repo (so the local-directory auto-load doesn't interfere). From inside Claude Code, run:
    ```
    /plugin marketplace remove kadmon-harness
    /plugin marketplace add C:/Command-Center/Kadmon-Harness
    /plugin install kadmon-harness@kadmon-harness
    /reload-plugins
    ```
  - If any command reports an error, STOP and capture the error text. Root-cause immediately (most likely symlink resolution issue on the plugin cache side OR a stale cache — try `/plugin marketplace remove kadmon-harness` again + clear `~/.claude/plugins/cache/kadmon-harness/` manually).
  - Verify: each command returns a success indicator. `/reload-plugins` should confirm "kadmon-harness reloaded" or equivalent.
  - Depends on: A.6 (code state committed OR at least staged; the plugin cache copies from working tree for a local marketplace).
  - Risk: Medium — first time the symlink approach meets the plugin cache materialization. Expected to work per ADR-019's verbatim spec quote; if it fails, that's a Claude Code bug and triggers the escalation path in B.3.

- [ ] Step B.2: Verify loader output (S, manual)
  - Action: inside the same Claude Code session, run:
    ```
    /agents
    /skills
    /commands
    ```
  - Verify:
    - `/agents` lists **exactly 16** agents (names: alchemik, almanak, arkitect, arkonte, doks, feniks, kartograf, kody, konstruct, kurator, mekanik, orakle, python-reviewer, skavenger, spektr, typescript-reviewer).
    - `/skills` lists **exactly 46** skills. Match against the source count via `ls .claude/skills/ | wc -l` before the session to capture the expected number.
    - `/commands` lists **exactly 11** commands (names: abra-kdabra, almanak, chekpoint, doks, evolve, forge, kadmon-harness, kompact, medik, skanner, skavenger).
  - Capture the exact counts output by each command in a note (commit message material for Phase D.2).
  - Depends on: B.1.
  - Risk: Low if B.1 succeeded.

- [ ] Step B.3: Gate — decide Phase C entry (S, judgment call)
  - If all three counts match (**16 / 46 / 11**): proceed to Phase C immediately.
  - If any count is **less than** expected: STOP. Per ADR-019 §Decision and §Risks, the no-fallback clause is explicit — do NOT fall back to Decision B copy-install. Instead:
    1. Capture: `/agents` output, `/skills` output, `/commands` output, and `ls ~/.claude/plugins/cache/kadmon-harness/kadmon-harness/1.1.0/` + symlink resolution (`readlink`) on the three root entries.
    2. Root-cause: most likely Windows `core.symlinks = false` propagating into the plugin cache materialization (cache treats symlinks as text files). Check with `ls -la ~/.claude/plugins/cache/kadmon-harness/kadmon-harness/1.1.0/` for the three entries' file types.
    3. Secondary suspects: plugin cache traversal limits on subdirectory depth (skills live at `<name>/SKILL.md` two levels deep via symlink); Claude Code silently dropping entries below a threshold; a regression in plugin loader symlink handling since the ADR-019 plugins-reference fetch on 2026-04-20.
    4. If root cause is clear, write a brief `docs/diagnostics/2026-04-20-symlink-loader-bug.md` capturing the evidence and proceed to open a GitHub issue against `anthropics/claude-code` per ADR-019 risk mitigation. Halt plan-019 pending response; do NOT ship Phase C.
  - Depends on: B.2.
  - Risk: Medium — if Windows environment has a silent symlink coercion, this is where it surfaces.

**Phase B completion criteria**
- [ ] `/plugin marketplace add` + `/plugin install` + `/reload-plugins` all succeed without error.
- [ ] `/agents` returns exactly 16 entries.
- [ ] `/skills` returns exactly 46 entries.
- [ ] `/commands` returns exactly 11 entries.
- [ ] Captured counts recorded in commit-message notes for Phase D.2.

### Phase C: Memory + plan-010 scope update (docs + small code edit)

**Goal**: update documentation to reflect the shipped architecture (Decision B superseded) and narrow plan-010 Phase 4 scope so the downstream work knows the new boundary. One small code change (`install-manifest.ts` category removal) + test adjustment.

- [ ] Step C.1: Update `memory/project_sprint_d_in_flight.md` (M)
  - File: `C:\Users\kadmo\.claude\projects\C--Command-Center-Kadmon-Harness\memory\project_sprint_d_in_flight.md`
  - Action: read current contents first. Mark the Decision B gap-by-gap table entries for agents and skills as **RESOLVED via ADR-019 + plan-019** with the date 2026-04-20. Keep the session-start banner entry (Bug 3) as Sprint E open item — ADR-019 §Consequences explicitly keeps that bug out of scope.
  - Add a short "Resolution" subsection at the top of the memory file:
    ```markdown
    ## Resolution (2026-04-20)
    Decision B superseded by ADR-019 + plan-019 (canonical root symlinks). Agents + skills bugs RESOLVED; Bug 3 (session-start banner in plugin mode) remains Sprint E. See ADR-019 and plan-019 for evidence and steps.
    ```
  - Verify: file grows by ~5-10 lines; existing content preserved; gap-by-gap table has updated markers.
  - Depends on: Phase B completed (dogfood validated).
  - Risk: Low — memory file edit, no runtime surface.

- [ ] Step C.2: Update `memory/project_plan_010_dogfood_findings.md` (S)
  - File: `C:\Users\kadmo\.claude\projects\C--Command-Center-Kadmon-Harness\memory\project_plan_010_dogfood_findings.md`
  - Action: read current contents first. Append a "2026-04-20 resolution" section pointing to ADR-019 + plan-019. Mark agents/skills bugs as **FIXED**.
  - Suggested section text:
    ```markdown
    ## 2026-04-20 resolution
    Bugs 1 (agents field rejected) + 2 (skills partial-load) FIXED via ADR-019 canonical root symlinks. plan-019 executed the fix. Plugin loader now sees 16/46/11 agents/skills/commands end-to-end. Bug 3 (session-start banner silent in plugin mode) remains Sprint E dependency on Claude Code `env` block support for `hooks.json`.
    ```
  - Verify: file has appended section; file still renders as valid markdown.
  - Depends on: Phase B completed.
  - Risk: Low.

- [ ] Step C.3: Narrow plan-010 Phase 4 description (M)
  - File: `docs/plans/plan-010-harness-distribution-hybrid.md`
  - Action: edit the Phase 4 header block (line 259) and Step 4.1-4.2 descriptions to narrow scope. Specifically:
    1. In the **Phase 4 intro paragraph**, add a sentence: "**As of 2026-04-20, plan-019 (ADR-019) removed agents/skills/commands from `install.sh` scope — they ship via the plugin loader through canonical root symlinks.** Phase 4 now handles only rules, `permissions.deny` merge, `.kadmon-version` marker, `extraKnownMarketplaces` + `enabledPlugins` write to user settings, and `.gitignore` additions."
    2. In **Step 4.1 cases**, remove or mark as superseded the cases that rely on agent/skill/command copy — specifically review cases 2 (rules copy, keep), 3 (settings merge, keep), 4 (preserves existing keys, keep), 5-6 (settings.local template, keep), 7 (.kadmon-version, keep), 8 (force-permissions-sync, keep), 9 (.gitignore, keep), 10 (HOOK_CMD_PREFIX rewrite, keep — hooks still go through install.sh for the placeholder substitution), 11 (paths with spaces, keep). There are no cases in the current draft that directly copy agents/skills/commands — those were deferred to Decision B which is now superseded.
    3. In **Step 4.2 install.sh flow**, flow items stay largely the same — the agent/skill/command copy sections were never added to plan-010 (they were the Decision B debt). Add a note at the top of Step 4.2: "**Scope note (2026-04-20)**: plan-019 removed the agents/skills/commands copy from this phase's charter. `install.sh` flow below reflects the narrowed scope. DO NOT add agent/skill/command copy to this script."
    4. Add a supersede-partial marker at the top of plan-010's frontmatter:
       ```yaml
       superseded_partial_by: plan-019-canonical-root-symlinks-for-plugin-loader.md
       supersede_note: "plan-019 removed agents/skills/commands from install.sh scope. Phase 4 narrowed to rules + permissions + marker + settings + gitignore. Hybrid philosophy (ADR-010) unchanged."
       ```
  - Verify: read back the edited plan-010; Phase 4 intro reflects narrowed scope; frontmatter has supersede marker.
  - Depends on: Phase B completed.
  - Risk: Medium — editing a long plan requires care not to drop existing content. Use single-location targeted edits rather than rewriting sections wholesale.

- [ ] Step C.4: Narrow `scripts/lib/install-manifest.ts` (M)
  - File: `scripts/lib/install-manifest.ts`
  - Action: first read the current file to understand the `COPY_MANIFEST` shape (plan-010 Step 3.3 describes it; the current state is whatever plan-010 Phase 3 has shipped to date — may be partial or complete). Two scenarios:
    - **Scenario A — `COPY_MANIFEST` exists with agents/skills/commands entries**: remove those entries. Retain rules + any runtime categories (e.g., if there's a category for hooks or settings-template files, keep them).
    - **Scenario B — `COPY_MANIFEST` does not yet exist or has no agents/skills/commands**: add a comment at the top of the file explaining the ADR-019 decision: `// ADR-019: agents, skills, commands ship via plugin loader through canonical root symlinks (./agents, ./skills, ./commands). install-manifest.ts scope covers only bootstrap-copied categories (rules, settings template, etc.). DO NOT add agents/skills/commands entries to COPY_MANIFEST.`
  - Preserve `CANONICAL_DENY_RULES` — unrelated.
  - Verify: `npx tsc --noEmit` clean; `npm run build` clean.
  - Depends on: C.3 (narrowing documented in plan-010 first so the code change has a paper trail).
  - Risk: Medium — depends on current file state; must read before editing.

- [ ] Step C.5: Adjust `tests/lib/install-manifest.test.ts` if present (S-M)
  - File: `tests/lib/install-manifest.test.ts` (may or may not exist — plan-010 Step 3.3 called for it but shipping state unknown)
  - Action:
    - **If file exists**: read it. If any assertion verifies presence of agents/skills/commands categories in `COPY_MANIFEST`, drop those assertions. If it only asserts `CANONICAL_DENY_RULES` is non-empty, no change needed. Confirm tests still pass.
    - **If file does not exist**: skip this step. Note in commit message that the test file was not present.
  - Verify: `npx vitest run tests/lib/install-manifest.test.ts` passes (or test file skip is documented).
  - Depends on: C.4.
  - Risk: Low — small test surface.

**Phase C completion criteria**
- [ ] `memory/project_sprint_d_in_flight.md` has resolution section marking Decision B superseded.
- [ ] `memory/project_plan_010_dogfood_findings.md` has 2026-04-20 resolution section.
- [ ] `docs/plans/plan-010-harness-distribution-hybrid.md` Phase 4 narrowed; frontmatter has `superseded_partial_by: plan-019-...`.
- [ ] `scripts/lib/install-manifest.ts` has no agents/skills/commands categories (or has the defensive comment if they were never added).
- [ ] `tests/lib/install-manifest.test.ts` adjusted if applicable.
- [ ] `npx vitest run` still green (710+ tests, no regression from Phase A).
- [ ] `npx tsc --noEmit` clean.

### Phase D: /chekpoint full + commit + push

**Goal**: ship the phase-A-B-C bundle through the full reviewer matrix and push to `sprint-d-distribution` branch.

- [ ] Step D.1: Run `/chekpoint full` (M)
  - Action: from inside the Claude Code session, run `/chekpoint full`.
  - Expected reviewers (per `rules/common/development-workflow.md` tier matrix — this diff touches production TS in `scripts/lib/`, markdown, tests, and `.claude-plugin/` config → **full tier**):
    - **ts-reviewer** — reviews `scripts/lib/install-manifest.ts` edit (Phase C.4) and the test file edits.
    - **spektr** — reviews `plugin.json` change (no new auth surface, but plugin distribution is a security-adjacent change) and symlink semantics (symlinks point only into repo subtree per ADR-019; spektr confirms no path-traversal escape).
    - **orakle** — minimal scope for this plan (no SQL/schema change) but runs because full-tier protocol.
    - **kody** — consolidates all reviewer output and enforces the `Reviewed: full` footer.
  - Verify: zero BLOCK findings. WARN findings addressed inline before commit. Kody writes a consolidated review summary.
  - Depends on: Phase A + B + C complete.
  - Risk: Medium — full chekpoint is where any overlooked issue surfaces. Mitigation is running it with slack in the schedule for one round of fixes.

- [ ] Step D.2: Commit with conventional format (S)
  - Action: stage all changes and commit with the following message body:
    ```
    feat(plugin): canonical root symlinks for loader compat (ADR-019)

    Resolves plugin loader discovery of agents, skills, and commands by
    creating three symlinks at the repo root that resolve into .claude/<type>/.
    Removes commands + skills fields from plugin.json so the loader falls back
    to its canonical paths (./agents, ./skills, ./commands), which are now
    symlinks populated from the existing .claude/<type>/ tree.

    Supersedes pre-research Decision B (install.sh copy fallback for
    agents + skills). Narrows plan-010 Phase 4 scope to rules +
    permissions.deny + .kadmon-version + settings + gitignore only.
    Plugin now ships 16 agents + 46 skills + 11 commands through the
    loader as confirmed by the 2026-04-20 re-dogfood.

    - Add three root symlinks: agents, skills, commands -> .claude/<type>/
    - Remove commands + skills fields from .claude-plugin/plugin.json
    - Add defensive symlink markers to .gitattributes
    - Update tests/plugin/manifest-schema.test.ts (12 cases; new symlink
      existence test; removed manifest-path assertions for dropped fields)
    - Narrow scripts/lib/install-manifest.ts COPY_MANIFEST scope
    - Narrow plan-010 Phase 4 description; add supersede marker in
      plan-010 frontmatter
    - Update memory/project_sprint_d_in_flight.md and
      memory/project_plan_010_dogfood_findings.md

    Bug 3 (session-start banner silent in plugin mode) remains Sprint E
    scope per ADR-019 out-of-scope clause.

    ADR: docs/decisions/ADR-019-canonical-root-symlinks-for-plugin-loader.md
    Plan: docs/plans/plan-019-canonical-root-symlinks-for-plugin-loader.md

    Reviewed: full
    ```
  - Verify: `git log -1` shows the commit with the `Reviewed: full` footer.
  - Depends on: D.1.
  - Risk: Low.

- [ ] Step D.3: Push to `sprint-d-distribution` branch (S)
  - Action: `git push origin sprint-d-distribution`.
  - Verify: `gh pr view --json state` (or equivalent) confirms the PR updated if one exists. If no PR exists yet, do NOT open one here — that's Sprint D integration scope after all of plan-010's remaining phases ship.
  - Depends on: D.2.
  - Risk: Low.

**Phase D completion criteria**
- [ ] `/chekpoint full` passed with zero BLOCK findings.
- [ ] Commit landed with `Reviewed: full` footer and ADR + plan references in the body.
- [ ] Pushed to `sprint-d-distribution` branch.

### Testing Strategy

| Layer | Test file | Count delta | Coverage |
|---|---|---|---|
| Unit | `tests/plugin/manifest-schema.test.ts` | +1 (11 → 12) | Symlink existence + resolution; updated schema contract (no `commands`/`skills` fields in plugin.json) |
| Unit | `tests/lib/install-manifest.test.ts` | 0 or -N if agent/skill/command assertions present | Adjusts to narrowed `COPY_MANIFEST` scope |
| Integration (manual) | Phase B dogfood | n/a | `/agents`, `/skills`, `/commands` count verification in real Claude Code session after `/plugin install` |
| Regression | Full suite | 709 → 710 | All existing tests remain green after symlink introduction (no test asserts the absence of root-level `agents`/`skills`/`commands`) |

**Manual-only verification** (no automated test, by design):
- Phase B Step B.1 — `/plugin marketplace` + `/plugin install` + `/reload-plugins` success.
- Phase B Step B.2 — `/agents`, `/skills`, `/commands` count match against source of truth.
- Phase D Step D.1 — `/chekpoint full` four-reviewer gate.

**Why no new automated test for Phase B**: the dogfood is an integration test against Claude Code's plugin loader, which is external infrastructure. Automating it would require a headless Claude Code runner — out of scope for plan-019. The manual gate is deliberately chosen for exactly this reason, per ADR-019 §Risks ("monitor plugins-reference for changes at the 2026-10-20 review date; Sprint E `/medik` health check can detect the regression at install time").

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Windows `core.symlinks = false` causes `ln -s` to create text files, git commits non-symlinks | Medium (Windows contributors) | High — plugin loader would see text files, not directories | A.2 verify step catches this locally; README "Installing on Windows" section (part of plan-010 Phase 7) documents the one-time setup; plan-019 also assumes Developer Mode is already ON on the dev machine per ADR-019 pre-conditions |
| Claude Code plugin cache fails to preserve symlinks at materialization (plugins-reference regression) | Low — verbatim spec commits to preservation | High — entire scheme breaks | Phase B Step B.3 is the gate; failure triggers escalation to GitHub issue, not a silent Decision-B fallback; ADR-019 §Risks documents this explicitly |
| Phase A.1 test update misses a legacy assertion in another file | Low — reconnaissance found no external refs | Medium | Phase A.5 full-suite run catches it; if found, update the offending test with the same rename/removal logic |
| `install-manifest.ts` edit (Phase C.4) has a different current shape than expected | Medium — plan-010 Phase 3 shipping state unknown at planning time | Low | Read the file before editing; two-scenario branch in C.4 accounts for present-or-absent categories |
| Phase C.3 narrowing of plan-010 Phase 4 loses important existing content | Medium | Medium | Use targeted single-location edits (intro paragraph, step 4.2 prefix, frontmatter) rather than rewriting sections wholesale; read-back verification confirms preservation |
| Phase B dogfood fails but cause is transient (stale cache, needs re-run) | Medium | Low | B.1 troubleshoot section flags cache clearing as first retry; escalate only after clear re-run attempts |
| `/chekpoint full` reviewers flag an issue requiring another round | Medium | Low | Schedule plan-019 with slack for one reviewer-driven fix round; D.1 allows inline addressing of WARN findings |

### Success Criteria

- [ ] Three root symlinks exist and resolve into `.claude/<type>/`: `agents`, `skills`, `commands`.
- [ ] `.claude-plugin/plugin.json` has 6 top-level fields; no `commands`; no `skills`; `hooks` retained pointing at `./.claude-plugin/hooks.json`.
- [ ] `.gitattributes` contains explicit `symlink` markers for the three root entries.
- [ ] `tests/plugin/manifest-schema.test.ts` passes with 12 total `it(...)` cases (11 existing + 1 new symlink-existence test).
- [ ] Full test suite passes: 710/710 (baseline 709 + 1 new).
- [ ] `npx tsc --noEmit` → 0 errors.
- [ ] `npm run build` → clean.
- [ ] Phase B dogfood confirms `/agents` returns 16, `/skills` returns 46, `/commands` returns 11, captured in commit-message notes.
- [ ] `scripts/lib/install-manifest.ts` has narrowed `COPY_MANIFEST` (no agents/skills/commands categories) OR the defensive comment.
- [ ] `tests/lib/install-manifest.test.ts` adjusted if present; documented if absent.
- [ ] `docs/plans/plan-010-harness-distribution-hybrid.md` Phase 4 narrowed; frontmatter has `superseded_partial_by: plan-019-...`.
- [ ] `memory/project_sprint_d_in_flight.md` marks Decision B RESOLVED.
- [ ] `memory/project_plan_010_dogfood_findings.md` has 2026-04-20 resolution section.
- [ ] `/chekpoint full` passes with zero BLOCK findings.
- [ ] Commit lands with `Reviewed: full` footer and ADR + plan references.
- [ ] Pushed to `sprint-d-distribution` branch.
- [ ] ADR-019 status remains `accepted` (no ADR mutation).
- [ ] Bug 3 (session-start banner) remains open as Sprint E scope — explicitly NOT addressed by this plan, per ADR-019.

### Relationship to plan-010 Sprint D Roadmap

**Before plan-019 (pre-2026-04-20 Decision B state)**:
- Phase 4 `install.sh`: complex — write `extraKnownMarketplaces` + copy rules + **copy agents** + **copy skills** + **copy commands** + merge permissions + write version marker.
- Phase 5 `install.ps1`: mirrors complex `install.sh`.
- Phase 7 ADR-011: documents 3 Decision B gaps as Sprint E debt.
- Phase 8 Kadmon-Sports dogfood: validates the Decision B copy fallback.

**After plan-019 (post-2026-04-20 Ruta Y / ADR-019 state)**:
- **plan-019 inserts BEFORE plan-010 Phase 4** (~1-2 hours of work).
- Phase 4 `install.sh`: **narrowed** — write `extraKnownMarketplaces` + copy rules + merge permissions + write `.kadmon-version` + update `.gitignore`. NO agent/skill/command copy.
- Phase 5 `install.ps1`: mirrors narrowed `install.sh`.
- Phase 7 documents ADR-019 resolution + the remaining Sprint E gap (Bug 3 session-start banner in plugin mode). Decision B gaps 1 + 2 RESOLVED.
- Phase 8 Kadmon-Sports dogfood: validates the clean plugin distribution (no workarounds to test — symlinks ship the runtime catalog through the loader as designed).

**Resumption order after plan-019 ships**: plan-010 Phase 4 (narrowed) → Phase 5 → Phase 7 (documenting ADR-019 + Sprint E Bug 3 gap) → Phase 8.

### Files Modified Summary

| File | Action | Phase | Why |
|---|---|---|---|
| `agents` (symlink, NEW) | create | A.2 | canonical path for plugin loader auto-discovery |
| `skills` (symlink, NEW) | create | A.2 | canonical path for plugin loader auto-discovery |
| `commands` (symlink, NEW) | create | A.2 | canonical path for plugin loader auto-discovery |
| `.claude-plugin/plugin.json` | edit | A.3 | remove `commands` + `skills` fields; update description to reference ADR-019 |
| `.gitattributes` | edit | A.4 | defensive symlink preservation markers |
| `tests/plugin/manifest-schema.test.ts` | edit | A.1 | drop `manifest.commands`/`manifest.skills` assertions; add symlink-existence test (12 total) |
| `memory/project_sprint_d_in_flight.md` | edit | C.1 | Decision B RESOLVED via ADR-019; mark agents/skills gaps fixed |
| `memory/project_plan_010_dogfood_findings.md` | edit | C.2 | 2026-04-20 resolution section |
| `docs/plans/plan-010-harness-distribution-hybrid.md` | edit | C.3 | Phase 4 scope narrowed; frontmatter supersede marker |
| `scripts/lib/install-manifest.ts` | edit | C.4 | remove agents/skills/commands categories OR add defensive comment |
| `tests/lib/install-manifest.test.ts` (if exists) | edit | C.5 | adjust category assertions |

### Files NOT touched (REUSED as-is)

- `scripts/generate-plugin-hooks.ts` — hooks.json generator works; hooks unaffected by ADR-019.
- `scripts/lib/install-helpers.ts` — Phase 3 helpers unchanged; used for rules + permissions merge in `install.sh` (unchanged).
- All 16 agent `.md` files under `.claude/agents/` — unchanged; symlinks make them visible at canonical path.
- All 46 `<name>/SKILL.md` files under `.claude/skills/` — unchanged.
- All 11 command `.md` files under `.claude/commands/` — unchanged.
- All 21 hook scripts under `.claude/hooks/scripts/` — unchanged.
- `.claude-plugin/hooks.json` — unchanged (hooks already work through loader).
- `.claude-plugin/marketplace.json` — unchanged.

### Complexity Summary

| Step | Complexity | Notes |
|---|---|---|
| A.1 | M | Multi-assertion test edit + new test case |
| A.2 | S | Three `ln -s` commands (Windows Developer Mode prerequisite) |
| A.3 | S | Two-line JSON removal |
| A.4 | S | Three-line `.gitattributes` append |
| A.5 | S | Run vitest (green check) |
| A.6 | S | Run build |
| B.1 | S | Four Claude Code commands (manual) |
| B.2 | S | Three listing commands + count check (manual) |
| B.3 | M | Judgment call; may escalate to diagnostic write-up if counts wrong |
| C.1 | M | Memory edit with table + resolution section |
| C.2 | S | Memory append |
| C.3 | M | Plan-010 targeted edits in multiple locations |
| C.4 | M | Depends on current `install-manifest.ts` state; read-before-edit |
| C.5 | S-M | May be no-op if test file absent |
| D.1 | M | Full reviewer matrix (parallel agents) |
| D.2 | S | Commit with conventional format |
| D.3 | S | Push |

**Total: 17 steps. Most S, a few M. Execution estimate: ~1-2 hours for happy path; +1 hour reviewer-fix round if chekpoint surfaces WARN findings; +indeterminate if Phase B dogfood fails and requires diagnostic.**

### Pipeline Contract

- **Input**: `docs/decisions/ADR-019-canonical-root-symlinks-for-plugin-loader.md` (accepted, 2026-04-20).
- **Output**: this plan document at `docs/plans/plan-019-canonical-root-symlinks-for-plugin-loader.md`.
- **Handoff**: `needs_tdd: true` — feniks guides TDD for Phase A.1 (red test) + A.5 (green gate) after user approval. Phase B manual dogfood and Phase C-D work do not need feniks; feniks's scope is Phase A only. Phase D invokes kody via `/chekpoint full`.

### no_context Rule

Every assertion in this plan traces back to a file read during Phase 0:
- ADR-019 decision surface → `docs/decisions/ADR-019-canonical-root-symlinks-for-plugin-loader.md`.
- Current `plugin.json` state → `.claude-plugin/plugin.json`.
- Test case structure → `tests/plugin/manifest-schema.test.ts`.
- Plan-010 Phase 4 shape → `docs/plans/plan-010-harness-distribution-hybrid.md`.
- Format precedent → `docs/plans/plan-017-agent-template-system.md`.

No counts, version numbers, or file paths are invented. Where state is unknown at planning time (`scripts/lib/install-manifest.ts` current contents, `tests/lib/install-manifest.test.ts` presence), the plan explicitly branches via "read-before-edit" and two-scenario handling (C.4, C.5). If implementation surfaces a fact inconsistent with the assumptions block, STOP and revise the plan rather than invent.
