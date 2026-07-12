---
number: 36
title: Sentinel-harness — de-personalized security-specialized fork of Kadmon-Harness
date: 2026-06-24
status: accepted
route: A
plan: plan-036-sentinel-harness-fork.md
---

# ADR-036: Sentinel-harness — de-personalized security-specialized fork of Kadmon-Harness

**Deciders**: Ych-Kadmon (architect), arkitect (agent).

> **Scope note**: This ADR is a *meta-decision* recorded in the Kadmon-Harness repo. It governs the creation of a NEW standalone repository (`Sentinel-harness`) that begins life as a clean fork of this one. The locked decisions (use case, fork relationship, full de-personalization, four phased security pillars, the `Sentinel-harness` name) are NOT re-opened here — they are inputs. This ADR's job is to resolve the *how*: fork mechanism, de-personalization mechanics, component carry-over, phased security build, ADR home, and risk surfacing. Sentinel's own subsequent decisions get their own fresh `docs/decisions/` in the Sentinel repo (see §5).

## Context

Kadmon-Harness is Claude Code's operative layer for one individual (Ych-Kadmon / K.A.O.S): 16 agents, 48 skills, 11 commands, 19 rules, 22 hooks, distributed as a hybrid Claude Code plugin + `install.sh`/`install.ps1` bootstrap (ADR-010, ADR-019). It is deeply personalized — Mexican-Spanish register, the K.A.O.S persona, the caveman working style, and references to personal projects (ToratNetz, KAIRON, Kadmon-Sports) — and that personalization lives across two layers: the *user scope* (`~/.claude/CLAUDE.md`, which carries the persona/language/caveman) and the *repo scope* (the project `CLAUDE.md` plus 13 files inside `.claude/` that carry personal project examples, confirmed by grep on 2026-06-24).

A cybersecurity company (the target client is the firewall vendor "Check Point", which is why the fork is named *Sentinel*-harness and not anything containing "checkpoint") wants this same operative layer for its software-engineering teams, retargeted for a **secure-SDLC dev workflow**: security-focused code review, SAST/DAST in the pipeline, threat modeling, and (later) compliance gating and incident-response playbooks. It must carry none of the personal identity layer.

### Constraints

