---
number: 41
title: Step-0 project scaffolding in the installers
date: 2026-07-22
status: completed
needs_tdd: true
route: A
adr: ADR-041-step0-project-scaffolding.md
---

## Plan: Step-0 Project Scaffolding in the Installers [konstruct]

> Authority: `docs/decisions/ADR-041-step0-project-scaffolding.md` (accepted,
> user-approved at the /abra-kdabra gate 2026-07-22). This plan decomposes ADR-041
> into TDD-ordered red-green steps. `needs_tdd: true` — feniks executes the build
> after approval. Status flips to `in_progress` when the implementing session
> claims Step 1.1.

### Overview

The installers create `.claude/` and root dotfiles but no decision substrate, so
every new harness project starts with no `docs/decisions/`, `docs/plans/`,
`docs/research/`, `docs/state/`, or `BACKLOG.md`. This plan adds a single-purpose
`scripts/lib/install-scaffold.ts` module (create-if-missing, idempotent,
non-destructive) invoked by `install-apply.ts`, backed by a new on-disk template,
gated by an opt-out `--no-scaffold` / `-NoScaffold` flag that defaults ON. All real
logic lives in one testable TS module; the two shells gain only a flag pass-through.

### Assumptions (validated by reading the tree 2026-07-22)

- `install-apply.ts` parses args manually then Zod-validates (`argSchema`,
  `parseArgs`), exposes `runInstallApply(argv): InstallApplySummary`, resolves
  `REPO_ROOT = path.resolve(__dirname, "..", "..")`, and `main()` `console.log`s the
  summary JSON — verified `install-apply.ts:37-40,44-87,243-263`.
- Both shells call `install-apply.ts` unconditionally (outside `--dry-run`) and
  thread `--force-permissions-sync` via an `APPLY_ARGS`/`$applyArgs` array — verified
  `install.sh:186-201`, `install.ps1:131-153`. This is the exact precedent D3 mirrors.
- `--dry-run` short-circuits BEFORE `install-apply.ts` is invoked in both shells
  (`install.sh:195-201`, `install.ps1:140-153`), so a dry run performs no scaffolding
  for free — no new dry-run code is required to satisfy the "dry-run performs no
  scaffolding" assertion. See Flag #1 in Ambiguities.
- `settings.local.json` create-if-missing + sentinel-preservation (`install.sh:203-216`
  / `install.ps1:155-171`, test 6) is the idempotency precedent D4 mirrors.
- No `tests/lib/install-apply.test.ts` exists; the TS is covered only end-to-end by
  `tests/install/install-sh.test.ts` + `install-ps1.test.ts`. Per ADR D2/Test-surface,
  scaffold unit coverage lands in a NEW `tests/lib/install-scaffold.test.ts`; we do NOT
  retrofit an install-apply unit test.
- `install-ps1.test.ts` is predominantly STRUCTURAL (parses `install.ps1` content);
  only Test 8 executes via `it.runIf(powershellAvailable)`. Flag threading is asserted
  structurally there; e2e scaffold assertions must be `runIf`-guarded.
- Template convention = `.template.md` on disk with a `<ProjectName>` token left
  intact, copied verbatim (`docs/onboarding/CLAUDE.template.md:23`).

### Phase 0: Research (DONE — re-read these before coding)

- [x] `scripts/lib/install-apply.ts` — `argSchema`, `parseArgs` manual loop, `runInstallApply`, `InstallApplySummary`, `REPO_ROOT`.
- [x] `install.sh:22-78,186-241` — arg parse loop, `-*` unknown-option reject, `-h` help text, `APPLY_ARGS` pass-through, dry-run short-circuit.
- [x] `install.ps1:14-22,131-153` — `param()` block, `$applyArgs` pass-through, dry-run branch.
- [x] `tests/install/install-sh.test.ts` — `createFakeTarget`/`createFakeUserSettings`/`runInstallSh` harness, `it.runIf(bashAvailable)`, tests 1 (dry-run), 5-6 (create-if-missing + sentinel).
- [x] `tests/install/install-ps1.test.ts` — structural-first pattern, `it.runIf(powershellAvailable)` Test 8.
- [x] `docs/onboarding/CLAUDE.template.md` — `.template.md` + `<ProjectName>` verbatim-token convention; `BACKLOG.md:1-7` header/legend source.
- [x] ADR-041 D1-D6, Idempotency table, Test surface, Risks.

