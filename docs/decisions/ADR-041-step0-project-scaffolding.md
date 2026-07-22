---
number: 041
title: Step-0 project scaffolding in the installers
date: 2026-07-22
status: accepted
route: A
plan: plan-041-step0-project-scaffolding.md
references: [ADR-010, ADR-019, ADR-021, ADR-037, ADR-038]
---

# ADR-041: Step-0 Project Scaffolding in the Installers

**Deciders**: Ych-Kadmon (architect — core decision 2026-07-21, BioRambam session), arkitect (design + contract formalization). Status `accepted` — the architect approved at the `/abra-kdabra` gate 2026-07-22. Implementation tracked in plan-041.

## Context

The installers (`install.sh` / `install.ps1`, both delegating the non-trivial work to `scripts/lib/install-apply.ts`) create `.claude/` and its contents — rules, merged `settings.json`, `settings.local.json` template, `.gitignore` entries, `.kadmon-version` — and **nothing else**. Every new project that adopts the harness therefore starts with **zero decision substrate**: no `docs/decisions/`, no `docs/plans/`, no `docs/research/`, no `docs/state/`, no `BACKLOG.md`. The harness ships the machinery that *produces* ADRs, plans, and backlog items (`/abra-kdabra`, `/release`, `/chekpoint`, the `stale-plans` and `docs-status-lint` checks), but the directories those artifacts must land in do not exist until a human remembers to create them.

### The motivating incident (BioRambam, 2026-07-21)

A single BioRambam session ran **100+ edits, 4 commits, and 3 adversarial audit rounds with no decision record**, and escalated the finding count from **1 CRITICAL → 2 CRITICAL + 5 HIGH — one of the HIGH introduced by a patch applied during the audit**. The harness rules that mandate recording architectural decisions (`agents.md`, `development-workflow.md`, the ADR skill) were loaded the entire time. They were skipped anyway. This is the crux of the decision: **a rule is a reminder and depends on being followed.** The installer is not — it runs once, deterministically, before the first session, and leaves a structure on disk that is present whether or not any rule is later obeyed. The architect's directive is therefore explicit and load-bearing: **the mechanism MUST be the installer, NOT a rule in CLAUDE.md.**

### The empty-directory foot-gun (learned live)

While hand-scaffolding BioRambam on 2026-07-21, `docs/plans/` and `docs/research/` were created empty, staged, and found to be **invisible to `git status`** — git does not track empty directories. The scaffold existed on one disk only and would have vanished on the next clone. Any directory the installer creates empty **MUST** receive a `.gitkeep` placeholder, or the scaffold silently fails to propagate — the precise failure mode this ADR exists to prevent.

### Current-state evidence (read, not assumed)

| Artifact | Location | How it works today |
|----------|----------|--------------------|
| Rules copy | `install.sh:159-176` / `install.ps1:102-121` | `cp -r` / `Copy-Item` — simple, so it lives in shell. |
| `settings.json` merge | `scripts/lib/install-apply.ts:133-183` | deny + allow merge (ADR-010 Q4, ADR-021 Q1) — non-trivial, idempotent, so it lives in **TS**, invoked by both installers via `npx tsx`. |
| User plugin registration | `install-apply.ts:197-239` | `extraKnownMarketplaces` + `enabledPlugins` in `~/.claude/settings.json`. |
| `settings.local.json` template | `install.sh:203-216` / `install.ps1:155-171` | create-if-missing, **never overwritten** (sentinel test 6). The existing idempotency precedent. |
| `.gitignore` entries | `install.sh:218-241` / `install.ps1:173-198` | whole-line dedup append (`grep -Fxq` / `-notcontains`). The existing dedup precedent. |
| Existing flag precedent | `install.ps1:21` `-ForcePermissionsSync` / `install.sh:34` `--force-permissions-sync`, plus `--dry-run` | switch → threaded to `install-apply.ts --force-permissions-sync`. |
| Consumer templates home | `docs/onboarding/CLAUDE.template.md`, `docs/onboarding/reference_kadmon_harness.md` | the established directory for "what a new project receives." |
| Coordination-doc template | `.claude/skills/sprint/WORK_COORDINATION.template.md` | owned + instantiated by `/sprint` (STOPs if missing; interactive roster fill). |
| Installer test surface | `tests/install/install-sh.test.ts`, `tests/install/install-ps1.test.ts` | integration tests spawn the shells against a `mkdtempSync` fake target. **No `tests/lib/install-apply.test.ts` exists** — the TS is covered only end-to-end. |

