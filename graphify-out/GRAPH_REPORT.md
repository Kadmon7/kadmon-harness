# Graph Report - .  (2026-04-27)

## Corpus Check
- 133 files · ~323,803 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 585 nodes · 1136 edges · 24 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 149 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 48 edges
2. `nowISO()` - 22 edges
3. `Plan 028: v1.3 /medik Expansion Release` - 21 edges
4. `renderDashboard()` - 18 edges
5. `ADR-028: v1.3 Release — /medik Expansion + Diagnostic Export + Graphify Gate` - 16 edges
6. `Plan 015: Skavenger ULTIMATE Researcher` - 16 edges
7. `ADR-029: Capability & Metadata Alignment Audit` - 15 edges
8. `Plan 033: /medik project-agnostic` - 15 edges
9. `Plan 029: Capability & Metadata Alignment Audit` - 14 edges
10. `ADR-033: /medik project-agnostic via cwd-target-existence detection` - 13 edges

## Surprising Connections (you probably didn't know these)
- `detectProjectProfile()` --rationale_for--> `Plan 033: /medik project-agnostic`  [EXTRACTED]
  C:\Command-Center\Kadmon-Harness\scripts\lib\detect-project-language.ts → docs/plans/plan-033-medik-project-agnostic.md
- `detectMedikProfile()` --rationale_for--> `Plan 033: /medik project-agnostic`  [EXTRACTED]
  C:\Command-Center\Kadmon-Harness\scripts\lib\detect-project-language.ts → docs/plans/plan-033-medik-project-agnostic.md
- `readTypedInstallDiagnostics()` --rationale_for--> `Plan 028: v1.3 /medik Expansion Release`  [EXTRACTED]
  C:\Command-Center\Kadmon-Harness\scripts\lib\install-diagnostic-reader.ts → docs/plans/plan-028-v1.3-medik-expansion-release.md
- `detectPlatform()` --rationale_for--> `Plan 010: Harness Distribution Hybrid (Sprint D)`  [EXTRACTED]
  C:\Command-Center\Kadmon-Harness\scripts\lib\install-helpers.ts → docs/plans/plan-010-harness-distribution-hybrid.md
- `detectToolArgPresencePattern()` --rationale_for--> `Plan-006: Domain Pattern Engine`  [EXTRACTED]
  C:\Command-Center\Kadmon-Harness\scripts\lib\pattern-engine.ts → docs/plans/plan-006-domain-pattern-engine.md