### Phase 1: Scaffold core (Minimum Viable — independently mergeable)

Delivers a tested, standalone scaffold module + template. Dead code until Phase 2
wires it, but fully proven and safe to merge on its own.

- [x] Step 1.1: Create `docs/onboarding/BACKLOG.template.md` (S)
  - File: `docs/onboarding/BACKLOG.template.md` (new)
  - Content: exactly the D5 skeleton — `# BACKLOG — <ProjectName>` H1, the header
    prose + `States:` legend, and the four empty priority headers (`## P0 — broken
    now`, `## P1 — consistency / quality`, `## P2 — features / trims`, `## P3 —
    someday / maybe`). English only (artifact structure, not content). `<ProjectName>`
    token left intact for verbatim copy.
  - Test-first target: none (data asset). Verified by Step 1.3's "copied verbatim" test,
    which reads this file — so its bytes are asserted transitively.
  - Done: file exists; H1 + legend + 4 priority headers present; no trailing template
    instructions leak into the copied body.
  - Depends on: none
  - Risk: Low

- [x] Step 1.2: RED — write `tests/lib/install-scaffold.test.ts` (M)
  - File: `tests/lib/install-scaffold.test.ts` (new)
  - Test-first target: all seven ADR Test-surface unit cases, each against a
    `fs.mkdtempSync` target (cleanup in `afterEach`, per `tests/install/*` pattern):
    1. create-all-on-empty → `docs/{decisions,plans,research,state}/` all created.
    2. `.gitkeep` present in each of the four created dirs.
    3. `BACKLOG.md` copied verbatim (byte-compare against `docs/onboarding/BACKLOG.template.md`).
    4. idempotent re-run → second `scaffoldProject` reports ALL paths in `skipped`, `created` empty.
    5. pre-existing `BACKLOG.md` (even 0-byte) never overwritten → bytes unchanged, reported `skipped`.
    6. pre-existing `docs/decisions/` → skipped AND receives no `.gitkeep` (never litters a dir it did not create).
    7. missing template → `scaffoldProject` throws a clear error (fail-loud), does not silently skip `BACKLOG.md`.
  - Also assert `ScaffoldResult.created`/`skipped` hold repo-relative, forward-slash
    paths (Windows/POSIX parity — see Risks).
  - Verify: `npx vitest run tests/lib/install-scaffold.test.ts` FAILS (module missing).
  - Depends on: 1.1
  - Risk: Low

- [x] Step 1.3: GREEN — implement `scripts/lib/install-scaffold.ts` (M)
  - File: `scripts/lib/install-scaffold.ts` (new, ~150 lines)
  - Export the exact ADR D1 contract:
    ```ts
    export interface ScaffoldResult {
      readonly created: readonly string[];
      readonly skipped: readonly string[];
    }
    export function scaffoldProject(targetRoot: string, repoRoot: string): ScaffoldResult
    ```
  - Manifest (D2): dirs `docs/decisions`, `docs/plans`, `docs/research`, `docs/state`
    (each `mkdir` + `.gitkeep` when absent); file `BACKLOG.md` at target root from
    `path.resolve(repoRoot, "docs/onboarding/BACKLOG.template.md")`.
  - Existence via `fs.existsSync` only — never inspect content. `.gitkeep` = empty file,
    dropped ONLY into a dir the function itself creates. Fail loud (throw) if the
    template is unreadable. Normalize reported paths to forward slashes.
  - Verify: `npx vitest run tests/lib/install-scaffold.test.ts` GREEN; `npx tsc --noEmit` clean.
  - Depends on: 1.2
  - Risk: Low

### Phase 2: Wire into install-apply.ts (Core Experience — default ON)

Both shells already call `install-apply.ts` unconditionally, so after this phase the
installer scaffolds by default. No shell change yet; the opt-out flag arrives in Phase 3
but the TS gate is built here so the wiring lands atomically.

