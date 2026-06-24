---
number: 36
title: Sentinel-harness — de-personalized security-specialized fork (implementation)
date: 2026-06-24
status: pending
needs_tdd: true
route: A
adr: ADR-036-sentinel-harness-fork.md
---

## Plan: Sentinel-harness — de-personalized security-specialized fork [konstruct]

### Overview
Sequence the creation of `Sentinel-harness` as a NEW standalone repo (`C:\Command-Center\Sentinel-harness`, sibling of this repo, original untouched): a clean `git init` curated copy of Kadmon-Harness, de-personalized output-style-first, then a phased security build that EXTENDS the existing spektr/security base. This plan only orders decisions already locked in ADR-036 — it does not re-decide any of them. Phases 0 and 1 are file/config operations; Phase 2 writes NEW code (generalized SAST hook, command wiring) and is the TDD target; Phases 3 and 4 are lower-granularity sketches for later milestones.

### needs_tdd: true
Phase 0 (repo creation/purge) and Phase 1 (de-personalization) are file/config operations and are NOT TDD targets — they are verified by grep gates, symlink-resolution checks, and a clean build. Phase 2 builds new TypeScript code (generalized `post-edit-security.js`, commit-time SAST gate, `/threatmodel` command wiring, new `/medik` check) which DOES warrant red-green-refactor. `needs_tdd: true` so feniks guides the Phase 2 code steps. Each step below is annotated `[TDD]` (write failing test first) or `[config/file]` (no test, verified by gate/build/manual check).

### Component carry-over reference
Do NOT duplicate the carry-over matrix here. The authoritative classification of every agent/skill/command/rule/hook as **(a) carry as-is / (b) re-theme / (c) new** lives in `ADR-036-sentinel-harness-fork.md` §3. When a step says "re-theme per matrix" or "carry per matrix", read §3 for the per-component class and notes. The phased security spec (what each phase ships) is ADR-036 §4.

### Open questions (gaps the plan does NOT decide — surface to user)
- **OQ-1 — RESOLVED 2026-06-24 (build authorized):** User confirms Kadmon-Harness is his personal IP and authorizes the local fork build. Company-side licensing DEFERRED ("luego vemos") — not a build blocker; settle in writing before any company handoff/deployment. See Pre-flight PF.1.
- **OQ-2 — RESOLVED 2026-06-24: KEEP `/chekpoint` verbatim (no rename).** Deliberate wink toward the client "Check Point". This VOIDS Step 1.2 and every `/review-gate` / "renamed `/chekpoint`" reference in this plan (Steps 2.9, 3.4, Success Criteria) — `/chekpoint` is carried as-is and only EXTENDED with the security gate (Step 2.9).
- **OQ-3 — RESOLVED 2026-06-24: default SAST = Semgrep.** Fast, local, multi-language, OSS, hook/commit-budget-friendly. CodeQL deferred as optional deep CI scan. Step 2.6's hook shells out via a tool-agnostic adapter so an enterprise scanner (Checkmarx/Fortify/Coverity) can be swapped in later.

---

### Pre-flight: IP / Licensing gate (BLOCKING — nothing below proceeds until cleared)
- [x] PF.1 — RESOLVED 2026-06-24 (build authorized): User confirms Kadmon-Harness is his own personal IP and authorizes building the fork locally. Company-side licensing/ownership DEFERRED ("luego vemos") — NOT a blocker for the build, but MUST be settled in writing before Sentinel ships to / is operated by the company. (S)
  - File: none (external/contractual)
  - Verify: RESOLVED for the local build (user confirmed personal ownership + authorized in-session). Ship-to-company step inherits the deferred-terms caveat — re-gate before any handoff/deployment to the company, NOT before the local build.
  - Depends on: none
  - Risk: High — this is the single most important blocker in the whole plan (ADR §Risks, top risk). Kadmon-Harness is personal `UNLICENSED` IP; Sentinel is a company tool. Clean-init (D1-B) keeps the boundary clean but does NOT answer ownership. Proceeding before this clears risks shipping a company artifact built on unlicensed personal IP.
  - Note: if resolution changes the fork mechanism assumption, ADR §Review date mandates re-evaluating whether clean-init is still right (Sentinel-side successor ADR, not an edit to ADR-036).

---