## Hyperedges (group relationships)
- **Forge to Evolve handoff loop** — command_forge, concept_cluster_report, command_evolve, concept_project_hash [EXTRACTED 0.95]
- **Hybrid distribution mechanism** — adr_010_hybrid_distribution, concept_claude_code_plugin, concept_install_sh, adr_019_canonical_root_symlinks [EXTRACTED 0.90]
- **Session observability chain** — hook_session_start, concept_observations_jsonl, hook_session_end_all, concept_sqlite_db [EXTRACTED 0.90]
- **Project-Agnostic Command Trio (skanner/doks/medik)** — adr_031_skanner_project_agnostic, adr_032_doks_project_agnostic, adr_033_medik_project_agnostic [EXTRACTED 0.95]
- **v1.3 Release Components (medik expansion + capability audit + graphify gate)** — adr_028_v13_release, adr_029_capability_alignment_audit, adr_026_graphify_adoption [EXTRACTED 0.90]
- **/medik Check Modules Subsystem** — adr_028_medik_checks_subsystem, adr_029_medik_check_14, medik_command [EXTRACTED 0.90]
- **Skill loading evolution: enforcement -> syntax fix -> subdir layout** — plan_011_skill_loading_enforcement, plan_012_skill_frontmatter_syntax_fix, plan_013_skills_subdirectory_structure [EXTRACTED 0.90]
- **Project-agnostic refactor trio (skanner, doks, medik)** — plan_031_project_agnostic_skanner_stack, plan_032_doks_project_agnostic, plan_033_medik_project_agnostic [EXTRACTED 0.90]
- **v1.3 release pipeline (medik expansion + capability audit + post-release hygiene)** — plan_028_v13_medik_expansion_release, plan_029_capability_alignment_audit, plan_030_v130_post_release_hygiene [EXTRACTED 0.90]
- **skill-comply Pilot Series (kody + council + spektr)** — research_004_skill_comply_kody_pilot, research_005_kody_complete, research_005_council_pilot, research_006_spektr_pilot [EXTRACTED 0.95]
- **Evolve Generate Template Set (4 component types)** — agent_template, command_template, rule_template, skill_template [EXTRACTED 0.90]
- **Kadmon Harness Release Roadmap Chain (v1.0 → v2.0)** — roadmap_v1_0_production, roadmap_v1_1_learning_system, roadmap_v1_3_medik_expansion, roadmap_v1_3_1_performance_quality, roadmap_v2_0_multi_project [EXTRACTED 0.95]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (66): Bug A: hook_events.duration_ms always NULL, Bug B: sessions.ended_at < started_at inversion, ADR-007: Sprint C Data-Integrity Fixes, detectAnomalies(), getDbHealthReport(), applyForgePreview(), exportInstinctsToJson(), session-end-all.js hook (+58 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (72): ADR-019: Canonical Root Symlinks (referenced), KADMON_PROJECT_LANGUAGE env var, ADR-020: Runtime Language Detection, ADR-024: Install Health Telemetry (referenced), KADMON_SKANNER_PROFILE env override, Kody Exemption (harness-coupled by design), ADR-031: Project-agnostic /skanner via runtime profile detection, Three Profiles: Harness / Web / CLI (+64 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (58): ADR-013: Skill Layout (referenced), ADR-017: _TEMPLATE.md.example (referenced), scripts/lib/medik-checks/ subsystem (module-per-check), ADR-029: Capability & Metadata Alignment Audit, Capability Matrix data structure, Council Skill Silent Break (motivating incident), /medik Check #14 capability-alignment.ts, requires_tools: opt-in YAML frontmatter field (+50 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (55): Decision: Ephemeral Observations JSONL, ADR-003: Harness Distribution Strategy, Option A: Copy-based Bootstrap Script, Rationale: Rules+Permissions gap in plugins, Settings.json Merge Strategy, D5: ClusterReport handoff contract (JSON file IPC), ADR-005: /forge with /evolve handoff, D1: Rename /instinct to /forge (+47 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (54): ADR-010: Hybrid Distribution (referenced), ADR-024: Install Health Telemetry, Tri-state symlink detection (realpath divergence), CHANGELOG as Product Story, Rationale: Narrative Releases over One-Commit-Per-Release, SemVer Tightened Criteria (MAJOR/MINOR/PATCH), ADR-025: Versioning Policy — Narrative MINORs, PATCH Only for Post-Release Hotfixes, ADR-026: Graphify adoption as external knowledge-graph layer (+46 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (42): ADR-007: Sprint C / Hook Duration Instrumentation (referenced), Context: 8 angles plan-003 missed, ADR-010: Hybrid Plugin + Bootstrap Distribution, KADMON_RUNTIME_ROOT env var (plugin-mode resolver), ADR-019: Canonical Root Symlinks for Plugin Loader, Windows Developer Mode + core.symlinks=true, ADR-020: Runtime Language Detection (referenced), ADR-021: Install Allow Merge + .gitattributes (+34 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (31): findActiveSessionDir(), loadObservations(), main(), buildEventSequence(), checkSandbox(), isSpawnError(), queryPersistedHookEvents(), runHookDirect() (+23 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (31): ADR-009: Deep Research Capability (kerka), D1: New kerka agent (sonnet), Context: orphaned deep-research skill, ADR-014: Rename kerka to skavenger, ADR-015: Skavenger Ultimate Researcher, ADR-016: Skavenger Slim Refactor, almanak agent (Context7 only), skavenger agent (+23 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (20): Option 1: Phase 0 imperative skill load, ADR-011: Skill Loading Enforcement (superseded), Rationale: wrong diagnosis (skills field IS parsed), ADR-012: Skill Frontmatter YAML Syntax Fix, Decision: migrate to YAML list format, ADR-013: Skills Subdirectory Structure, ADR-017: Agent Template System, arkitect agent (opus) (+12 more)

### Community 9 - "Community 9"
Cohesion: 0.16
Nodes (17): applyProjectionInMemory(), assertSafeSessionId(), buildCluster(), computeClusterReport(), evaluateRecommendations(), extractCandidates(), projectInMemory(), readObservationsForSession() (+9 more)

### Community 10 - "Community 10"
Cohesion: 0.2
Nodes (17): computeHealthScore(), fmtDuration(), fmtMs(), fmtTokens(), getAgentStatRows(), getDbStatus(), getHookHealthRows(), getHookStatRows() (+9 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (17): Decision: 3-tier Context Management, Decision: Dual Persistence SQLite+Supabase, Decision: No Bash No Python (Node.js only), Decision: no-context-guard PreToolUse hook, ADR-001: v0.3 Foundations (Archived), Rationale: Python targets (Kadmon-Sports, COLMILLO-NBA), graphify (knowledge graph layer), Kadmon Harness (project) (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.31
Nodes (6): post-edit-security.js (hook #22), Plan 027: Python bandit SAST auto-invoke hook, classify(), isSpawnError(), reportTable(), runHook()

### Community 13 - "Community 13"
Cohesion: 0.48
Nodes (7): skill-comply 5-phase Protocol, Research 004 — Skill-Comply Kody Pilot, Council Skill Ownership Move (konstruct → /abra-kdabra), Research 005 — Skill-Comply Council Pilot, Research 005 — Skill-Comply Kody Complete (5/5), Spektr as Highest-Blast-Radius Agent, Research 006 — Skill-Comply Spektr Complete (3/3)

### Community 14 - "Community 14"
Cohesion: 0.5
Nodes (4): Evolve Generate — Agent Template, Evolve Generate — Command Template, Evolve Generate — Rule Template, Evolve Generate — Skill Template

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (3): Legacy experimentalDecorators (NestJS/Angular), ECMAScript Stage 3 Decorators, Research 002 — TypeScript Decorators 2026

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (3): GITHUB_TOKEN Ignored by Internal Git Library, Manual git clone Workaround for Private Plugin Repos, Research 003 — Claude Code Private Marketplace

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (3): Lost-in-the-Middle Positional Attention Degradation, Skill Activation Reliability (20% → 90% with examples), Research 008 — Auto-loaded Rules vs On-demand Skills

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (1): /chekpoint command

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (1): /nexus command (renamed from /kadmon-harness)

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (1): /abra-kdabra command

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (1): /doks command

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (1): konstruct agent (opus)

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (1): council skill

## Knowledge Gaps
- **149 isolated node(s):** `v1.2.2 Release`, `v1.2.1 Release`, `v1.0.0 Initial Release`, `/medik 9->14 checks expansion`, `/medik --ALV diagnostic export` (+144 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 22`** (1 nodes): `/chekpoint command`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `/nexus command (renamed from /kadmon-harness)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `/abra-kdabra command`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `/doks command`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `konstruct agent (opus)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `council skill`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Plan 028: v1.3 /medik Expansion Release` connect `Community 2` to `Community 0`, `Community 4`, `Community 6`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Why does `ADR-003: Harness Distribution Strategy` connect `Community 3` to `Community 0`, `Community 5`, `Community 6`, `Community 9`, `Community 11`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `getDb()` connect `Community 0` to `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 7`, `Community 10`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `getDb()` (e.g. with `runArchiveMigration()` and `runMigration()`) actually correct?**
  _`getDb()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `nowISO()` (e.g. with `applyForgePreview()` and `projectInMemory()`) actually correct?**
  _`nowISO()` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `renderDashboard()` (e.g. with `main()` and `getInstinctCounts()`) actually correct?**
  _`renderDashboard()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `v1.2.2 Release`, `v1.2.1 Release`, `v1.0.0 Initial Release` to the rest of the system?**
  _149 weakly-connected nodes found - possible documentation gaps or missing edges._