### Constraints

- **Installer, not rule** (architect directive, non-negotiable — see incident above).
- **A file that does not exist is never missed** (architect directive): templates ship complete with any optional sections explicitly marked, so the consumer deletes rather than authors.
- **Windows-first**: no shell `date`/`mkdir -p` semantic assumptions; path handling via `path.resolve()`; parity between the two installers.
- **Idempotent + non-destructive**: re-running the installer must never overwrite a populated `BACKLOG.md` or clobber an existing `docs/` tree (same guarantee `settings.local.json` already gives).
- **Compose with a pending sibling ADR**: "converge `WORK.md` ↔ `WORK_COORDINATION.md`" (BACKLOG P1) is unresolved and the coordination doc is mid-rebrand (`# KadmonCowork — Work Coordination`). This ADR must not preempt it.
- **Six-repo standard**: the templates' source of truth is THIS repo; Sentinel-harness and Kadmon7Cowork-Harness are **diverged forks with unrelated histories** — the port is a manual cherry-pick, not a merge (AUD-41).
- **Route A**: a new cross-file mutation surface in the installer plus a new template asset and a new library module.

## Decision

### D1 — Scaffold logic lives in a new `scripts/lib/install-scaffold.ts`, invoked by `install-apply.ts`; the shells only pass a flag

A new single-purpose module `scripts/lib/install-scaffold.ts` exports one function:

```ts
export interface ScaffoldResult {
  readonly created: readonly string[];   // repo-relative paths the installer created
  readonly skipped: readonly string[];   // repo-relative paths that already existed
}

export function scaffoldProject(
  targetRoot: string,
  repoRoot: string,
): ScaffoldResult
```

`install-apply.ts` calls `scaffoldProject(parsed.target, REPO_ROOT)` from inside `runInstallApply` (gated by D3) and threads the result into `InstallApplySummary` as an optional `scaffold?: ScaffoldResult` field. `main()` already `console.log`s the summary JSON, so the created/skipped report surfaces for free and for tests.

**Why TS, not shell (the decisive call)**: the scaffold is idempotent, manifest-driven, and reports structured create/skip results — exactly the profile of `settings.json` merging, which already lives in `install-apply.ts` precisely *because* it is non-trivial and testable. Duplicating manifest iteration + create-if-missing + `.gitkeep` placement across bash **and** PowerShell would (a) double the maintenance and drift surface, (b) forfeit `:memory:`-style tmpdir unit testing, and (c) repeat the shell-duplication anti-pattern ADR-037 §D2 rejected for `/release`. Because both installers already delegate to `install-apply.ts`, the shell-side change is reduced to threading **one boolean flag** — the shells never touch the filesystem for scaffolding.

**Why a separate module, not inline in `install-apply.ts`**: SRP + the <200-line file preference + independent TDD. `install-apply.ts` owns settings; `install-scaffold.ts` owns directory/file substrate. This mirrors the module-per-concern precedent of `scripts/lib/release/` (ADR-037 §D2) and `scripts/lib/medik-checks/` (ADR-028).

### D2 — Scaffold manifest (exact)

The installer creates the following in the **target** repo. Every artifact is **create-if-missing**; nothing is ever overwritten or deleted.

**Directories** — created empty, each seeded with a `.gitkeep` at creation time so git tracks it:

| Path | `.gitkeep` on create | Rationale |
|------|:---:|-----------|
| `docs/decisions/` | yes | ADRs are needed from commit 1 — the incident is an ADR gap. |
| `docs/plans/` | yes | `/abra-kdabra` Route A/B writes here; shares the ADR counter. |
| `docs/research/` | yes | `/skavenger` auto-write target (ADR-015). |
| `docs/state/` | yes | Ephemeral working-state surface; a documented BioRambam convention (see D6). |

**Files** — instantiated from a template on disk, create-if-missing:

| Path | Source template | Rationale |
|------|-----------------|-----------|
| `BACKLOG.md` (repo root) | `docs/onboarding/BACKLOG.template.md` | Canonical location = repo root (D5). |

`.gitkeep` is dropped **only into a directory the installer itself creates**. If `docs/decisions/` already exists (populated or not), the installer skips it entirely and adds no `.gitkeep` — it never litters a directory it did not create.