### Phase 0: Repo creation + purge (file/config — no TDD)
Goal: a clean-init `Sentinel-harness` repo that builds, with symlinks intact and all personal state purged. Independently mergeable: at the end of Phase 0 the repo exists, builds, and is provably free of personal commit history — even if no de-personalization edits have run yet.

- [ ] Step 0.1: Read current state and confirm baseline (S) `[config/file]`
  - File: read `ADR-036-sentinel-harness-fork.md` §1–§3, `docs/decisions/ADR-019-canonical-root-symlinks-for-plugin-loader.md` (symlink gate), `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.kadmon-version`
  - Verify: confirm the 3 canonical root symlinks (`./agents ./skills ./commands`) exist as git mode `120000` entries (`git ls-files -s agents skills commands`); confirm no `.claude/output-styles/` exists in source (already verified 2026-06-24 — greenfield)
  - Depends on: PF.1
  - Risk: Low
- [ ] Step 0.2: Record + tag the baseline SHA in Kadmon-Harness (S) `[config/file]`
  - File: Kadmon-Harness git (tag only — no repo file change)
  - Verify: `git tag sentinel-baseline-2026-06-24 <HEAD-sha>` exists; capture the SHA string for the Sentinel initial-commit message and `UPSTREAM_SYNC.md`
  - Depends on: 0.1
  - Risk: Low
- [ ] Step 0.3: Create `C:\Command-Center\Sentinel-harness` and clean `git init` (S) `[config/file]`
  - File: `C:\Command-Center\Sentinel-harness\` (new dir, sibling of Kadmon-Harness — original untouched)
  - Verify: dir exists, is a fresh git repo with zero commits, and is NOT nested inside Kadmon-Harness; `git -C C:\Command-Center\Sentinel-harness log` returns "does not have any commits yet"
  - Depends on: 0.2
  - Risk: Medium — must confirm the path is a true sibling and the copy never touches the source tree. Per global feedback (parallel sessions): if any unexpected change appears in Kadmon-Harness during this work, STOP and ask — do not revert.
- [ ] Step 0.4: Curated copy with Windows symlink preservation (M) `[config/file]`
  - File: copy from Kadmon-Harness into Sentinel-harness (everything EXCEPT the Step 0.5 purge list)
  - Verify: BEFORE copy, the gate must hold (carry ADR-019 §Decision step 4 verbatim) — Developer Mode ON + `git config --global core.symlinks true` + `MSYS=winsymlinks:nativestrict` set in the copy shell. AFTER copy, `git -C ...\Sentinel-harness ls-files -s agents skills commands` shows mode `120000` (symlinks, NOT dereferenced directories). If any of the three resolves to a real directory copy, the gate failed — abort and re-run with the toggles.
  - Depends on: 0.3
  - Risk: High — symlink dereferencing is silent on Windows without the gate. This is the ADR's #2 risk. The copy mechanism must use the gate, not a naive `xcopy`/`Copy-Item` that follows links.
- [ ] Step 0.5: Apply the purge list (M) `[config/file]`
  - File (must NOT travel into the fork, per ADR §2.D):
    - any `*.db` (ensure no SQLite state copied — fresh project-hash gives fresh DB automatically)
    - `~/.claude/projects/<project>/memory/` (user-scope auto-memory — never copied; confirm absent)
    - `.claude/agent-memory/*/MEMORY.md` — keep dir structure + the per-agent `## Memory` protocol prose (mechanism), ZERO accumulated entries (reset to empty/template — see Step 1.6)
    - `graphify-out/` — delete; regenerate fresh in Sentinel
    - `docs/decisions/` + `docs/plans/` — CURATE, do not bulk-delete (handled in Step 0.7, not here)
  - Verify: `git -C ...\Sentinel-harness status` shows no `*.db`; `graphify-out/` absent; `.claude/agent-memory/*/MEMORY.md` files contain no accumulated entries
  - Depends on: 0.4
  - Risk: Medium — over-purge (deleting infra ADRs) and under-purge (leaving a `*.db` or memory entries) are both failure modes. Curation of ADRs is deliberately deferred to 0.7.
- [ ] Step 0.6: One-field distribution renames (S) `[config/file]`
  - File: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.kadmon-version`
  - Verify: `name`/`description`/`author` in `plugin.json` + `marketplace.json` changed `kadmon-harness` → `sentinel-harness`; version-marker filename/content updated. KEEP the `KADMON_` env-var prefix in v1 (ADR §1 — internal token, invisible to users; renaming would touch every hook + test). Distribution stack (`install-apply.ts`, `install-helpers.ts`, `install-manifest.ts`, `generate-plugin-hooks.ts`, `install.sh`, `install.ps1`) carried as-is — no edits beyond these naming fields.
  - Depends on: 0.5
  - Risk: Low
