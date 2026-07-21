# BACKLOG — Kadmon Harness

Operational work queue. One line per item, linked to detail. `docs/roadmap/` keeps the
release narrative; this file is what gets picked up next. On release, done items move to
CHANGELOG and are pruned here.

States: `[ ]` open · `[~]` in progress · `[x]` done · `[-]` dropped · `[d]` deferred.
`AUD-xx` items: detail in [docs/insights/2026-07-12-full-harness-audit.md](docs/insights/2026-07-12-full-harness-audit.md).
`R-xx` items: detail in [docs/roadmap/v1.3.1-performance-and-quality.md](docs/roadmap/v1.3.1-performance-and-quality.md) (item numbers preserved).

## P0 — broken now


## P1 — consistency / quality

- [ ] Orphan-recovery read path parity (`session-start.js:133`): still reads `observations.jsonl` live-only — a recovered long-session orphan summarizes last-turn-only. Should read archive+live like the 3 readers updated in the 2026-07-17 forge-blind fix. Flagged by spektr + kody.
- [ ] O(n^2) per-Stop archive re-parse: past message 20 every Stop re-reads the full accumulated `observations.archive.jsonl` for Phase 1 aggregates. Fine at current session lengths; revisit if sessions grow materially (perf, not correctness). Flagged by ts-reviewer + spektr independently.
- [ ] Optional TOCTOU hardening on Phase 5 read→append→unlink (`session-end-all.js`): concurrent observe-post append can lose or duplicate ONE observation line (benign, deduped downstream via natural keys; no corruption/leak — spektr LOW). Reader-side dedup or temp-file+rename if ever needed.
- [ ] AUD-33 `config-protection.js` residual heuristic scope: `extractBraceBlockAt` is string-literal-aware (Wave 2) but is NOT a full JS/JSON parser — it does not skip JS comments (`/* } */`) or template literals when brace-counting. A disabled rule hidden behind a comment-embedded brace in an `eslint.config.js` could still slip past. Not realistic for the threat model (the "attacker" is the agent/user editing their own config, not a payload crafter; comments aren't valid in `.eslintrc.json`/`tsconfig.json`) — but if we want a true guarantee, replace the regex/scanner approach with `JSON.parse` + object-walk for the JSON configs and a real (lightweight) JS tokenizer for flat-config. Documented as heuristic in the code. Low priority.

- [ ] `tests/lib/release/upgrade-advisory.test.ts` test (d) hardcodes the live repo path `C:\Command-Center\Kadmon-Harness` (line ~224) instead of the isolated `mkdtempSync` convention its siblings (e) and (f) use. 4th instance of the live-repo-coupling class documented in `project_release_e2e_live_state_gotcha` (prior fixes: `8fcd129`, `55c7b6d`, `b3650db`); once (f) was fixed 2026-07-16 this became the LAST living instance in that file. Low risk today — it only asserts the graceful-non-throw contract, which is genuinely toolchain-agnostic — but it is the seed of the 5th recurrence. **Tracked because kody caught that "backlog-bound" was said by two agents and written down by nobody**: ts-reviewer's report called it backlog-bound, feniks concurred, and a BACKLOG grep found no line. A recommendation is not a fact.

- [ ] `log()` (`scripts/lib/utils.ts:46`) has no `scrubSecrets()` layer, unlike the `observe-*` hooks. The silent-swallow pass (2026-07-16) added its FIRST five callers repo-wide — it had zero before, so that pass established the convention rather than following one. spektr's finding: the durable risk is not those five (verified safe — local-only git calls, and git anonymizes userinfo out of transport errors) but the SIXTH caller. Decide the contract: either add a scrubber to `log()`, or document a gate ("before adding a `log()` call, ask whether the payload can carry credentials or file content"). Note one live edge already: `orchestrate.ts` logs a `JSON.parse` error, and V8 echoes ~14-16 chars of the input into the SyntaxError — harmless only because `plugin.json` is a public committed manifest.
- [ ] Contract test can only see half the drift it exists to catch: `tests/plugin/manifest-schema.test.ts` proves `hardcoded literal == disk`, never `CLAUDE.md/README text == disk`. C-001 makes a human close that loop by grepping. A stronger version could regex-extract the count from CLAUDE.md's Status line and assert it against disk too. typescript-reviewer's NOTE from the 2026-07-16 red-main fix — the same review argued the hardcoded literal itself must STAY (deriving it from the filesystem the test reads makes the assertion tautological and destroys the only thing that forces a human to notice a component changed).
- [x] **C-001's checklist is incomplete — this is why the count drift recurs.** DONE 2026-07-20 via the append-only **C-001 Amendment** in `CORRECTIONS.md`: the full nine-surface target list, walked by hand and verified (adds `docs/onboarding/`, the three `CATALOG.md` frontmatter descriptions, `WORK.md` current-state line, and the three memory surfaces the original three-item list omitted). Amendment also fixes the unit — cite the COLLECTED total, never a passed-count — and records that a red suite undercounts. Mechanization stays open as the `memory-audit` skill (P1 above); the amendment is its specification. It names CLAUDE.md, README, and the contract tests as the three grep targets. But `docs/onboarding/reference_kadmon_harness.md` and the per-type `CATALOG.md` files carry the same component counts and are not listed; the 2026-07-16 /doks pass found the onboarding catalog stale at 52 skills / 11 shared modules, exactly the drift C-001 exists to prevent. Either amend C-001 (append-only) with the full target list, or better, make it mechanical. Surfaced independently by typescript-reviewer on the red-main fix.

- [ ] 🔴 **`commit-quality.js` reads the WRONG REPO — it blocks commits in repo B using repo A's
  staged files.** Hit live 2026-07-21. A `git commit` inside `C:\Command-Center\Kadmon-Sports`
  (compound `cd X && git add ... && git commit`) was blocked with
  `console.log() found in docs/vision/render-deck.ts` — a file that **does not exist in
  Kadmon-Sports**. It lives in BioRaMBaM, which was the Claude Code process cwd. Verified at the
  moment of the block: `git diff --staged --name-only` in Kadmon-Sports returned **empty**, in
  BioRaMBaM returned 9 files including that one. **Root cause:** the hook runs `git diff --staged`
  against the *process* cwd instead of the repo the Bash command targets, so any session working
  in repo A cannot commit in repo B while A has anything staged. Since it is a PreToolUse hook the
  whole tool call is blocked, so even the `git add` never runs. Cross-repo work is normal in this
  Command-Center layout (this session touched five repos), so this is not exotic. **Fix:** derive
  the repo root from the command's target — parse a leading `cd <path>` or resolve
  `git rev-parse --show-toplevel` in the same shell context — instead of assuming process cwd.
  Applies to any staged-file-reading hook, not just this one: audit `block-no-verify.js` and the
  other Bash-matcher hooks for the same assumption. **Second, smaller finding from the same
  block:** the console.log rule does not exempt CLI tooling. `docs/vision/render-deck.ts:43`
  prints its own completion line, which is what a CLI is *for*, and BioRaMBaM's `cli.ts` does the
  same throughout — it simply was not staged. Either exempt CLI entrypoints or give the hook a
  visible per-line opt-out; the message says "remove them if intentional" while offering no way to
  mark intent.

- [ ] **Step-0 project scaffolding in `install.ps1` / `install.sh`.** The installer creates
  `.claude/` and nothing else, so every new project starts with zero `docs/decisions/`,
  `docs/plans/`, `docs/research/`, `docs/state/`, `BACKLOG.md`, `WORK_COORDINATION.md`.
  Decided by the architect 2026-07-21 (BioRambam session): the mechanism must be the
  installer, NOT a rule in CLAUDE.md — a rule is a reminder and depends on being followed,
  and the motivating incident is precisely a session where the loaded rules were skipped for
  100+ edits. Template ships complete with optional sections explicitly marked (a file that
  does not exist is never missed). Canonical `BACKLOG.md` location: repo root (majority 3-2
  across the audited repos, and what this file's own `/chekpoint` reminder text assumes).
  Source of truth for the templates is THIS repo; port to Sentinel + Cowork after.
  **Evidence for why:** BioRambam ran 100+ edits, 4 commits and 3 adversarial audit rounds
  with no decision record, and escalated 1 CRITICAL → 2 CRITICAL + 5 HIGH, one of the HIGH
  introduced by a patch. Needs its own ADR — it touches both installers and sets a standard
  for 6 repos. **Gotcha found while scaffolding BioRambam by hand 2026-07-21:** git does not
  track empty directories, so `docs/plans/` and `docs/research/` were invisible to `git
  status` and would have vanished on clone — the scaffold would have existed on one disk
  only. The installer MUST drop a `.gitkeep` in every directory it creates empty.
- [ ] **Backfill `Kadmon-Sports` with the Step-0 scaffold.** Audit 2026-07-21: it is the only
  mature repo with `BACKLOG.md` + `WORK_COORDINATION.md` but **no `docs/` at all** — zero
  ADRs, zero plans, on a Python monorepo in production. Do it AFTER the template above so it
  consumes the template rather than a hand copy. It also carries a `FINISHED_INITIATIVES.md`
  no other repo has — evaluate promoting that into the template.
- [ ] **ADR: converge `WORK.md` ↔ `WORK_COORDINATION.md`.** They began as the same artifact
  (this repo's `WORK.md` predates the team; Cowork's `WORK_COORDINATION.md` added the
  multi-person layer) and have since diverged: `WORK.md` carries release-engineering state
  (`test state on main`, `landed but unreleased`) the other lacks, and `WORK_COORDINATION.md`
  carries roster / channels / conflict zones / open-questions the other lacks. ADR-038 §1
  treats `WORK.md` as an accepted artifact and it is wired into `/release`'s compiled
  orchestrator + tests, `/chekpoint` and `/kontinuum` — so this is a migration, not a rename,
  and an accepted ADR is immutable: it needs a NEW ADR that supersedes that clause. New
  projects scaffold `WORK_COORDINATION.md` (covers solo and team) in the meantime.
- [ ] **Brand the coordination protocol: header, not filename — and rename `/sprint` →
  `/kowork`.** Decided by the architect 2026-07-21 (BioRambam session). The goal is to put the
  KadmonCowork brand on the Tier-2 product surface; the mechanism was corrected mid-decision.
  Renaming `WORK_COORDINATION.md` → `KadmonCowork.md` was rejected: a filename states what a
  file *does*, a brand states who *made* it, and a vendor-branded file whose contents are
  unguessable is the file a client engineer deletes. It also has real blast radius — `/sprint`
  reads and mutates it, ADRs reference it, and Cowork's `NUCLEO` §2 names it as the product
  ("protocolo de coordinación (WORK_COORDINATION.md + skill /sprint)"), so the rename would
  reach the sales document. **Adopted instead:** (a) branded H1 header
  `# KadmonCowork — Work Coordination` in every repo's copy, filename unchanged; (b) rename the
  command `/sprint` → `/kowork`, because the brand belongs on what a developer types twenty
  times a day, and `/sprint` is generic and not ours. (b) touches `Kadmon7Cowork-Harness`
  (skill file, ADR-038 references, NUCLEO §2) and needs its OWN ADR in that repo — an accepted
  ADR is immutable, so this is a superseding decision, not an edit.
  **Extended 2026-07-21 to a second artifact — `SESSION-HANDOFF.md`.** The architect asked for the
  same treatment; the same pattern answers it, and the filename argument is even stronger here.
  For `WORK_COORDINATION.md` the filename is descriptive; for this one it is a **mechanism** —
  `kontinuum` Globs that exact path to choose FREEZE vs THAW, and the literal appears 10 times in
  `.claude/skills/kontinuum/SKILL.md`. So: branded H1 `# Kadmon Kontinuum — Session Handoff`,
  filename unchanged. The command side of the pattern needs no work — `/kontinuum` is already
  K-first branded, unlike the generic `/sprint`. **The remaining work is one edit to
  `kontinuum/SKILL.md` step 4** so every future FREEZE emits that header; the currently-frozen
  note was branded by hand, which does NOT propagate. Must go through the skill-creator plugin
  (never hand-author skill files), so it belongs in the same branding pass as (a) and (b).
- [ ] **Port `rules/common/language.md` from BioRambam, then run the C-001 count pass.** Written
  2026-07-21 in `BioRambam/.claude/rules/common/language.md` and deliberately NOT written here
  first, because adding a rule to this repo moves the component count that C-001 governs and
  the nine-surface pass has to run in the same breath. **The defect it fixes:** the language
  rule existed only as one ambiguous line in the global `CLAUDE.md` — *"Write all code,
  comments, and files in English"* — with **zero** presence in `.claude/rules/`, and the real
  distinction buried as a passing note inside `plan-030` and `abra-kdabra.md` (*"artifacts stay
  English; prose to user follows user's es-MX register"*). Measured consequence: ToratNetz has
  14+ ADRs, all in Spanish — so either the rule was violated for months unenforced, or it never
  covered ADRs, and **the fact that neither is knowable by reading it is the defect**. Adopted
  axis is the ARTIFACT, not the repo: code / comments / tests / commits / agent-skill-command-
  rules files / ADRs / README → English; `BACKLOG.md`, `WORK_COORDINATION.md`, `docs/state/`,
  and all prose to the user → es-MX. Forward-only; a repo being sold translates what the buyer
  reads. Same pass: reword the global `CLAUDE.md` line to point at the rule file instead of
  competing with it. Port to Sentinel + Cowork after.
- [ ] **Make this repo private on GitHub.** Decided by the architect 2026-07-21. The plugin does
  NOT break: verified in `~/.claude/plugins/known_marketplaces.json`, `kadmon-harness` is
  registered as `"source": {"source": "directory", "path": "C:\\Command-Center\\Kadmon-Harness"}`
  — it loads off the local disk, so GitHub visibility is irrelevant to plugin loading in
  BioRambam or anywhere else. What DOES change, and must be handled in the same pass:
  (a) Joe / Abraham / Eden need collaborator access to clone; (b) if `install.ps1` / `install.sh`
  clone from the public URL, switch to SSH or a token — an installer that 404s for the team is
  the actual failure mode here; (c) public discovery is lost, which is the intent now that the
  harness has evolved into a product.

## P2 — features / trims

- [x] Dashboard v2 hardening (a) Host-header allowlist on the local server (plan-039 spektr NOTE, LOW) — done 2026-07-19 (`fix/dashboard-v2-hardening`): `isAllowedHost()` in `scripts/dashboard-web.ts` rejects any non-loopback Host with 403 BEFORE routing, allowlist `127.0.0.1`/`localhost`/`[::1]` with or without port, parsed via WHATWG URL (no naive `split(":")` — bracketed IPv6 survives; userinfo tricks resolve to the real host); Host-less requests already die at Node's built-in 400 (requireHostHeader, RFC 7230 §5.4). 26 new tests in `tests/lib/dashboard-web-server.test.ts` (9 end-to-end + 17 `isAllowedHost` parsing cases) — commit ee35c72's body says 21, that number is wrong, this one is measured (suite 1493 → 1519).
- [ ] Dashboard v2 hardening (b)+(c) remain CONDITIONAL — conditions not met as of 2026-07-19, deliberately NOT implemented: (b) rate limit on the 2 JSON endpoints only if ever exposed beyond 127.0.0.1 (spektr); (c) `index.html` at ~430 lines — split inline style/script only if it grows (kody).
- [x] Pre-commit dist-restage gap — done 2026-07-19 (`fix/dashboard-v2-hardening`): filter widened to `^scripts/.*\.ts$`; restage made SELECTIVE (each staged source → its own `dist/**.js` + `.d.ts`) instead of the proposed wholesale `git add dist/scripts`, which would also stage compiled output of UNSTAGED dirty .ts files — the same source/dist drift the hook exists to prevent. Two bonus fixes found on a Linux run: (1) the hook shipped mode 100644, so the X_OK structural test was red on every POSIX clone; now 100755. (2) `set -euo pipefail` hard-failed under dash ("Illegal option -o pipefail") because husky v9 runs hooks via `sh -e` ignoring the shebang — every commit on a Debian-family box aborted; now POSIX `set -eu` (the only pipeline was already `|| true`-guarded). Verified live (widened filter fired on top-level `scripts/dashboard-web.ts` in the previous commit) + by simulation (staged smoke .ts restaged its dist pair; unstaged-dirty sibling's dist stayed unstaged). Originally found by feniks during the plan-039 amendment, confirmed by kody.
- [ ] **Sessions started from a SUBDIRECTORY get an isolated, empty memory space.** Auto-memory directories are keyed by the full cwd path (`~/.claude/projects/C--Command-Center-ToratNetz-frontend/`), not by repo root, so opening Claude Code inside `ToratNetz/frontend` creates a SEPARATE memory tree that cannot see the parent project's memories. Verified 2026-07-19: `C--Command-Center-ToratNetz/memory/` holds 45 typed memories plus `MEMORY.md`; `C--Command-Center-ToratNetz-frontend/memory/` holds only `logs/` and has no `MEMORY.md` at all. Currently affects at least 6 real subdir spaces (ToratNetz frontend/backend/frontend-src/docs-onboarding, Kadmon-Sports/mlb, Kadmon-Harness/docs-roadmap + an agent worktree). Consequence: Abraham working in `ToratNetz/frontend` gets a Claude with none of the project's accumulated feedback or gotchas, and any memory written there is invisible from the repo root — a silent split-brain, not an error. Options: (a) detect the git repo root and key memory off that; (b) surface a session-start warning when cwd is below a repo root that already has a memory space; (c) document it as a rule ("always open Claude Code at the repo root"). Feeds the `memory-audit` skill above — cross-space orphan detection belongs in the same sweep.
- [ ] **AutoDream does not exist — false claim in CLAUDE.md and the consumer template.** `CLAUDE.md` line 147 states "AutoDream: consolidates memory every 24h/5+ sessions". Verified 2026-07-19 by repo-wide grep: the string appears in exactly two files, `CLAUDE.md` and `docs/onboarding/CLAUDE.template.md` — both docs, zero implementation in `scripts/`, `.claude/hooks/`, or the DB layer. The consumer-facing onboarding template ships the same claim. **Root cause of the memory rot found this session**: sessions assumed a mechanism was maintaining typed memories, so nobody audited them for ~3 months — `project_v1_production` sat at v1.3.0 across two releases, `reference_graphify` claimed 1110 nodes while disk held 585, and `reference_graphify_scope_limit` asserted "markdown is never indexed" after that stopped being true. Decide: implement it, or delete the claim from both files (cheaper and honest). The honest replacement is the `memory-audit` skill below.
- [ ] **`memory-audit` skill** — make the 2026-07-19 manual memory sweep repeatable and portable. Build via the skill-creator plugin (never hand-author skill files). Verifies CLAIMS against live artifacts rather than reading dates: counts vs a real test run, versions vs the tag, `in-progress` status vs git log, referenced paths vs disk. Flags three failure classes observed live — stale count, dead claim (a documented bug that has since been fixed), and falsified generalization (a true one-time observation written as a permanent property). Adds a cross-project contradiction check (Kadmon-Harness said the ECC experiment was OVERDUE while Kadmon-Sports still said in-progress). **Compose it from `/release`, not `/chekpoint`**: `/chekpoint` runs many times a day and most commits change nothing memory-relevant, whereas `/release` is exactly when counts and versions move, and it already composes `/doks` for the same reason. Keep it manually invocable for cross-project sweeps; optionally add a `/medik` NOTE-level staleness check (detect only, never rewrite).
- [ ] AUD-40 /release cross-process committed-but-untagged recovery: `planRelease` auto-recovery (waive EMPTY_UNRELEASED, tag-only) fires only for a SAME-SESSION retry (ctx.currentVersion still pre-bump). A fresh `/release` after a real crash reads the already-bumped plugin.json → recomputes a higher nextVersion → won't auto-recover the missing tag (needs manual `git tag` or original-version context). Full detection (scan CHANGELOG last-dated-heading vs last tag) is the follow-up. Surfaced by ts-reviewer Wave-3 directed check #1(b). Low priority — human-invoked + narrated + no auto-push, so a missed tag is visible before publish. **Hit live TWICE during the v1.5.0 cut (2026-07-19), widening the finding beyond crash-recovery to the applied-but-uncommitted window**: (1) the session driver had to cache `ReleasePlan` to disk because `commitAndTag` cannot re-run `planRelease` against the intentionally-dirty tree (DIRTY_TREE/EMPTY_UNRELEASED false-positive on any re-plan); (2) that disk cache was then WIPED mid-cut by scratchpad volatility (a concurrent sub-agent's media download turned over the scratchpad dir), forcing a manual spec-faithful `git add -- <allowlist>` + commit + tag. The recovery worked because the phases are narrated and the allowlist is documented — but the fix should make `applyReleaseWrites` persist the plan somewhere durable (e.g. `~/.kadmon/release-in-flight.json`) so ANY process can resume commit+tag from it.
- [ ] AUD-41 Per-fork upgrade runbook (Sentinel-harness + Kadmon7Cowork-Harness): both DIVERGED forks (own remotes, full source tree), both v1.3.0 + PRE-`tool_use_id`-migration. `git merge upstream/main` won't apply (unrelated histories, bootstrapped fresh) -> selective cherry-pick per fork. SHARED-DB gotcha: migration changed machine-global `~/.kadmon/kadmon.db` schema (3->4 col index); forks on old code hit `ON CONFLICT` mismatch -> their state-store goes dark. Sentinel = 11 commits (ADR-036 specialized, may not want everything); KadmonCowork = 58 commits (+2 agents, heavily diverged). Author the per-fork port plan when v1.4.0 is cut. Was WORK.md prose only until 2026-07-13.
- [ ] ECC validation experiment — run the evaluation and close it out (**OVERDUE**). 8 YAML seed instincts were planted in Kadmon-Sports 2026-04-27 to gate the `/instinct-import` port decision; the observation window closed ~2026-05-15 and v1.4.0 was cut without ever running the evaluation, so the gate it guarded has already passed. Run the evaluation queries against the verdict matrix, then decide: port `/instinct-import` into the harness, or drop it. Lives in the Kadmon-Sports repo (cross-project). Detail in the architect's private memory `project_ecc_validation_experiment` — never mirrored here, which is exactly why it stayed invisible until the 2026-07-16 orphan sweep.

- [x] Two stale statements in `.claude/rules/common/agents.md` — done 2026-07-19 (`chore/backlog-triage-2026-07-19`), the deliberate hand-edit the item asked for: (a) opus-for-doks justification now says **3 layers** (ADR-032 Amendment renumbering); (b) `/release` added to the Direct no-agent enumeration under "Orchestration Patterns (12 commands)" — the list now counts 12 matching the header, and the routing rules finally know the command exists (noted as composing `/doks` without invoking an agent itself, ADR-037). Originally surfaced read-only by /doks 2026-07-16.
- [x] `CHANGELOG.md` upgrade-advisory test count — resolved by the v1.5.0 consolidation exactly as planned: the entry (now under `## [1.5.0]`) reads "39 new tests" and a repo-wide grep finds zero remaining "38 new tests". Verified 2026-07-19 (`chore/backlog-triage-2026-07-19`), no edit needed.
- [ ] Dedupe the release subsystem's copy-pasted git helpers: `runGit` is TRIPLICATED (`orchestrate.ts:36`, `preflight.ts:15`, `tag.ts:11`) and `toGitError` duplicated (`orchestrate.ts:53`, `preflight.ts:24`), with `toReleaseError` (`tag.ts:75`) a near-sibling. spektr verified all three `runGit` copies are byte-identical in stdio config, so there is no behavioral divergence today — but three copies is three places to fix when one needs a timeout change or a stdio fix, and the drift would be silent. Noticed while scoping the silent-swallow pass 2026-07-16; kept out of that commit to keep it scoped.

## v1.3.1 roadmap items (open, priority order per roadmap file)

- [x] R-15 `"utf-8"` -> `"utf8"` stale-plans.ts — already applied in main since `214862f` (2026-07-13, docs-status-lint rewrite): both reads in `stale-plans.ts` use `"utf8"`; verified 2026-07-19, no edit needed. NOTE the roadmap's premise is stale repo-wide — `"utf-8"` still appears in ~12 other files (dashboard, changelog.ts, pattern-engine...), so "rest of codebase uses utf8" is false; normalize wholesale or drop the convention. · R-03 ABS_PATH_RE cosmetic — done 2026-07-19 (`chore/backlog-triage-2026-07-19`): `{1,}` -> `+`; the literal space in the char class is KEPT deliberately (dropping it would hide `C:\Program Files\...`-style paths from the ALV redaction report — a behavior regression, not a cosmetic fix) and documented in-code.
- [ ] R-09 shared DB-error fallback helper · R-06 param shadow capability-alignment · R-08 double-cast install-diagnostic-reader · R-07 export parseCommandFrontmatter + tests
- [ ] R-01 quadratic backtrack capability-matrix.ts:172 · R-02 batch per-file git log stale-plans.ts
- [ ] R-10 + R-32 backup-rotate EBUSY pair · R-33 git-push-reminder latency outlier (profile first)
- [ ] R-16 pyproject uncapped read · R-17 doks traversal guard prose-only
- [ ] R-21 detectMedikProfile silent fallthrough · R-22 $ARGUMENTS shell-quoting medik.md
- [ ] R-04 bandit probe cache · R-12 plugin-mode path JSDoc · R-31 post-compact auto-reload · R-14 nexus graph-freshness badge · R-20 doks consumer-.claude guard
- [ ] R-18, R-19, R-23..R-30 NOTE-tier batch (stale agent docs, env telemetry, Check #8 guard, test refactor, SQL regex, path.resolve, JSDoc, chekpoint helper, spawn keywords, size cap)

## v1.3.2 + epics

- [ ] v1.3.2 graphify optimizations (3 items — see docs/roadmap/v1.3.2-graphify-optimizations.md)
- [ ] plan-036 Sentinel-harness remaining phases (tracked in WORK.md)
- [ ] Session-start banner silent (Bug 3, plan-010 dogfood — promoted from private memory)
- [ ] Orphan-recovery trigger fails ~20% of sessions (ADR-022 internals OK — promoted from private memory)
- [d] Cost-tracker per-subagent attribution (needs arkitect ADR — v1.4 candidate)
- [ ] v2.0 epics: multi-project, Supabase sync, Skill Tier B-C (see docs/roadmap/v2.0-multi-project.md)
- [ ] v2.0 ECC-delta ports track, Waves 0-4 (see docs/roadmap/v2.0-ecc-delta-ports.md — 2026-07-17 analysis of affaan-m/ECC v1.8.0..v2.0.0; clone at `C:\Command-Center\_reference\ECC`). Wave 0 = the /forge blind fix (FIXED 2026-07-17, shipped v1.5.0 — see CHANGELOG); Waves 1-2 are S-effort ports (aside, kontinuum WHAT-NOT-TO-RETRY, fastapi/react-native packs); Waves 3-4 need ADRs (harness self-audit, hookify, chekpoint dedup+verify, selective installer).