**Template on disk, not inline strings** (architect directive): `BACKLOG.md` content is read from `docs/onboarding/BACKLOG.template.md`, grouping it with the existing consumer-onboarding templates (`CLAUDE.template.md`, `reference_kadmon_harness.md`) so a maintainer finds "everything a new project receives" in one directory. The template is copied **verbatim** — the `<ProjectName>` token is left intact for the consumer/Claude to fill on first edit, matching the `CLAUDE.template.md` convention exactly. (An optional enhancement — substituting the target's basename for `<ProjectName>` — is noted but deferred to keep the first cut a pure copy.)

### D3 — Opt-out flag `--no-scaffold` / `-NoScaffold`, default ON

Scaffolding runs by **default**. An opt-out switch mirrors the existing `-ForcePermissionsSync` precedent exactly:

- `install.sh`: `--no-scaffold` case → `APPLY_ARGS+=(--no-scaffold)`.
- `install.ps1`: `[switch]$NoScaffold` → appends `--no-scaffold`.
- `install-apply.ts`: `argSchema` gains `noScaffold: z.boolean().default(false)`; when true, `runInstallApply` skips `scaffoldProject` and the summary omits `scaffold`.
- `--dry-run` already short-circuits before `install-apply.ts` is invoked, so a dry run describes but does not perform scaffolding — consistent with current behavior for every other step.

**Why opt-out, never opt-in**: the entire rationale of the decision is "the installer does the right thing without anyone remembering." An opt-in flag would reintroduce the reliance-on-memory that a rule already fails at. The flag exists only for the legitimate minority — a repo that deliberately keeps ADRs elsewhere (a wiki, a monorepo-shared `docs/`) and does not want an empty `docs/decisions/.gitkeep`. Because scaffolding is create-if-missing, such a repo is not *harmed* by the default; the flag is a courtesy against clutter, not a safety gate. The cost is one boolean per entry point — negligible.

### D4 — Idempotency contract (per artifact)

`scaffoldProject` is safe to run any number of times; a re-run converges rather than duplicating.

| Artifact | Exists? | Action | Reported as |
|----------|---------|--------|-------------|
| `docs/<dir>/` | present (any contents) | no-op — do not add `.gitkeep` | `skipped` |
| `docs/<dir>/` | absent | `mkdir` + write `.gitkeep` | `created` |
| `BACKLOG.md` | present (even 0-byte) | no-op — **never overwrite** | `skipped` |
| `BACKLOG.md` | absent | copy template verbatim | `created` |

Existence is `fs.existsSync` — content is never inspected, so a consumer's populated `BACKLOG.md` or a hand-authored `docs/decisions/` is inviolable. This is the same non-destructive posture as the `settings.local.json` sentinel (test 6) and the `.gitignore` whole-line dedup. Reporting is structured (`{ created, skipped }` of repo-relative paths) so both the JSON summary and the human checklist can state exactly what happened.

### D5 — `BACKLOG.md` canonical location = repo root; template = header + 4-priority skeleton

`BACKLOG.md` lands at the **repo root** — the majority location (3-2) across the audited repos, and what this repo's own `/chekpoint` drift-reminder text (ADR-038 §3) already assumes.

Template content (`docs/onboarding/BACKLOG.template.md`), matching this repo's header prose and the 5-marker legend, with the P0–P3 skeleton the architect specified:

```markdown
# BACKLOG — <ProjectName>

Operational work queue. One line per item, linked to detail where a longer write-up exists.
`docs/roadmap/` (if present) keeps the release narrative; this file is what gets picked up
next. On release, done items move to the CHANGELOG and are pruned here.

States: `[ ]` open · `[~]` in progress · `[x]` done · `[-]` dropped · `[d]` deferred.

## P0 — broken now

## P1 — consistency / quality

## P2 — features / trims

## P3 — someday / maybe
```

The template header + legend are **harness-authored structure** and stay in English even though a consumer's *content* may be es-MX per the pending `language.md` rule — the artifact-vs-content distinction. This ADR does not encode the language rule (it is not yet accepted); it only ships a neutral English skeleton.

### D6 — Keep `docs/state/`; do NOT scaffold `WORK_COORDINATION.md`, `docs/roadmap/`, `FINISHED_INITIATIVES.md`, or `CLAUDE.md`

- **`docs/state/` — kept.** It is not speculative: the pending `language.md` BACKLOG item enumerates `docs/state/` as an es-MX artifact surface alongside `BACKLOG.md` and `WORK_COORDINATION.md`, i.e. an established BioRambam convention for ephemeral working state. This repo lacks one only because it predates the convention (it uses root `WORK.md` instead). Scaffolded as an empty `.gitkeep` directory. **Honest limit (no_context)**: I could not read BioRambam's tree from this working directory; the semantic ("ephemeral working state, es-MX prose") is taken from the language-rule item's enumeration, not from a direct read of BioRambam's `docs/state/`. If the convergence ADR (below) redefines it, this is a one-line manifest edit.

- **`WORK_COORDINATION.md` — NOT scaffolded; left to `/sprint`.** This is the deliberate composition boundary. `/sprint` already owns instantiation (`.claude/skills/sprint/WORK_COORDINATION.template.md`, STOP-if-missing, interactive roster + Next-planned fill the installer cannot replicate). Three forces make installer ownership actively wrong right now: (1) a pending ADR converges `WORK.md` ↔ `WORK_COORDINATION.md` and may rename or merge the file; (2) a separate branding pass is mutating its H1 to `# KadmonCowork — Work Coordination`; (3) the installer has no roster to fill, so it could only drop a placeholder stub — arguably worse than absent. Leaving the coordination doc to its single owner (`/sprint`) means **this ADR composes with either outcome of the convergence ADR**: keep-both or merge-into-one, `/sprint` adopts it and the installer never learns the coordination-doc shape. Should the convergence ADR later decide the installer *should* own it, that is an additive amendment to this manifest (D2), not a rework. Clean SRP split: **the installer owns the decision-record substrate; `/sprint` owns the coordination doc.**

- **`docs/roadmap/` and `docs/insights/` — NOT scaffolded.** The architect's list names decisions/plans/research/state, not roadmap. A repo *grows into* a release roadmap and audit-insights corpus; ADRs and plans are needed from commit 1. Scaffolding empty roadmap/insights dirs would ship clutter that violates "a file that does not exist is never missed."

- **`FINISHED_INITIATIVES.md` — NOT scaffolded (evaluated, dropped).** It exists in exactly **one** of six repos (Kadmon-Sports) — a one-off, not a convergent convention. It also duplicates "done work" already tracked in two places (`BACKLOG.md` `[x]` items and the CHANGELOG); adding a fourth "done" surface to every new repo *before* the `WORK.md` ↔ `WORK_COORDINATION.md` convergence question is settled would spread the exact drift ADR-038 fought. Promoting it later is a one-line manifest addition — cheap to defer, expensive to un-scaffold across 6 repos. Revisit if a second repo independently adopts it.

- **`CLAUDE.md` — NOT auto-scaffolded.** `CLAUDE.template.md` is intentionally named `.template.md` so Claude Code does **not** auto-load it, and it is meant to be a manual human copy-and-fill (project identity, mission, stack). Auto-dropping a placeholder-filled `CLAUDE.md` would cause Claude Code to auto-load `<ProjectName>`/`<src-dir>` junk as active project instructions — a correctness hazard strictly worse than its absence. It stays a documented manual step (already covered by `docs/onboarding/CLAUDE.template.md`).

## Alternatives Considered

### Alternative A: A rule in CLAUDE.md ("always scaffold docs/ + BACKLOG on a new project")
- **Pros**: zero code; trivially portable to all six repos by copying one rule line.
- **Cons**: a rule is advisory and depends on being followed. The motivating incident is precisely a session that skipped the loaded rules for 100+ edits. Documentation without a mechanical actor decays the moment attention moves.
- **Why not**: rejected by explicit architect directive and by the incident evidence. This is the whole reason the mechanism must be the installer.

### Alternative B: Inline the directory/file creation directly in `install.sh` + `install.ps1` (shell duplication)
- **Pros**: no new TS module; matches how the simple `cp -r` rules step and `.gitignore` step already work in shell.
- **Cons**: doubles the manifest + `.gitkeep` + create-if-missing + reporting logic across bash and PowerShell (drift surface, Windows-path hazards); forfeits unit testing against a tmpdir; repeats the shell-duplication anti-pattern ADR-037 §D2 rejected.
- **Why not**: the scaffold's profile (idempotent, manifest-driven, structured reporting) is the settings-merge profile, which already lives in `install-apply.ts` for exactly these reasons. TS wins decisively.

### Alternative C: Installer instantiates `WORK_COORDINATION.md` too (scaffold everything the BACKLOG item names)
- **Pros**: superficial completeness — new repos have every named file after install.
- **Cons**: `/sprint` already owns it with an interactive fill the installer cannot do; a pending convergence ADR may rename/merge it; a branding pass is mutating its header. An installer copy would be a stale, placeholder-filled stub the moment either lands — creating migration debt across 6 repos.
- **Why not**: violates the "compose with the pending sibling ADR" constraint and SRP. Leaving it to `/sprint` is what makes this ADR outcome-agnostic.

### Alternative D: Ship templates as inline string constants in `install-apply.ts`
- **Pros**: one fewer file to read at runtime; no template-path resolution.
- **Cons**: not editable or testable as data; a maintainer tuning the BACKLOG header edits a TS string literal instead of a `.md` file; diverges from the `.template.md`-on-disk convention (`CLAUDE.template.md`, `WORK_COORDINATION.template.md`).
- **Why not**: rejected by explicit architect directive ("prefer files on disk over inline strings — testable, editable").

## Consequences

### Positive
- Every new harness project starts with a live decision-record substrate (`docs/decisions/`, `docs/plans/`, `docs/research/`, `docs/state/`) and a canonical `BACKLOG.md` — the ADR-gap class of the BioRambam incident is structurally closed, not reminded-against.
- The `.gitkeep` rule closes the empty-directory foot-gun that would otherwise make the scaffold vanish on clone (a silent one-disk-only failure).
- Idempotent + non-destructive: re-running the installer on an existing repo scaffolds only what is missing and never touches populated files — the same guarantee `settings.local.json` already gives.
- Minimal shell change: both installers gain only a flag pass-through; all real logic is one testable TS module.
- Sets a single-source-of-truth standard for all six repos, portable via a documented cherry-pick (AUD-41).

### Negative
- New module (`scripts/lib/install-scaffold.ts`) + new template (`docs/onboarding/BACKLOG.template.md`) + new tests to maintain — the SRP/module-per-concern price.
- Scaffolding widens the installer's write surface from `.claude/` + root dotfiles to `docs/` + `BACKLOG.md`. Mitigation: strictly create-if-missing; `spektr` reviews the path handling during the build `/chekpoint` (installer writes files from computed paths).
- `docs/state/`'s semantic is inherited from a convention this repo does not itself use — a small speculative edge, accepted because the manifest cost is one `.gitkeep` and the convergence ADR can redefine it cheaply.

### Risks

| Risk | Mitigation |
|------|------------|
| Installer overwrites a consumer's populated `BACKLOG.md` or hand-authored `docs/decisions/` | Strict create-if-missing on `fs.existsSync`; content never inspected; sentinel test asserting a pre-existing `BACKLOG.md` is byte-identical after re-run (mirrors `settings.local.json` test 6). |
| Empty `docs/` dir vanishes on clone (git ignores empty dirs) | `.gitkeep` dropped into every directory the installer creates empty; test asserts each `.gitkeep` exists on disk. |
| `--no-scaffold` / `-NoScaffold` drift between the two installers | Both thread the identical `--no-scaffold` flag to one TS gate; parity test in each installer suite. |
| Convergence ADR later reshapes `WORK_COORDINATION.md` and this ADR conflicts | This ADR deliberately does not own it (D6); composes with keep-both or merge-into-one. |
| Template path unresolvable in plugin/CI contexts | Template read via `path.resolve(repoRoot, "docs/onboarding/BACKLOG.template.md")`; `install-scaffold.ts` fails loud with a clear error if the template is missing (never silently skips `BACKLOG.md`). |
| Fork port silently omits the template asset | AUD-41 port checklist enumerates all five touch-points (below); a fork that ports the code but not the template hits the fail-loud guard immediately. |

## Test surface (for konstruct → feniks)

- **New** `tests/lib/install-scaffold.test.ts` (unit, `mkdtempSync` target): create-all-on-empty; `.gitkeep` present in each created dir; `BACKLOG.md` copied verbatim; idempotent re-run reports all `skipped`; pre-existing `BACKLOG.md` never overwritten; pre-existing `docs/decisions/` skipped and given no `.gitkeep`; missing template → fail-loud.
- **Extend** `tests/install/install-sh.test.ts`: end-to-end assert `docs/{decisions,plans,research,state}/.gitkeep` and root `BACKLOG.md` exist after a real `install.sh` run; `--no-scaffold` produces none of them; `--dry-run` performs no scaffolding.
- **Extend** `tests/install/install-ps1.test.ts`: the same assertions for parity.
- No `tests/lib/install-apply.test.ts` exists today; the scaffold's unit coverage lands in the new `install-scaffold.test.ts` rather than retrofitting one.

## Component-count impact

**None.** No agent, skill, command, hook, or rule is added — only a library module, a template asset, and tests. The `manifest-schema.test.ts` `expectedCounts` contract is untouched, and the C-001 nine-surface count pass is **not** triggered. (Minor follow-up, out of scope: `/release`'s upgrade-advisory already classifies `install.{sh,ps1}` + `install-apply.ts` as install-territory, so a scaffold change correctly advises consumers to re-run install; the advisory classifier does not need to learn the new template path because the install-territory rule already covers the driver.)

## Migration / port

- **Backward compatible + additive.** Existing installs are unaffected until the installer is re-run, at which point scaffolding is create-if-missing — no breakage. Repos that already have `docs/decisions/` etc. get `skipped`.
- **Port checklist (AUD-41 — manual cherry-pick, unrelated fork histories, do NOT `git merge`):**
  1. `scripts/lib/install-scaffold.ts`
  2. `docs/onboarding/BACKLOG.template.md`
  3. `install.sh` + `install.ps1` hunks (`--no-scaffold` / `-NoScaffold` flag + pass-through)
  4. `scripts/lib/install-apply.ts` wiring (arg + `runInstallApply` call + summary field)
  5. `tests/lib/install-scaffold.test.ts` + the two integration-test extensions
  - **Cowork note**: if the branding ADR has landed in Kadmon7Cowork-Harness, that repo's `BACKLOG.template.md` carries the `# KadmonCowork —` H1 — but that is Cowork's session per the branding BACKLOG item, not this ADR's scope.

## Out of scope (NOT in this ADR)

- **`WORK_COORDINATION.md` instantiation** — stays with `/sprint` (D6); revisit only if the convergence ADR reassigns it.
- **Backfilling existing repos** (e.g. Kadmon-Sports) — a separate BACKLOG item, run *after* this template lands so it consumes the template rather than a hand copy.
- **A `/medik` check that a consumer repo has the scaffold** — plausible future hygiene, deliberately not built here (speculative; the installer is the actor, not an audit).
- **The `language.md` es-MX rule** — a separate P1 item; this ADR ships a neutral English skeleton and does not encode language routing.
- **`docs/roadmap/`, `docs/insights/`, `FINISHED_INITIATIVES.md`, `CLAUDE.md`** — excluded with rationale (D6).

## Review

- **Next review**: 2027-01-22 (6 months). Evidence to evaluate: did new repos actually accrue ADRs/plans after scaffolding (did the substrate get used, or does it sit empty)? Did `docs/state/` earn its place or stay an empty `.gitkeep`? Did the convergence ADR land, and does D6's boundary still compose? Was `--no-scaffold` ever used (if never, consider dropping it)?
- **Superseding conditions**: if the `WORK.md` ↔ `WORK_COORDINATION.md` convergence ADR decides the installer should own the coordination doc, amend D2's manifest. If a second repo adopts `FINISHED_INITIATIVES.md`, revisit its exclusion.

## no_context Application

Grounded in direct reads: `install.sh:159-292` and `install.ps1:102-247` (the shell steps that do — and do not — scaffold, plus the `-ForcePermissionsSync` / `--dry-run` flag precedent and the `settings.local.json` create-if-missing + `.gitignore` dedup patterns reused here); `scripts/lib/install-apply.ts:44-263` (the Zod arg schema, `runInstallApply`, `InstallApplySummary`, and REPO_ROOT/target path resolution the scaffold plugs into); `tests/install/install-sh.test.ts` (the `mkdtempSync` integration-test harness and the sentinel-preservation test #6 the idempotency contract mirrors) and the confirmed absence of `tests/lib/install-apply.test.ts`; `docs/onboarding/CLAUDE.template.md` (the `.template.md`-on-disk + `<ProjectName>` token + not-auto-loaded conventions) and `.claude/skills/sprint/WORK_COORDINATION.template.md` + `.claude/skills/sprint/SKILL.md:23-27,131` (that `/sprint` owns instantiation and STOPs if the file is missing); `BACKLOG.md:1-7,48-113,150-164` (the header/legend template source, the verbatim Step-0 decision inputs, the branding + convergence + `language.md` sibling items, and `docs/state/`'s es-MX enumeration); and ADR-010/019/021/037/038 for distribution model, what the installer does not copy, the flag + allow-merge precedent, the module-per-concern + upgrade-advisory territories, and the BACKLOG legend + working-docs status standard. The BioRambam incident metrics and the empty-directory foot-gun are taken verbatim from the architect's BACKLOG entry, not invented; the one point I could not verify from this working directory — the exact contents of BioRambam's `docs/state/` — is flagged as such in D6.