- [ ] Step 0.7: Curate carried ADRs/plans + fresh `docs/decisions/` setup (M) `[config/file]`
  - File: `C:\Command-Center\Sentinel-harness\docs\decisions\`, `docs\plans\`
  - Verify (per ADR §2.D + §5): CARRY infra ADRs marked `inherited from Kadmon-Harness baseline — see Kadmon ADR-036` (ADR-003/010/019 distribution chain, ADR-006 pattern engine, ADR-013 skills layout, ADR-029 capability alignment, ADR-035 catalogs); DROP personal/experiment ADRs (ECC experiment, personal-project plans). Sentinel starts its OWN numbering at ADR-001 = "adopt the Kadmon-Harness infra baseline @ <sha>" which back-references Kadmon ADR-036 by URL. ADR-036 itself STAYS in Kadmon-Harness (not copied).
  - Depends on: 0.5
  - Risk: Medium — the carry/drop split is judgment-bound; under-carry loses the "why the machinery works", over-carry leaks personal experiments.
- [ ] Step 0.8: Create `UPSTREAM_SYNC.md` ledger (S) `[config/file]`
  - File: `C:\Command-Center\Sentinel-harness\docs\UPSTREAM_SYNC.md`
  - Verify: file records the last-synced Kadmon-Harness SHA (the Step 0.2 baseline) + the Infra/Identity/Mixed classification rule from ADR §D1 + the `format-patch`→`git am` port mechanism (NO `git remote add upstream`). This is the structural enforcement of permanent divergence.
  - Depends on: 0.2, 0.7
  - Risk: Low
- [ ] Step 0.9: First Sentinel commit + clean build (M) `[config/file]`
  - File: Sentinel-harness git + `npm install && npm run build`
  - Verify: initial commit message = `Imported from Kadmon-Harness infra baseline @ <sha>`; `npm run build` succeeds (lifecycle hooks need `dist/`); `npx vitest run` passes the CARRIED suite (proves the copy is functionally intact before any edits). `git log` shows exactly ONE commit with zero personal-voice content.
  - Depends on: 0.4, 0.5, 0.6, 0.7, 0.8
  - Risk: Medium — a broken carried build here means the copy lost a file or dereferenced a symlink; catch it before Phase 1.

---

### Phase 1: De-personalization (file/config — no TDD)
Goal: neutralize the personal identity layer, output-style-first. Independently mergeable: at the end the repo is provably free of personal references (CI grep-gate green) with a neutral default voice. Strategy per ADR §2: output style is PRIMARY (largest surface, one new file); the bounded edit set handles residue the output style cannot reach.

- [ ] Step 1.1: Create neutral output style `.claude/output-styles/sentinel.md` (M) `[config/file]`
  - File: `C:\Command-Center\Sentinel-harness\.claude\output-styles\sentinel.md` (greenfield — no output-styles dir existed in source)
  - Verify (per ADR §2.A): English only, neutral professional tone, NO Spanish register, NO K.A.O.S persona, NO emojis in prose, security-conscious framing as default lens. Set as default in project `CLAUDE.md` (Step 1.4) and document activation.
  - Depends on: Phase 0 complete
  - Risk: Low — this is the primary de-personalization lever and is greenfield, so no merge risk.
- [x] Step 1.2 — VOID (OQ-2 resolved 2026-06-24: KEEP `/chekpoint` verbatim, no rename — deliberate nod to client "Check Point"). The sub-bullets below are obsolete; `/chekpoint` is carried as-is and only EXTENDED in Step 2.9. (—) `[config/file]`
  - File: `.claude/commands/chekpoint.md` → new name (placeholder `/review-gate` pending OQ-2); update every reference: `rules/common/agents.md` routing, `rules/common/development-workflow.md` + `git-workflow.md` (tier table + footer convention), `.claude/commands/CATALOG.md`, any hook referencing the command name, any skill cross-reference, the `Reviewed: full|lite|skip` commit-footer docs
  - Verify (per ADR §3 + §D2): `/chekpoint` is the ONLY rename (K-naming of agents KEPT — coined identifiers, not personal). Grep for `chekpoint` across Sentinel returns zero matches after rename. Build + carried tests still pass (routing not broken).
  - Depends on: 1.1, OQ-2 resolved (user confirms literal name)
  - Risk: Medium — homophone of client brand "Check Point"; user-facing on every commit. Cross-reference surface is bounded but real (ADR §Negative). Atomic update required or routing breaks silently.
- [ ] Step 1.3: Example-swaps in the ~13 grep-identified `.claude/` files (M) `[config/file]`
  - File (ADR §2.B list): `agents/arkitect.md`, `agents/kartograf.md`, `agents/arkonte.md`, `agents/python-reviewer.md`, `commands/abra-kdabra.md`, `skills/council`, `skills/workspace-surface-audit`, `skills/postgres-patterns`, `skills/frontend-patterns`, `skills/python-testing`, `skills/python-patterns`, `skills/claude-api`, `skills/api-design`
  - Verify: personal-project illustrative examples swapped for neutral ones (e.g. "RAG system design (ToratNetz)" → "RAG system design"). These are example-SWAPS, not rewrites — contract/structure of each file unchanged. Re-run the ADR research grep (below) over these files = zero matches.
  - Depends on: Phase 0 complete
  - Risk: Low — bounded, enumerable, shallow edits.
- [ ] Step 1.4: Neutralize project `CLAUDE.md` (M) `[config/file]`
  - File: `C:\Command-Center\Sentinel-harness\CLAUDE.md`
  - Verify (ADR §2.B): rewrite Identity/Philosophy/Active-Projects for Sentinel; REMOVE personal-projects list (ToratNetz/KAIRON/Kadmon-Sports); point at `.claude/output-styles/sentinel.md` as default; relabel "Kadmon Harness" → "Sentinel-harness"; KEEP technical stack/structure/env-var sections intact.
  - Depends on: 1.1
  - Risk: Low
- [ ] Step 1.5: Ship neutral user template + neutralize statusline + language config (M) `[config/file]`
  - File: `C:\Command-Center\Sentinel-harness\CLAUDE.md.template`, `statusline.sh` (if carried), language/register config in rules/templates
  - Verify (ADR §2.B): `CLAUDE.md.template` (drop into `~/.claude/`) contains NO persona/Spanish/caveman — it replaces the role user-scope `~/.claude/CLAUDE.md` plays for the individual; `statusline.sh` keeps the 3-line contract (session / cost+limits / git) with persona text removed (or omit + re-template, it is user-scope); remove Spanish-register memory triggers from rules/templates; English is the only register.
  - Depends on: 1.4
  - Risk: Medium — output-style under-coverage (ADR §Risks): a Sentinel engineer's OWN user-scope `~/.claude/CLAUDE.md` can override the project output style. Mitigation = ship this template + document scope precedence; treat the output style as default-voice setter, not a hard guarantee.
- [ ] Step 1.6: Memory reset + confirm caveman not installed (S) `[config/file]`
  - File: `.claude/agent-memory/*/MEMORY.md`
  - Verify (ADR §2.E + locked decision 3): every per-agent `MEMORY.md` ships empty (or absent) — the `## Memory` PROTOCOL prose in each agent stays (mechanism, not content). Confirm caveman is simply NOT installed (separately-installed plugin — omit it; nothing to remove from the repo).
  - Depends on: 0.5
  - Risk: Low
- [ ] Step 1.7: Add CI grep-gate for de-personalization leakage (M) `[config/file]`
  - File: `C:\Command-Center\Sentinel-harness\.github\workflows\` (new CI workflow) + an allow-list file
  - Verify (ADR §Risks "De-personalization leakage"): CI step runs the ADR research grep `K\.O\.A\.S|K\.A\.O\.S|órale|neta|Mexican|español|ToratNetz|KAIRON|Kadmon-Sports|caveman` and FAILS the build on any match outside the allow-list. Re-run after every upstream sync. Running it locally NOW must be green (proves Steps 1.1–1.6 left no residue).
  - Depends on: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
  - Risk: Medium — this is the mechanical proof Phase 1 succeeded. Tune the allow-list so legitimate occurrences (e.g. the `KADMON_` env prefix kept per ADR §1, or "Kadmon ADR-036" back-references in carried ADRs) don't false-fail.

---

### Phase 2: Security Phase 1 build — dev-integrated (TDD where code is written)
Goal: extend the existing security base with threat modeling + SAST triage + secure-SDLC, per ADR §4 Phase 1. Build ON the base (spektr opus agent, 3 `security.md` rules, `security-review`/`security-scan`/`safety-guard` skills, `post-edit-security.js` bandit hook, spektr's mandatory `/chekpoint` role) — NEVER rebuild it. Independently mergeable: each new component ships + the existing base is extended, with tests for all new code.

- [ ] Step 2.1: Extend `spektr` agent with STRIDE/attack-tree + SAST/DAST triage (M) `[config/file]`
  - File: `.claude/agents/spektr.md`
  - Verify (ADR §4 Phase 1 Agents): add STRIDE/attack-tree threat modeling + SAST/DAST result triage to Expertise/Workflow. NO new agent — spektr is already opus and chartered for this. Agent frontmatter linter (via `/medik`) passes; `skills:` frontmatter updated to declare the new skills (2.3, 2.4).
  - Depends on: Phase 1 complete
  - Risk: Low — prose extension of an existing agent, not new code.
- [ ] Step 2.2: Extend `arkitect` agent as threat-model co-owner (S) `[config/file]`
  - File: `.claude/agents/arkitect.md`
  - Verify (ADR §3 + §4): add "secure-SDLC architecture / threat-model-informed design" to Expertise so arkitect co-owns threat modeling with spektr (already example-swapped in 1.3). Linter passes.
  - Depends on: Phase 1 complete
  - Risk: Low
- [ ] Step 2.3: Create `threat-modeling` skill via skill-creator plugin (M) `[config/file]`
  - File: `.claude/skills/threat-modeling/SKILL.md`
  - Verify (ADR §4 + project rule): MUST use `skill-creator:skill-creator` plugin (never hand-author). STRIDE + attack trees + trust-boundary diagrams; owned jointly by spektr+arkitect via `skills:` frontmatter; declare `requires_tools:` if it needs Bash/Task. Placed at `.claude/skills/threat-modeling/SKILL.md` (subdir + literal uppercase). `/medik` Check #8 (frontmatter) + #14 (capability alignment) pass.
  - Depends on: 2.1, 2.2
  - Risk: Low
- [ ] Step 2.4: Create `sast-triage` skill via skill-creator plugin (M) `[config/file]`
  - File: `.claude/skills/sast-triage/SKILL.md`
  - Verify (ADR §4): MUST use skill-creator plugin. Maps Semgrep/CodeQL/OWASP-ZAP output → BLOCK/WARN/NOTE severity. `/medik` Checks #8 + #14 pass.
  - Depends on: 2.1
  - Risk: Low
- [ ] Step 2.5: Create `common/secure-sdlc.md` rule + extend the 3 `security.md` rules (M) `[config/file]`
  - File: `.claude/rules/common/secure-sdlc.md` (new); extend `.claude/rules/common/security.md`, `.claude/rules/typescript/security.md`, `.claude/rules/python/security.md`
  - Verify (ADR §4): new rule encodes workflow order (threat-model → design → implement → SAST → review → comply-check → commit); the three `security.md` files gain SAST-in-pipeline + threat-model-before-merge mandates. EXTEND, don't rewrite — keep existing operational logic.
  - Depends on: 2.3, 2.4
  - Risk: Low
- [ ] Step 2.6: Generalize `post-edit-security.js` beyond bandit to configured SAST tool (L) `[TDD]`
  - File: `.claude/hooks/scripts/post-edit-security.js` + co-located test `tests/hooks/post-edit-security.test.ts` (or project hook-test convention)
  - Verify (ADR §4 Hooks): write FAILING test first (red) — assert the hook shells out to the configured SAST tool (resolve OQ-3: Semgrep vs CodeQL default) on the edited file, surfaces findings, exits 1 on findings / 0 clean, and degrades gracefully when the tool is absent (mirrors the bandit fallback). Then implement (green). MUST use `parseStdin()` helper (project memory: Windows backslash bug — all hooks). Respect the per-edit <500ms budget — per-edit is lightweight; heavy scan is the commit gate (2.7). Test via `execFileSync` with `input` option (Windows-safe), assert exit code AND stderr/stdout.
  - Depends on: 2.4 (OQ-3 RESOLVED 2026-06-24: default = Semgrep, via a tool-agnostic adapter so an enterprise scanner can be swapped in later)
  - Risk: High — this is the highest-uncertainty code step (external tool invocation, latency budget, cross-platform, graceful-absent). Surface OQ-3 early. The TDD red test pins the contract before implementation.
- [ ] Step 2.7: Add commit-time SAST gate hook (L) `[TDD]`
  - File: new hook in `.claude/hooks/scripts/` (PreToolUse on Bash/git-commit, or pre-commit-stage) + co-located test
  - Verify (ADR §4): write FAILING test first — heavy SAST scan runs at commit (NOT per-edit, to respect budgets), surfaces findings on the staged diff, exits 2 (block) on configured-severity findings. `parseStdin()`, try/catch → exit 0 on unexpected error (never crash Claude Code), `execFileSync`-based test asserting exit code + output.
  - Depends on: 2.6
  - Risk: High — blocking hook (exit 2) on a heavy external scan; must not crash Claude Code and must not exceed reasonable commit-time latency. spektr (Phase 2a) MANDATORY on this code in `/chekpoint`.
- [ ] Step 2.8: Create `/threatmodel` command (M) `[TDD]` for any wiring code, `[config/file]` for the command doc
  - File: `.claude/commands/threatmodel.md` + `.claude/commands/CATALOG.md` update; any helper code gets a co-located test
  - Verify (ADR §4): arkitect+spektr produce a STRIDE model + attack tree for a feature/surface, written to `docs/threat-models/`. Command frontmatter `agent:`/`skills:` wires arkitect+spektr + `threat-modeling` skill. If the command ships helper TS (e.g. a writer for `docs/threat-models/`), write its test first. Pure-prose command doc = `[config/file]`.
  - Depends on: 2.1, 2.2, 2.3
  - Risk: Medium
- [ ] Step 2.9: Extend `/chekpoint` (kept verbatim per OQ-2) with SAST + secret-scan reviewer phase (M) `[config/file]`
  - File: the renamed command (from 1.2) + `rules/common/development-workflow.md` tier table
  - Verify (ADR §3 + §4): ADD a security-review gate (SAST + secret-scan + threat-model-delta) as a Phase-1 reviewer in the gate. spektr's mandatory role preserved. Extend, don't rebuild the gate.
  - Depends on: 1.2, 2.4, 2.6
  - Risk: Medium
- [ ] Step 2.10: Add `/medik` SAST-config health check (M) `[TDD]`
  - File: new check in the `medik-checks/` module + co-located test
  - Verify (ADR §4): write FAILING test first — the check verifies the configured SAST tool is reachable + config present; integrates via the existing `medik-checks/` contract (don't rebuild `/medik`). Test asserts FAIL when SAST config missing, PASS when present.
  - Depends on: 2.6
  - Risk: Medium

---

### Phase 3: Security Phase 2 — compliance (SKETCH, later milestone)
Lower granularity per ADR §4 Phase 2 — sequence in detail in a future plan when Phase 2 ships. Independently mergeable as its own milestone.
- [ ] Step 3.1: `compliance-mapping` skill via skill-creator (control → code-evidence, e.g. SOC2 CC6.1 → access-control test coverage) (M) `[config/file]`
- [ ] Step 3.2: `common/compliance.md` rule (which controls gate which change classes) (M) `[config/file]`
- [ ] Step 3.3: `/comply` command (audit repo/feature vs SOC2/ISO 27001 control set → control-evidence report); `kurator`/`doks` own evidence docs — no new agent (M) `[config/file]`
- [ ] Step 3.4: Extend renamed gate to BLOCK on missing required control for compliance-sensitive surfaces + `/medik` compliance checks via `medik-checks/` (M) `[TDD where code]`

### Phase 4: Security Phase 2b — IR + red-team (SKETCH, standalone, lowest priority)
Lowest granularity per ADR §4 Phase 2b — standalone module, does NOT gate the dev pipeline. Detail later.
- [ ] Step 4.1: `ir-playbook` skill (incident-response runbook methodology) via skill-creator (M) `[config/file]`
- [ ] Step 4.2: `redteam-playbook` skill (offensive test-case methodology — scoped as dev-side aid, NOT live-ops pentest, per locked decision 1) via skill-creator (M) `[config/file]`
- [ ] Step 4.3: `/redteam` (generate red-team test cases/attack scenarios) + `/incident` (drive IR runbook) commands; dedicated IR agent OPTIONAL/deferred — spektr owns initially (M) `[config/file]`

---

### Testing Strategy
- **Phase 0/1**: no unit tests (file/config ops). Verified by: (a) symlink-resolution check `git ls-files -s agents skills commands` = mode `120000`; (b) clean carried-suite `npx vitest run` after copy (Step 0.9); (c) CI grep-gate green (Step 1.7); (d) build succeeds.
- **Phase 2 unit (TDD targets)**: `post-edit-security.js` generalization (2.6), commit-time SAST gate (2.7), `/medik` SAST-config check (2.10), any `/threatmodel` helper (2.8). All hooks tested via `execFileSync` with `input` option (Windows-safe), asserting BOTH exit code AND stderr/stdout, covering blocking (exit 2) + warning (exit 1) + allow (exit 0) + tool-absent fallback.
- **Phase 2 integration**: `/review-gate` security-reviewer phase runs SAST + secret-scan on a sample diff (2.9); `/threatmodel` writes a STRIDE model to `docs/threat-models/` (2.8).
- **Regression**: the carried Kadmon-Harness suite must stay green after every Phase 1 edit (rename routing not broken) and every Phase 2 extension (base not rebuilt).
- **CI**: grep-gate (1.7) on every build + after every upstream sync.

### Risks & Mitigations
- Risk: IP/licensing unresolved (ADR top risk) → Mitigation: PF.1 BLOCKING gate — nothing proceeds until user clears it in writing.
- Risk: Windows symlink dereferencing on copy (ADR #2 risk) → Mitigation: ADR-019 gate verbatim in Step 0.4 (Developer Mode + `core.symlinks true` + `MSYS=winsymlinks:nativestrict`) + post-copy mode-120000 verification + `/medik` symlink check.
- Risk: De-personalization leakage in subtle places → Mitigation: CI grep-gate (1.7) FAILS build on any match outside allow-list; re-run after every upstream sync.
- Risk: `/chekpoint` rename breaks routing silently → Mitigation: atomic cross-reference update (1.2) + zero-match grep + carried-suite regression.
- Risk: SAST hook crashes Claude Code or blows latency budget (2.6/2.7) → Mitigation: try/catch → exit 0 on unexpected error; heavy scan at commit not per-edit; TDD red test pins the contract; spektr MANDATORY review.
- Risk: Upstream-sync drift drags identity back in → Mitigation: `UPSTREAM_SYNC.md` ledger + Infra/Identity/Mixed classification + `format-patch`/`git am` (no `upstream` remote) + periodic `merge-graphs` diff.
- Risk: Output-style under-coverage (user-scope `~/.claude/CLAUDE.md` overrides) → Mitigation: ship neutral `CLAUDE.md.template` (1.5) + document scope precedence; output style is default-voice setter, not a hard guarantee.

### Success Criteria
- [ ] PF.1 cleared: IP/licensing settled in writing before any fork operation
- [ ] Phase 0: `Sentinel-harness` exists as sibling repo, original untouched, single clean-init commit referencing baseline SHA, symlinks mode-120000 intact, purge applied, `UPSTREAM_SYNC.md` present, carried build + suite green
- [ ] Phase 1: CI grep-gate green (zero personal-reference leakage outside allow-list), neutral output style is default, `/chekpoint` renamed with zero stale references
- [ ] Phase 2: threat-modeling + sast-triage skills ship, spektr+arkitect extended (not rebuilt), `secure-sdlc.md` + 3 extended `security.md` rules, `/threatmodel` command, generalized SAST hook + commit-time gate, `/medik` SAST check — all with passing tests
- [ ] Existing security base extended, never rebuilt (spektr/security.md/3 skills/bandit hook contract preserved)
- [ ] All tests pass (`npx vitest run`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Sentinel `docs/decisions/` starts at its own ADR-001 back-referencing Kadmon ADR-036; ADR-036 stays in Kadmon-Harness