- **Name avoids `/chekpoint` collision.** The existing review command `/chekpoint` is a homophone of the client's brand. The repo name `Sentinel-harness` sidesteps that; whether to *rename the command itself* inside Sentinel is a carry-over question handled in §3.
- **Windows symlink mechanics must survive the fork.** Per CLAUDE.md "Distribution" and ADR-019, the plugin loader discovers components via canonical root symlinks (`./agents ./skills ./commands` → `.claude/<type>/`). These are git tree entries of mode `120000`. Any fork mechanism MUST preserve them as symlinks, not dereference them into copies. On Windows this requires Developer Mode ON + `git config core.symlinks true` + `MSYS=winsymlinks:nativestrict` at clone/copy time (ADR-019 §Decision step 4 gate).
- **Distribution model is replicated wholesale.** ADR-010 hybrid (plugin for agents/skills/commands/hooks + `install.sh`/`install.ps1` for rules/`permissions.deny`/`.kadmon-version`/marketplace registration). Distribution surface: `scripts/lib/install-apply.ts`, `scripts/lib/install-helpers.ts`, `scripts/lib/install-manifest.ts`, `scripts/generate-plugin-hooks.ts`. ADR-003 → ADR-010 → ADR-019 chain remains the canonical "why".
- **Purge-on-fork list** (must NOT travel): `~/.kadmon/kadmon.db` SQLite state, the `~/.claude/projects/<project>/memory/` auto-memory, `.claude/agent-memory/*/MEMORY.md` per-agent memory, personal graphify artifacts (`graphify-out/`), and the personal ADR/plan history (curate, don't bulk-delete).
- **Output-style preference.** The user STRONGLY PREFERS a neutral Claude Code **output style** (`.claude/output-styles/`) as the primary de-personalization mechanism — it is the native, low-surface-area lever — over hand-editing the identity prose in many files. Verified 2026-06-24: no `.claude/output-styles/` directory exists in Kadmon-Harness today, so this is greenfield in the fork.
- **Bonus tooling.** graphify v0.5.0 (`graphifyy`) exposes `graphify merge-graphs <g1> <g2>` for cross-repo graphs — usable for the upstream-sync diffing workflow.

### Key insight from the codebase audit

The persona/Spanish/caveman layer is **almost entirely user-scope** (`~/.claude/CLAUDE.md`), which a fork of *this repo* never copies. Inside the repo, the personal surface is bounded and shallow: the project `CLAUDE.md` plus 13 `.claude/` files that mostly use personal projects as *illustrative examples* (e.g. "RAG system design (ToratNetz)" in arkitect's Expertise, Supabase examples referencing personal stacks). This means de-personalization is a *small, enumerable edit set* plus a *new output style that sets the default voice* — not a deep rewrite of every agent.

## Options Considered

This ADR carries several sub-decisions. The two that genuinely have competing options are the **fork mechanism** (D1) and the **K-naming** question (D2). The rest (de-personalization mechanics, carry-over matrix, security phasing, ADR home) are specifications, presented in the Decision section.

### D1 — Fork mechanism

#### Option A: `git clone` (carry full history)
- **Pros**: Preserves provenance — every infra decision (ADR-010, ADR-019, the install-apply refactors) keeps its commit lineage; `git blame` works; future cherry-picks from upstream share a common ancestor, so `git cherry-pick <sha>` applies cleanly with real three-way merge bases.
- **Cons**: Carries ~hundreds of commits saturated with "órale"/K.A.O.S/personal scope in commit messages, the personal ADR/plan corpus, and the `~/.kadmon` references in history. A *de-personalized company tool* whose `git log` is full of one person's voice and personal projects is a leakage vector and an IP-entanglement signal (see Risks). Shared ancestry also tempts a naive `git pull upstream main` that would drag the identity layer back in.

#### Option B: Clean `git init` + curated file copy (no history)
- **Pros**: Zero personal commit history. The company repo starts at commit 1 with a neutral "initial import from Kadmon-Harness infra baseline @ <sha>" message. Clean IP story: the company artifact is a discrete, reviewable snapshot, not an entangled continuation of a personal repo. De-personalization leakage through `git log` is eliminated by construction.
- **Cons**: Loses `git blame`/provenance for carried-over code. Cherry-picking future upstream infra fixes is harder — there is no shared merge base, so `git cherry-pick` cannot three-way-merge; you fall back to patch-apply (`git format-patch` → `git am`, or manual port). Mitigated because infra fixes are low-frequency and Sentinel diverges permanently anyway.

#### Option C: `git clone` then history rewrite (`git filter-repo`)
- **Pros**: Keeps lineage for the carried files while scrubbing personal commit messages/authors.
- **Cons**: `filter-repo` on prose-heavy commit messages is best-effort — it can scrub authors and paths reliably but cannot semantically neutralize "órale" inside arbitrary commit bodies without a fragile regex pass. High effort, partial result, and it still leaves a shared ancestry that invites bad pulls. Worst-of-both.

### D2 — K-naming convention (arkitect/konstruct/spektr/...)

#### Option A: Keep K-naming as Sentinel's product branding
- **Pros**: Zero churn — the names appear in 16 agent files, `rules/common/agents.md` routing, CATALOG.md, command frontmatter, hook references, and dozens of skill cross-references. Renaming touches ~all of those and risks silent routing breakage (an agent referenced by old name in a rule no longer resolves). The K-names are *coined identifiers*, not Spanish/personal words — "konstruct"/"spektr"/"feniks" read as neutral product branding to an outside team.
- **Cons**: A couple of names lean playful (arkitect, konstruct with K). A security company might prefer literal role names. The names carry faint "harness personality" that a strict de-personalization brief could flag.

#### Option B: Neutralize to literal role names (architect/builder/security-reviewer/...)
- **Pros**: Maximally neutral and self-documenting for a new engineering team.
- **Cons**: Touches the single most cross-referenced naming surface in the harness. Every `agent:` frontmatter field, every routing rule in `agents.md`, every CATALOG row, every skill that names its owner agent, and the `agent-metadata-sync` hook all break unless updated atomically. High blast radius, high regression risk, near-zero functional gain — the K-names are not personal, they are coined. This is exactly the kind of churn ADR-019 Option A was rejected for.

## Decision

### D1 — Fork mechanism: **Option B (clean `git init` + curated copy)**, with the source SHA recorded.

A de-personalized company tool must not carry a personal commit history. The clean-init cost (harder cherry-picks, lost blame) is real but bounded: Sentinel is a *permanent divergence* (locked decision 2), so a shared merge base buys little over time, and infra fixes are infrequent enough that patch-apply is acceptable. The provenance concern is addressed without shared history: the initial commit message records `Imported from Kadmon-Harness infra baseline @ <sha>` and this ADR-036 (which lives in Kadmon-Harness, §5) is the durable provenance record. This is the immutability/clean-boundary principle applied to repositories: a new artifact, not a mutated continuation.

**Upstream-sync process** (cherry-pick infra, never identity):

1. **Tag the baseline.** In Kadmon-Harness, tag the source commit `sentinel-baseline-<date>`. Sentinel's initial commit references it.
2. **Classify upstream changes before porting.** Maintain `docs/UPSTREAM_SYNC.md` in Sentinel listing the last-synced Kadmon-Harness SHA. When pulling an infra improvement, classify the upstream commit:
   - **Infra** (install-apply, hook runtime resolution, `/medik` checks, pattern engine, state-store) → port.
   - **Identity** (CLAUDE.md persona, output style, personal examples, memory) → NEVER port.
   - **Mixed** → port only the infra hunks, hand-edit out identity hunks.
3. **Port mechanism.** No `git remote add upstream` + `git pull` (clean-init has no shared base and a pull would risk dragging identity). Instead: `git -C ../Kadmon-Harness format-patch <last-sync-sha>..<new-sha> -- scripts/lib/ .claude/hooks/` → review each patch → `git am` the infra-only ones into Sentinel, hand-resolving conflicts. Update `UPSTREAM_SYNC.md` with the new synced SHA.
4. **`merge-graphs` for diff intelligence.** Build a graphify graph of both repos and run `graphify merge-graphs kadmon-graph sentinel-graph` to get a cross-repo node/edge diff. This surfaces *which infra modules drifted* between upstream and the fork without reading every file — a query-first triage for "what changed in install-apply since last sync" that beats grepping two trees. It is a sync-triage aid, not the port mechanism itself.

### D2 — K-naming: **Option A (keep K-naming as Sentinel product branding).**

The K-names are coined identifiers, not personal/Spanish words, and renaming is the highest-blast-radius churn available for near-zero functional gain — precisely the trap ADR-019 documented when it rejected physical reorganization. Keep `arkitect`, `konstruct`, `spektr`, `feniks`, `kody`, etc. as Sentinel's neutral product vocabulary. The one defensible exception is the **`/chekpoint` command**, addressed in §3 below, because *that* name is a homophone of the client's brand and is user-facing on every commit.

---

### 1. Fork strategy (summary)

Clean `git init` snapshot of Kadmon-Harness at a tagged baseline SHA, into a new `Sentinel-harness` repo. Symlinks (`./agents ./skills ./commands`) are re-created as symlinks at copy time (NOT dereferenced) — on Windows the copy must run with Developer Mode ON, `git config core.symlinks true`, and `MSYS=winsymlinks:nativestrict`, exactly as ADR-019 mandates for a fresh clone. Distribution stack (`install-apply.ts`, `install-helpers.ts`, `install-manifest.ts`, `generate-plugin-hooks.ts`, `install.sh`, `install.ps1`) is carried as-is; the only edits are the `name`/`description`/`author` fields in `.claude-plugin/plugin.json` and `marketplace.json` (`kadmon-harness` → `sentinel-harness`), the `.kadmon-version` marker filename/content, and the `KADMON_*` env-var prefix decision (KEEP the `KADMON_` prefix in v1 to avoid a rename touching every hook and test — it is an internal token, invisible to Sentinel's users; revisit only if a Sentinel ADR finds a concrete reason). Upstream-sync as specified in D1.

### 2. De-personalization checklist

The strategy is **output-style-first**: a neutral output style sets the default voice (the cheap, native, low-surface lever), and a *bounded* edit set handles the residue the output style cannot reach.

**A. Neutral output style (`.claude/output-styles/sentinel.md`) — the primary mechanism.** Greenfield (no output-styles dir exists today). It covers everything that is *voice/register at response time*: English only, neutral professional tone, no Spanish register, no K.A.O.S persona, no emojis in prose, security-conscious framing as the default lens. Set it as the default in the project `CLAUDE.md` and document activation. This is "primary" because it neutralizes the *largest* personalization surface (conversational voice) without editing a single agent file — and because the persona/Spanish/caveman it replaces lived in *user scope* (`~/.claude/CLAUDE.md`), which the fork never copies anyway. Caveman is NOT installed (locked decision 3 — it is a separately-installed plugin; simply omit it).

**B. Files that still need explicit edits** (output style cannot reach prose baked into artifacts):
- **Project `CLAUDE.md`** — rewrite Identity/Philosophy/Active-Projects for Sentinel; remove the personal-projects list; point at the new output style; relabel "Kadmon Harness" → "Sentinel-harness"; keep the technical stack/structure/env-var sections intact.
- **`CLAUDE.md` user template** — ship a *neutral* `CLAUDE.md.template` that a company engineer drops into `~/.claude/` (or relies on company defaults). It must NOT contain persona/Spanish/caveman. This replaces the role that `~/.claude/CLAUDE.md` plays for the individual.
- **`statusline.sh`** — neutralize any persona text; keep the structural 3-line contract (session / cost+limits / git). It is user-scope so may simply be omitted and re-templated.
- **Language config** — set English as the only register; remove any Spanish-register memory triggers from rules/templates.
- **The 13 `.claude/` files carrying personal examples** (grep-confirmed 2026-06-24): `arkitect.md` (Expertise mentions ToratNetz/KAIRON), `kartograf.md`, `arkonte.md`, `python-reviewer.md`, `commands/abra-kdabra.md`, `skills/council`, `skills/workspace-surface-audit`, `skills/postgres-patterns`, `skills/frontend-patterns`, `skills/python-testing`, `skills/python-patterns`, `skills/claude-api`, `skills/api-design`. Edit = swap personal-project illustrative examples for neutral ones (e.g. "RAG system design (ToratNetz)" → "RAG system design"). These are example-swaps, not rewrites.

**C. K-naming decision**: KEEP (D2 above). Touches 16 agents + rules + CATALOG + hooks if changed → not worth it; names are coined, not personal.

**D. Purge (must NOT travel into the fork):**
- `~/.kadmon/kadmon.db` — not in the repo, but ensure Sentinel's state DB starts empty (project-hash isolation means a fresh repo gets a fresh hash automatically; no action beyond not copying any `*.db`).
- `~/.claude/projects/<project>/memory/` — auto-memory, user-scope, never copied.
- `.claude/agent-memory/*/MEMORY.md` — per-agent memory; copy the *structure* (empty dirs / the arkitect-style memory *protocol* prose in each agent) but ZERO accumulated entries.
- `graphify-out/` — personal knowledge-graph artifacts; regenerate fresh in Sentinel.
- `docs/decisions/` + `docs/plans/` — **curate, don't bulk-delete.** Carry the infra ADRs that explain *why the machinery works* (ADR-003/010/019 distribution chain, ADR-006 pattern engine, ADR-013 skills layout, ADR-029 capability alignment, ADR-035 catalogs) as Sentinel's inherited design rationale; DROP the personal/experiment ADRs (ECC experiment, personal-project-specific plans). Mark carried ones clearly as "inherited from Kadmon-Harness baseline".

**E. Memory reset**: every `.claude/agent-memory/<agent>/MEMORY.md` ships empty (or absent). The memory *protocol* (the "Before starting / After completing" prose in each agent's `## Memory` section) is carried as-is — it is mechanism, not content.

### 3. Component carry-over matrix

Classification: **(a) carry as-is**, **(b) re-theme** (neutralize examples or adjust security framing), **(c) new** security component to build. Not exhaustive — the notable cases:

| Component | Class | Notes |
|---|---|---|
| **Agents (16)** | | |
| `spektr` | (b) re-theme → **expand** | The security base. Carry as-is, then EXTEND in Phase 1 with STRIDE/attack-tree threat-modeling and SAST/DAST result triage (see §4). Highest-value carry-over. |
| `arkitect` | (b) re-theme | Remove ToratNetz/KAIRON from Expertise; add "secure-SDLC architecture / threat-model-informed design" so it co-owns threat modeling with spektr (locked decision 4). |
| `konstruct`, `feniks`, `mekanik`, `kody`, `typescript-reviewer`, `python-reviewer`, `orakle`, `kurator`, `arkonte`, `almanak`, `kartograf`, `doks`, `alchemik`, `skavenger` | (a) carry as-is | Language/quality/docs/research agents are domain-neutral. `python-reviewer`/`kartograf`/`arkonte` need the example-swap from §2.B only. |
| **Skills (48)** | | |
| `security-review` | (b) re-theme → expand | Code-level security base. Deepen for secure-SDLC; keep contract. |
| `security-scan` | (a) carry as-is | `.claude/` config security audit — already neutral and directly on-mission. |
| `safety-guard` | (a) carry as-is | Runtime guardrails — on-mission. |
| `architecture-decision-records`, `hexagonal-architecture`, `api-design`, `docker-patterns`, `tdd-workflow`, `verification-loop`, `git-workflow`, etc. | (a) carry as-is | Engineering skills; neutral. A handful (`postgres-patterns`, `frontend-patterns`, `python-*`, `claude-api`, `api-design`, `council`, `workspace-surface-audit`) need the §2.B example-swap. |
| **Threat-modeling skill** | (c) new | STRIDE / attack-tree methodology skill owned jointly by spektr + arkitect. None exists today (grep-confirmed). |
| **SAST/DAST-triage skill** | (c) new | How to read/triage Semgrep/CodeQL/OWASP-ZAP output into BLOCK/WARN/NOTE. |
| **Compliance-mapping skill** | (c) new | SOC2 / ISO 27001 control → code-evidence mapping (Phase 2). |
| **IR-playbook skill** | (c) new | Incident-response runbook methodology (Phase 2b). |
| **Commands (11)** | | |
| `/chekpoint` | (b) re-theme — **RENAME** | The ONE name worth changing: it is a homophone of the client's brand and is user-facing on every commit. Rename to `/checkup` or `/review-gate` (Sentinel's call). Then ADD a security-review gate (SAST + secret-scan + threat-model-delta) as a Phase-1 reviewer in the gate, and a compliance gate in Phase 2. |
| `/medik` | (b) re-theme → add checks | Add Phase-1 SAST-config and Phase-2 compliance checks via the existing `medik-checks/` module contract. |
| `/abra-kdabra`, `/forge`, `/evolve`, `/nexus`, `/kompact`, `/skanner`, `/skavenger`, `/almanak`, `/doks` | (a) carry as-is | Neutral workflow/observe/research/evolve commands; `/abra-kdabra` needs the §2.B example-swap. |
| **Security commands** | (c) new | `/threatmodel` (Phase 1), `/comply` (Phase 2), `/redteam` (Phase 2b) — see §4. |
| **Rules (19)** | | |
| `common/security.md`, `typescript/security.md`, `python/security.md` | (b) re-theme → expand | The rules base. Extend with secure-SDLC mandates (SAST-in-pipeline, threat-model-before-merge for security-sensitive surfaces, compliance footers). |
| All other rules (coding-style, testing, patterns, performance, git-workflow, agents, hooks) | (a) carry as-is | Domain-neutral operational logic. |
| **`secure-sdlc.md` rule** | (c) new | New rule encoding the Sentinel secure-SDLC workflow order and gates. |
| **Hooks (22)** | | |
| All lifecycle + observe + guard hooks | (a) carry as-is | `KADMON_RUNTIME_ROOT` resolution, no-context-guard, observe, session lifecycle, `bandit`/`post-edit-security` — all neutral and (bandit) already security-leaning. |
| **SAST PreToolUse/pre-commit hook** | (c) new (or extend `post-edit-security`) | Phase 1: run the configured SAST tool on edited files / staged diff, surface findings. Build on the existing `post-edit-security.js` (bandit) pattern, generalized to Semgrep/CodeQL. Respect hook latency budgets — heavy scans run at commit/CI, not per-edit. |

### 4. Security component spec (phased — builds ON the existing base)

The existing base is: `spektr` agent + `security.md` rules (common/ts/python) + `security-review`/`security-scan`/`safety-guard` skills + `post-edit-security.js` (bandit) hook + spektr's mandatory role in `/chekpoint`. Every phase extends this, never rebuilds it.

**Phase 1 — dev-integrated (SAST/DAST + vuln scan, threat modeling, secure-SDLC):**
- **Agents**: EXTEND `spektr` (add STRIDE/attack-tree threat modeling + SAST/DAST result triage to its Expertise/Workflow); EXTEND `arkitect` (threat-model-informed design as co-owner). No new agent — spektr is already opus and chartered for exactly this.
- **Skills (new)**: `threat-modeling` (STRIDE, attack trees, trust-boundary diagrams — owned by spektr+arkitect via `skills:` frontmatter, declare `requires_tools:` if it needs Bash/Task); `sast-triage` (Semgrep/CodeQL/OWASP-ZAP output → severity mapping).
- **Rules (new + extend)**: new `common/secure-sdlc.md` (workflow order: threat-model → design → implement → SAST → review → comply-check → commit); extend the three `security.md` files with SAST-in-pipeline and threat-model-before-merge mandates.
- **Commands (new + extend)**: new `/threatmodel` (arkitect+spektr produce a STRIDE model + attack tree for a feature/surface, written to `docs/threat-models/`); extend `/chekpoint` (renamed per §3) with a SAST + secret-scan reviewer phase; extend `/medik` with a SAST-config health check.
- **Hooks (new/extend)**: generalize `post-edit-security.js` beyond bandit to the configured SAST tool; add a commit-time SAST gate (heavy scan at commit, not per-edit, to respect the <500ms per-edit budget).

**Phase 2 — compliance (SOC2 / ISO 27001 + `/chekpoint` gate):**
- **Skills (new)**: `compliance-mapping` (control → code-evidence; e.g. SOC2 CC6.1 → access-control test coverage).
- **Rules (new)**: `common/compliance.md` (which controls gate which change classes).
- **Commands (new + extend)**: new `/comply` (audit a repo/feature against a SOC2 or ISO 27001 control set, emit a control-evidence report); extend the renamed `/chekpoint` gate to BLOCK on a missing required control for compliance-sensitive surfaces; extend `/medik` with compliance checks via the `medik-checks/` contract.
- **Agents**: `kurator`/`doks` can own compliance-evidence documentation; no new agent required.

**Phase 2b — incident response + red-team playbooks (standalone, lowest priority):**
- **Skills (new)**: `ir-playbook` (incident-response runbook methodology); `redteam-playbook` (offensive test-case methodology — clearly scoped as a *dev-side* red-team aid, not a live-ops pentest tool, consistent with locked decision 1).
- **Commands (new)**: `/redteam` (generate red-team test cases / attack scenarios for a surface), `/incident` (drive an IR runbook). Standalone module — does not gate the dev pipeline.
- **Agents**: a dedicated IR agent is OPTIONAL and deferred; spektr can own this initially.

### 5. ADR home

**Both, with a clear split.** This ADR-036 STAYS in Kadmon-Harness as the meta-decision (it documents *the fork itself* — a decision the upstream repo makes about spawning a downstream). It is the durable provenance record that D1's clean-init deliberately keeps out of git history. Sentinel-harness gets a **fresh `docs/decisions/`** starting at its own ADR-001 (Sentinel's first decision is typically "adopt the Kadmon-Harness infra baseline @ <sha>", which back-references this ADR-036 by URL). Carried-over infra ADRs (ADR-003/010/019 chain, etc.) are copied into Sentinel's `docs/decisions/` clearly marked `inherited from Kadmon-Harness baseline — see Kadmon ADR-036` so Sentinel engineers understand the machinery's rationale without inheriting the personal/experiment ADRs. Rationale: a fork that renumbers from ADR-001 has a clean, self-contained decision log; cross-repo provenance is preserved by the back-reference, not by carrying a foreign numbering scheme.

## Consequences

### Positive
- **Clean IP/provenance boundary.** Clean-init + this ADR-036 as the provenance record means the company artifact is a discrete, reviewable snapshot — no personal commit history, no `git log` leakage.
- **Output-style-first de-personalization is cheap and reversible.** The largest personalization surface (voice) is neutralized by one new file, not a 16-agent rewrite. The residual edit set is bounded to ~13 example-swaps + 3 CLAUDE.md/statusline rewrites.
- **Security base is reused, not rebuilt.** Every phase extends spektr / security.md / the three security skills / the bandit hook. Phase 1 ships fast because the chassis (spektr opus agent, /chekpoint mandatory security role, post-edit-security hook) already exists.
- **Distribution machinery carries with one-field edits.** ADR-010/019 hybrid is proven; only `plugin.json`/`marketplace.json` naming and the version marker change.
- **Permanent divergence is structurally enforced.** No `upstream` remote + format-patch porting prevents accidental identity re-import.

### Negative
- **Harder upstream cherry-picks.** Clean-init loses the shared merge base; infra fixes port via `format-patch`/`git am`, not `cherry-pick`. Mitigated by low infra-change frequency and `merge-graphs` drift triage.
- **Lost `git blame` provenance** for carried code. Mitigated by the recorded baseline SHA and the carried (marked) infra ADRs.
- **Two ADR numbering schemes** to keep straight (this ADR-036 in Kadmon; Sentinel's own ADR-001+). Mitigated by the explicit back-reference convention in §5.
- **`/chekpoint` rename touches every commit footer + the command + its rules references** inside Sentinel. Bounded but real; it is the one name worth the churn.

### Risks

- **IP / licensing separation — SURFACE TO USER, DO NOT RESOLVE HERE.** Kadmon-Harness is personal IP (currently `UNLICENSED`, private). Sentinel-harness is a company tool. The boundary between "personal IP that the individual carries to a client engagement" and "work-product owned by / licensed to the cybersecurity company" is a **legal/contractual question, not an architectural one.** This ADR flags it as the top risk: *before the fork ships, the ownership and licensing terms of the carried-over infra (install machinery, agents, skills, hooks) must be settled in writing between Ych-Kadmon and the company.* The clean-init mechanism (D1-B) was chosen partly to keep this boundary clean, but it does not by itself answer the ownership question. **Required action: user resolves IP/licensing with the company before fork ships.**
- **Symlink breakage on Windows.** The fork's `./agents ./skills ./commands` symlinks will silently fail to materialize on any Windows machine without Developer Mode + `core.symlinks true` + `MSYS=winsymlinks:nativestrict`. Mitigation: carry the ADR-019 install-time gate (install.sh/install.ps1 abort with the exact toggle + git config command) into Sentinel verbatim; document in Sentinel's README "Installing on Windows"; add the `/medik` symlink-resolution check.
- **Upstream-sync drift.** Over time Sentinel and Kadmon diverge; a careless port could drag identity hunks in, or Sentinel could miss a security-relevant infra fix. Mitigation: `UPSTREAM_SYNC.md` last-synced-SHA ledger + the Infra/Identity/Mixed classification gate in D1 + periodic `merge-graphs` diff to catch silent drift.
- **De-personalization leakage.** Personal refs surviving in subtle places — a comment in a hook, an example in a skill body, a commit message (eliminated by clean-init), a memory protocol example, a test fixture string, an emoji in prose that the output style missed. Mitigation: run the same grep used in this ADR's research (`K\.A\.O\.S|órale|neta|Mexican|español|ToratNetz|KAIRON|Kadmon-Sports|caveman`) as a CI gate in Sentinel that FAILS the build on any match outside an allow-list; re-run after every upstream sync.
- **Output-style under-coverage.** If a Sentinel engineer's *user-scope* `~/.claude/CLAUDE.md` carries their own persona, the project output style may not fully override it (user scope vs project scope precedence). Mitigation: document the precedence and ship the neutral `CLAUDE.md.template`; treat the output style as the default-voice setter, not a hard guarantee against a user who re-personalizes their own scope.

### Review date
**2026-09-24** (3 months), or immediately upon: (a) the IP/licensing question being resolved (re-evaluate whether clean-init is still the right mechanism), or (b) the first upstream-sync revealing that `format-patch` porting is more painful than projected (re-evaluate D1). If symlink breakage blocks more than the documented Windows setup, escalate to the ADR-019 fallback (physical reorganization) as a Sentinel-side successor ADR.

## Checklist verification

- **Functional**: fork strategy, de-personalization set, carry-over matrix, phased security spec, ADR home — all specified. Acceptance criterion per phase = the new components ship + the existing base is extended (not rebuilt).
- **Technical**: component boundaries clear (plugin carries agents/skills/commands/hooks; bootstrap carries rules/permissions/version — unchanged from ADR-010/019); migration path = clean-init + curated copy + output-style + bounded edits; Windows symlink path explicitly addressed.
- **Non-functional**: Windows compatibility (symlinks, install gate) verified against ADR-019; hook latency budgets respected (heavy SAST at commit/CI, not per-edit); security = the entire point.
- **Follow-up needed**: (1) IP/licensing resolution (user, blocking); (2) Sentinel's own ADR-001 adopting the baseline; (3) plan-036 (konstruct) sequencing the clean-init + de-personalization + Phase-1 build; (4) decide final `/chekpoint` replacement name in Sentinel.

## Amendment — 2026-06-24 (post-approval-gate resolutions)

The user reviewed the approval gate and resolved the three open items:

- **PF.1 / IP-licensing (was top blocking risk):** The user confirms Kadmon-Harness is **his own personal IP** and authorizes building the Sentinel fork. The company-side licensing/ownership arrangement is **deferred** ("luego vemos cómo le hacemos") — explicitly NOT a blocker for building the fork locally, but it remains the gate that must be settled in writing **before Sentinel ships to / is operated by the company**. The build may proceed; the ship-to-company step inherits the unresolved-terms caveat.
- **D2 `/chekpoint` exception — REVERSED. KEEP `/chekpoint` verbatim.** The user chose to keep the name as a deliberate wink toward the client ("Check Point"). This supersedes §3's carry-over-matrix RENAME row and every "renamed `/chekpoint`" / "`/review-gate`" reference in §4 and in plan-036 — all such references are void; `/chekpoint` is carried as-is. The command is still EXTENDED with the Phase-1 security-review gate and Phase-2 compliance gate; only the rename is cancelled. Net effect: the §Negative "rename touches every commit footer" cost disappears.
- **OQ-3 SAST default — Semgrep.** Phase-1 default SAST tool is **Semgrep** (fast, local, hook-friendly, multi-language, OSS tier, low install friction — fits the dev-loop hook + commit-gate budget). CodeQL is deferred as an optional deep CI-stage scan (GitHub Advanced Security). The generalized SAST hook (plan Step 2.6) must shell out through a **tool-agnostic adapter** so the company can later swap in an enterprise scanner (Checkmarx/Fortify/Coverity) without touching hook logic.