- [x] Step 2.1: Thread `noScaffold` through arg parsing + summary type (M)
  - File: `scripts/lib/install-apply.ts`
  - `argSchema`: add `noScaffold: z.boolean().default(false)`.
  - `parseArgs` manual loop: add `else if (arg === "--no-scaffold") { noScaffold = true; }`
    and include `noScaffold` in the `argSchema.parse({...})` call (the schema alone is
    not enough — the manual loop is the real parser, mirroring `forcePermissionsSync`).
  - `InstallApplySummary`: add `scaffold?: ScaffoldResult` (optional).
  - Test-first target: extend `tests/lib/install-scaffold.test.ts` is NOT correct (that
    file tests the pure function); instead assert via Step 2.2's CLI verification. Type
    correctness is enforced by `tsc`. (See Flag #2 — no install-apply unit test per ADR.)
  - Verify: `npx tsc --noEmit` clean; `npx vitest run` full suite still green (no regression
    in install-sh/ps1 suites, which do not yet pass `--no-scaffold`).
  - Depends on: Phase 1 complete
  - Risk: Low

- [x] Step 2.2: Call `scaffoldProject` inside `runInstallApply`, gated by `noScaffold` (S)
  - File: `scripts/lib/install-apply.ts`
  - In `runInstallApply`, after user/project settings: `if (!parsed.noScaffold) { const
    scaffold = scaffoldProject(parsed.target, REPO_ROOT); return { ...projectResult,
    ...userResult, scaffold }; }` else return without `scaffold`.
  - Import `scaffoldProject` from `./install-scaffold.js` (`.js` extension, Node16).
  - Verify (manual CLI smoke, since no install-apply.test.ts): from a `mkdtemp` dir,
    `npx tsx scripts/lib/install-apply.ts --target <tmp>` prints JSON containing
    `scaffold.created` and creates `docs/{decisions,plans,research,state}/.gitkeep` +
    `BACKLOG.md` on disk; re-run reports all `skipped`; `--no-scaffold` omits `scaffold`
    and creates none. Automated e2e coverage arrives in Phase 3.
  - Depends on: 2.1
  - Risk: Medium (widens installer write surface from `.claude/` + dotfiles to `docs/` +
    `BACKLOG.md` — spektr reviews at /chekpoint; strictly create-if-missing)

### Phase 3: Shell opt-out flag + integration parity (Hardening)

Adds the opt-out flag to both shells and the automated e2e coverage that proves the
default-ON behavior, opt-out, and dry-run no-op across bash AND PowerShell.

- [x] Step 3.1: `install.sh` — add `--no-scaffold` flag + pass-through (S)
  - File: `install.sh`
  - Add `NO_SCAFFOLD=false`; add a `--no-scaffold) NO_SCAFFOLD=true; shift ;;` case in
    the arg loop BEFORE the `-*)` unknown-option reject (`install.sh:65`); add
    `--no-scaffold` to the `-h` help text; append `--no-scaffold` to `APPLY_ARGS` when set
    (mirror the `--force-permissions-sync` block at `install.sh:187-189`).
  - Verify: covered by Step 3.3 (structural + e2e).
  - Depends on: Phase 2 complete
  - Risk: Low

- [x] Step 3.2: `install.ps1` — add `-NoScaffold` switch + pass-through (S)
  - File: `install.ps1`
  - Add `[switch]$NoScaffold` to the `param()` block (`install.ps1:14-22`); append
    `--no-scaffold` to `$applyArgs` when `$NoScaffold` (mirror `install.ps1:132-134`).
  - Verify: covered by Step 3.4 (structural assertions).
  - Depends on: Phase 2 complete
  - Risk: Low

- [x] Step 3.3: Extend `tests/install/install-sh.test.ts` (M)
  - File: `tests/install/install-sh.test.ts`
  - New `it.runIf(bashAvailable)` cases (reuse `createFakeTarget`/`runInstallSh`):
    - Default run creates `docs/{decisions,plans,research,state}/.gitkeep` + root
      `BACKLOG.md` in the target.
    - `--no-scaffold <target>` creates NONE of them (assert each path absent).
    - `--dry-run <target>` performs no scaffolding (assert `docs/decisions` absent) —
      passes via the existing short-circuit; no new shell code required.
    - Re-run over a target with a pre-populated `BACKLOG.md` leaves it byte-identical
      (sentinel, mirrors test 6).
  - Verify: `npx vitest run tests/install/install-sh.test.ts` green on Windows Git Bash.
  - Depends on: 3.1
  - Risk: Low

- [x] Step 3.4: Extend `tests/install/install-ps1.test.ts` (M)
  - File: `tests/install/install-ps1.test.ts`
  - Structural assertions (host-agnostic, match the file's dominant pattern): `install.ps1`
    content contains `$NoScaffold` in the param block and `--no-scaffold` pass-through.
  - `it.runIf(powershellAvailable)` e2e parity: default `-TargetPath` run creates the four
    `.gitkeep`s + `BACKLOG.md`; `-NoScaffold` creates none; `-DryRun` scaffolds nothing.
  - Verify: `npx vitest run tests/install/install-ps1.test.ts` green (structural on all
    hosts; execution assertions on PowerShell hosts).
  - Depends on: 3.2
  - Risk: Low

### Testing Strategy

- Unit (`tests/lib/install-scaffold.test.ts`): the seven ADR cases — create-all,
  per-dir `.gitkeep`, verbatim template copy, idempotent skip, no-overwrite sentinel,
  pre-existing-dir-no-gitkeep, fail-loud on missing template — plus forward-slash
  repo-relative path normalization in `ScaffoldResult`. This is the primary coverage;
  it is fast (tmpdir, no shell spawn) and drives the red-green cycle.
- Integration (`tests/install/install-sh.test.ts`, `install-ps1.test.ts`): prove the
  full installer chain scaffolds by default, honors the opt-out flag, and no-ops under
  dry-run — across both shells. Slow (spawn + `npx tsx` cold start); kept to the minimum
  parity assertions.
- Manual CLI smoke (Step 2.2): direct `npx tsx install-apply.ts --target <tmp>` to verify
  the summary JSON `scaffold` field and on-disk effect before the shell e2e lands.
- Full gate: `npx vitest run` (whole suite green, no regression) + `npx tsc --noEmit` +
  `/chekpoint full` (spektr MANDATORY — installer writes files from computed paths).

### Risks & Mitigations

- Risk: installer overwrites a consumer's populated `BACKLOG.md` or hand-authored
  `docs/decisions/` -> Mitigation: strict create-if-missing on `fs.existsSync`, content
  never inspected; unit test 5 + 6 and the shell sentinel re-run assert byte-identity.
- Risk: empty `docs/` dir vanishes on clone (git ignores empty dirs) -> Mitigation:
  `.gitkeep` dropped into every dir the installer creates; unit test 2 + e2e assert each
  `.gitkeep` exists on disk.
- Risk: installer write-surface widening from `.claude/` to `docs/` + `BACKLOG.md` ->
  Mitigation: all paths computed from `targetRoot`/`repoRoot` via `path.resolve`/`path.join`,
  never from user-controlled strings; spektr reviews path handling at /chekpoint.
- Risk: Windows/POSIX path handling divergence between the two shells and in the reported
  paths -> Mitigation: all FS ops go through the single TS module (shells only pass a
  boolean flag — zero shell-side FS work for scaffolding); `ScaffoldResult` paths
  normalized to forward slashes so summary assertions pass on both OSes; e2e assertions
  in both suites accept the module's normalized output.
- Risk: template path unresolvable in plugin/CI contexts -> Mitigation: `REPO_ROOT` is
  derived from the module location (the cloned harness repo the installer runs from, not
  the plugin cache); `scaffoldProject` fails loud with a clear error if the template is
  missing (unit test 7).
- Risk: `--no-scaffold` / `-NoScaffold` drift between the two installers -> Mitigation:
  both thread the identical `--no-scaffold` string to one TS gate; parity tests in each
  suite (3.3, 3.4).

### Ambiguities / contradictions found (flag, do not resolve)

1. **Dry-run "describes but does not perform" (ADR D3) vs current short-circuit.** D3 says
   "a dry run describes but does not perform scaffolding." The existing shells short-circuit
   BEFORE `install-apply.ts` runs, so scaffolding never happens under `--dry-run` (the
   "does not perform" half holds with zero new code). But neither shell emits any `[DRY
   RUN] would scaffold ...` description line today, and D3's own mechanism is the
   short-circuit — so the "describes" half is unmet unless feniks adds a new dry-run log
   line. The ADR Test surface only asserts "`--dry-run` performs no scaffolding" (absence),
   not the presence of a description. This plan implements to the test (absence only) and
   flags the descriptive-line question for the implementer.

2. **Wiring has no dedicated automated test.** ADR D2/Test-surface explicitly say scaffold
   unit coverage lands in `install-scaffold.test.ts` and "No `tests/lib/install-apply.test.ts`
   exists today ... rather than retrofitting one." That leaves the `install-apply.ts` →
   `scaffoldProject` wiring (Step 2.1-2.2) covered only by the slow shell e2e in Phase 3,
   with a manual CLI smoke in between. Not a contradiction, but a coverage seam: Phase 2 is
   verifiable only manually or transitively via Phase 3. Flagged in case the implementer
   prefers a tiny direct `runInstallApply` assertion despite the ADR's "no retrofit" stance.

3. **`ScaffoldResult` entry granularity is unspecified.** D1/D4 say `created`/`skipped` hold
   "repo-relative paths" and the idempotency table treats a created dir as one row
   ("`mkdir` + write `.gitkeep`" → `created`). Whether a created directory contributes one
   entry (the dir) or two (dir + its `.gitkeep`) is not pinned down. This plan assumes one
   entry per manifest artifact (four dirs + `BACKLOG.md` = up to five entries) and asserts
   that in unit tests, but the exact strings are an implementation choice feniks locks in.

4. **PS1 flag-threading is structural-only by convention.** `install-ps1.test.ts` asserts
   most behavior by parsing file content, executing only under `runIf(powershellAvailable)`.
   The `-NoScaffold` threading is therefore best asserted structurally (matching the file),
   while true e2e scaffold parity only runs on PowerShell hosts. Noted so the implementer
   doesn't attempt an always-on execution assertion that would skip on non-Windows CI.

### Out of scope (per ADR-041)

- `WORK_COORDINATION.md` scaffolding — stays with `/sprint` (D6); the installer owns the
  decision-record substrate only.
- `CLAUDE.md` scaffolding — rejected (D6): auto-dropping a placeholder-filled `CLAUDE.md`
  would make Claude Code auto-load `<ProjectName>` junk as active instructions (correctness
  hazard). Stays a manual `CLAUDE.template.md` copy.
- `docs/roadmap/`, `docs/insights/`, `FINISHED_INITIATIVES.md` — not scaffolded (D6).
- Fork ports to Sentinel-harness / Kadmon7Cowork-Harness — AUD-41 manual cherry-pick
  runbook, run after this lands (Migration/port section of the ADR).
- Backfilling existing repos (e.g. Kadmon-Sports); a `/medik` scaffold-presence check;
  the `language.md` es-MX rule — separate BACKLOG items.

### Success Criteria

- [x] `scripts/lib/install-scaffold.ts` exports `scaffoldProject`/`ScaffoldResult` per ADR D1
  and passes all seven unit cases.
- [x] `docs/onboarding/BACKLOG.template.md` matches the D5 skeleton verbatim and is copied
  byte-for-byte into new targets.
- [x] A default installer run creates `docs/{decisions,plans,research,state}/.gitkeep` + root
  `BACKLOG.md`; a re-run reports all `skipped` and mutates nothing; `--no-scaffold` /
  `-NoScaffold` creates none; `--dry-run` / `-DryRun` scaffolds nothing.
- [x] Both shell integration suites (bash + PowerShell) assert the above with parity.
- [x] Full suite green (`npx vitest run`); TypeScript compiles (`npx tsc --noEmit`).
- [x] `/chekpoint full` passes with spektr review of the widened write surface — zero BLOCKs.
- [x] `manifest-schema.test.ts` `expectedCounts` untouched (no new agent/skill/command/hook/rule).
