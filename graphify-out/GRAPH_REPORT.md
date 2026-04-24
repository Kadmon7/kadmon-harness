# Graph Report - .  (2026-04-23)

## Corpus Check
- 181 files · ~249,099 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 809 nodes · 1429 edges · 67 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 153 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Database and Session Store|Database and Session Store]]
- [[_COMMUNITY_Forge Pipeline and Pattern Engine|Forge Pipeline and Pattern Engine]]
- [[_COMMUNITY_E2E Workflow Test Harness|E2E Workflow Test Harness]]
- [[_COMMUNITY_Dashboard and Migrations|Dashboard and Migrations]]
- [[_COMMUNITY_ADR Foundations and Distribution|ADR Foundations and Distribution]]
- [[_COMMUNITY_Versioning Policy (ADR-025)|Versioning Policy (ADR-025)]]
- [[_COMMUNITY_Forge-Evolve Handoff Contract|Forge-Evolve Handoff Contract]]
- [[_COMMUNITY_Evolve Generate Engine|Evolve Generate Engine]]
- [[_COMMUNITY_Install Health and Telemetry|Install Health and Telemetry]]
- [[_COMMUNITY_Install Apply and Helpers|Install Apply and Helpers]]
- [[_COMMUNITY_Dashboard Renderer|Dashboard Renderer]]
- [[_COMMUNITY_Harness Genesis and Bugs|Harness Genesis and Bugs]]
- [[_COMMUNITY_Plugin Distribution Templates|Plugin Distribution Templates]]
- [[_COMMUNITY_ECC Learning System Port|ECC Learning System Port]]
- [[_COMMUNITY_Forge Report Writer|Forge Report Writer]]
- [[_COMMUNITY_Plugin Session Dogfood|Plugin Session Dogfood]]
- [[_COMMUNITY_Smoke-All-Hooks Harness|Smoke-All-Hooks Harness]]
- [[_COMMUNITY_Session-End Pattern Evaluation|Session-End Pattern Evaluation]]
- [[_COMMUNITY_YouTube Transcript Module|YouTube Transcript Module]]
- [[_COMMUNITY_Insights Report 2026-04-17|Insights Report 2026-04-17]]
- [[_COMMUNITY_Research Report Persistence|Research Report Persistence]]
- [[_COMMUNITY_Session-End Hook Tests|Session-End Hook Tests]]
- [[_COMMUNITY_Project Language Detection|Project Language Detection]]
- [[_COMMUNITY_Agent Frontmatter Linter|Agent Frontmatter Linter]]
- [[_COMMUNITY_ClusterReport IPC Contract|ClusterReport IPC Contract]]
- [[_COMMUNITY_Cost Calculator|Cost Calculator]]
- [[_COMMUNITY_Hook Duration Instrumentation|Hook Duration Instrumentation]]
- [[_COMMUNITY_Orphan Staleness Detection|Orphan Staleness Detection]]
- [[_COMMUNITY_Skavenger Deep Research Agent|Skavenger Deep Research Agent]]
- [[_COMMUNITY_Pre-Compact Hook Tests|Pre-Compact Hook Tests]]
- [[_COMMUNITY_Rotating JSONL Log|Rotating JSONL Log]]
- [[_COMMUNITY_Skill Frontmatter Syntax Fix|Skill Frontmatter Syntax Fix]]
- [[_COMMUNITY_Plugin Hooks Generator|Plugin Hooks Generator]]
- [[_COMMUNITY_Session-Start Hook Tests|Session-Start Hook Tests]]
- [[_COMMUNITY_Manifest Schema Tests|Manifest Schema Tests]]
- [[_COMMUNITY_Domain Pattern Engine|Domain Pattern Engine]]
- [[_COMMUNITY_Skavenger Slim Refactor|Skavenger Slim Refactor]]
- [[_COMMUNITY_pgvector HNSW Research|pgvector HNSW Research]]
- [[_COMMUNITY_Agent Template System|Agent Template System]]
- [[_COMMUNITY_Runtime Language Detection|Runtime Language Detection]]
- [[_COMMUNITY_Windows PowerShell Installer|Windows PowerShell Installer]]
- [[_COMMUNITY_commit-quality Hook Tests|commit-quality Hook Tests]]
- [[_COMMUNITY_git-push-reminder Hook Tests|git-push-reminder Hook Tests]]
- [[_COMMUNITY_is-disabled Hook Tests|is-disabled Hook Tests]]
- [[_COMMUNITY_log-hook-event Tests|log-hook-event Tests]]
- [[_COMMUNITY_mcp-health Hook Tests|mcp-health Hook Tests]]
- [[_COMMUNITY_no-context-guard Tests|no-context-guard Tests]]
- [[_COMMUNITY_ts-review-reminder Tests|ts-review-reminder Tests]]
- [[_COMMUNITY_Skill-Comply Methodology|Skill-Comply Methodology]]
- [[_COMMUNITY_backup-rotate Tests|backup-rotate Tests]]
- [[_COMMUNITY_block-no-verify Tests|block-no-verify Tests]]
- [[_COMMUNITY_commit-format-guard Tests|commit-format-guard Tests]]
- [[_COMMUNITY_config-protection Tests|config-protection Tests]]
- [[_COMMUNITY_console-log-warn Tests|console-log-warn Tests]]
- [[_COMMUNITY_daily-log Tests|daily-log Tests]]
- [[_COMMUNITY_deps-change-reminder Tests|deps-change-reminder Tests]]
- [[_COMMUNITY_ensure-dist Tests|ensure-dist Tests]]
- [[_COMMUNITY_generate-session-summary Tests|generate-session-summary Tests]]
- [[_COMMUNITY_hook-logger Tests|hook-logger Tests]]
- [[_COMMUNITY_observe-post Tests|observe-post Tests]]
- [[_COMMUNITY_observe-pre Tests|observe-pre Tests]]
- [[_COMMUNITY_post-edit-format Tests|post-edit-format Tests]]
- [[_COMMUNITY_post-edit-typecheck Tests|post-edit-typecheck Tests]]
- [[_COMMUNITY_pr-created Tests|pr-created Tests]]
- [[_COMMUNITY_quality-gate Tests|quality-gate Tests]]
- [[_COMMUNITY_Agent Template Rationale|Agent Template Rationale]]
- [[_COMMUNITY_TS Decorators Research|TS Decorators Research]]

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 45 edges
2. `tmpDir()` - 24 edges
3. `nowIso()` - 20 edges
4. `renderDashboard()` - 19 edges
5. `runEvolveGenerate()` - 13 edges
6. `openDb()` - 12 edges
7. `runForgePipeline()` - 11 edges
8. `upsertInstinct()` - 11 edges
9. `log()` - 11 edges
10. `ADR-025: Versioning Policy â€” Narrative MINORs, PATCH Only for Post-Release Hotfixes` - 11 edges

## Surprising Connections (you probably didn't know these)
- `loadObservations()` --calls--> `tmpDir()`  [INFERRED]
  C:\Command-Center\Kadmon-Harness\scripts\dashboard.ts → C:\Command-Center\Kadmon-Harness\scripts\lib\utils.ts
- `findActiveSessionDir()` --calls--> `tmpDir()`  [INFERRED]
  C:\Command-Center\Kadmon-Harness\scripts\dashboard.ts → C:\Command-Center\Kadmon-Harness\scripts\lib\utils.ts
- `main()` --calls--> `renderDashboard()`  [INFERRED]
  C:\Command-Center\Kadmon-Harness\scripts\dashboard.ts → C:\Command-Center\Kadmon-Harness\scripts\lib\dashboard.ts
- `queryPersistedHookEvents()` --calls--> `openDb()`  [INFERRED]
  C:\Command-Center\Kadmon-Harness\scripts\dogfood-plugin-session.ts → C:\Command-Center\Kadmon-Harness\scripts\lib\state-store.ts
- `queryPersistedHookEvents()` --calls--> `getHookEventsBySession()`  [INFERRED]
  C:\Command-Center\Kadmon-Harness\scripts\dogfood-plugin-session.ts → C:\Command-Center\Kadmon-Harness\scripts\lib\state-store.ts

## Hyperedges (group relationships)
- **Skill loading correction saga (ADR-011 â†’ ADR-012 â†’ ADR-013)** — adr_011_skill_loading_enforcement, adr_012_skill_frontmatter_syntax_fix, adr_013_skills_subdirectory_structure [EXTRACTED 0.95]
- **Harness distribution evolution (ADR-003 â†’ ADR-010 â†’ ADR-019 â†’ ADR-021)** — adr_003_harness_distribution, adr_010_harness_distribution_hybrid, adr_019_canonical_root_symlinks, adr_021_install_allow_merge [EXTRACTED 0.95]
- **Skavenger agent lifecycle (ADR-009 â†’ ADR-014 â†’ ADR-015 â†’ ADR-016)** — adr_009_deep_research_capability, adr_014_rename_kerka_to_skavenger, adr_015_skavenger_ultimate, adr_016_skavenger_slim_refactor [EXTRACTED 0.95]
- **Forgeâ†’Evolve producer-consumer handoff pipeline** — plan005_forge_pipeline, plan005_cluster_report, plan005_forge_report_writer, plan008_evolve_report_reader, plan008_run_evolve_generate, plan008_apply_evolve_generate [EXTRACTED 0.90]
- **Hybrid distribution stack (plugin + bootstrap + runtime primitive)** — plan010_plugin_manifest, plan010_generate_plugin_hooks, plan010_install_sh, plan010_kadmon_runtime_root, plan003_harness_distribution [EXTRACTED 0.90]
- **Skills loader reliability chain (YAML syntax + subdir layout + linter)** — plan011_skill_loading_superseded, plan012_yaml_syntax_fix, plan012_yaml_block_list, plan013_skills_subdir, plan013_skill_md_uppercase, plan012_lint_frontmatter [EXTRACTED 0.90]
- **Evolve Generate Template Set (4 artifact types)** — evolve_template_agent, evolve_template_command, evolve_template_rule, evolve_template_skill [EXTRACTED 0.95]
- **Skill-Comply Reports (methodology applied across agents)** — research004_skill_comply_kody_pilot, research005_skill_comply_kody_complete, research006_skill_comply_spektr, research004_compliance_methodology [EXTRACTED 0.90]
- **v1.1 Sprint D Distribution (plan + loader + hybrid install)** — roadmap_v11_sprint_d_distribution, plan019_canonical_root_symlinks, plan019_plugin_loader_auto_discovery, plan019_windows_dev_mode_requirement [EXTRACTED 0.90]

## Communities

### Community 0 - "Database and Session Store"
Cohesion: 0.05
Nodes (65): seed(), detectAnomalies(), getDbHealthReport(), nowIso(), applyForgePreview(), contradictInstinct(), createInstinct(), decayInstincts() (+57 more)

### Community 1 - "Forge Pipeline and Pattern Engine"
Cohesion: 0.09
Nodes (27): makeFixture(), applyProjectionInMemory(), assertSafeSessionId(), buildCluster(), computeClusterReport(), evaluateRecommendations(), extractCandidates(), projectInMemory() (+19 more)

### Community 2 - "E2E Workflow Test Harness"
Cohesion: 0.08
Nodes (27): cleanupTmpDir(), runHook(), setupTmpFixtures(), globalTeardown(), createTestDir(), createFakeTarget(), createFakeUserSettings(), detectPowerShell() (+19 more)

### Community 3 - "Dashboard and Migrations"
Cohesion: 0.09
Nodes (21): findActiveSessionDir(), loadObservations(), main(), main(), runArchiveMigration(), makeInstinct(), main(), main() (+13 more)

### Community 4 - "ADR Foundations and Distribution"
Cohesion: 0.06
Nodes (40): Decision: Dual Persistence (SQLite + Supabase), Decision: Ephemeral Observations as JSONL, Decision: No Bash, No Python (Node.js only), Decision: no-context-guard PreToolUse hook, ADR-001: v0.3 Foundations (Archived), ADR-003: Harness Distribution (copy-based bootstrap) â€” superseded, Option A: Bootstrap Script (copy-based), Rationale: rules + permissions.deny are non-negotiable (+32 more)

### Community 5 - "Versioning Policy (ADR-025)"
Cohesion: 0.06
Nodes (36): ADR-010 Harness Distribution Hybrid (referenced), ADR-020 Runtime Language Detection (referenced), ADR-024 Install Health Telemetry (referenced), Anti-patterns: one-commit = one release, Human-review enforcement (no mechanical gate), MAJOR â€” breaking changes to public contract, MINOR â€” narrative feature ready for collaborators, PATCH â€” post-release hotfix only (+28 more)

### Community 6 - "Forge-Evolve Handoff Contract"
Cohesion: 0.08
Nodes (32): ClusterReport type contract (handoff for /evolve), /instinct deprecation alias (through 2026-04-20), forge-pipeline.ts (runForgePipeline + applyForgePreview), Plan-005: /instinct â†’ /forge refactor with unified pipeline, forge-report-writer.ts (writeClusterReport, retention), agent-metadata-sync hook (PostToolUse Edit|Write), applyEvolveGenerate (single mutator, transactional), Plan-008: Sprint B /evolve Generate step 6 cross-project pipeline (+24 more)

### Community 7 - "Evolve Generate Engine"
Cohesion: 0.16
Nodes (20): applyEvolveGenerate(), buildSpec(), buildTargetPath(), categoryToType(), computeSourceWindow(), defaultReportsDir(), deriveComplexity(), deriveConfidence() (+12 more)

### Community 8 - "Install Health and Telemetry"
Cohesion: 0.15
Nodes (17): mkReport(), setup(), checkInstallHealth(), detectAnomalies(), detectSymlink(), normalizePath(), findByName(), mkJunction() (+9 more)

### Community 9 - "Install Apply and Helpers"
Cohesion: 0.2
Nodes (16): applyProjectSettings(), applyUserSettings(), main(), parseArgs(), readJsonOrEmpty(), runInstallApply(), writeJson(), detectPlatform() (+8 more)

### Community 10 - "Dashboard Renderer"
Cohesion: 0.29
Nodes (17): computeHealthScore(), fmtDuration(), fmtMs(), fmtTokens(), getAgentStatRows(), getDbStatus(), getHookHealthRows(), getHookStatRows() (+9 more)

### Community 11 - "Harness Genesis and Bugs"
Cohesion: 0.13
Nodes (18): Bug #1: Canonical symlinks cloned as text files on Windows, Bug #2: PreToolUse:Agent hook error (bash.exe skipping), Bug #3: /reload-plugins required after first install, Context Footprint (~18K tokens always-loaded, 3 tiers), 8 founding ADRs (ADR-001-v03-foundations), Kadmon Harness Genesis, Hook Reliability (ensure-dist, hook-logger, backup-rotate), Orchestration Chain (commands â†’ agents â†’ skills) (+10 more)

### Community 12 - "Plugin Distribution Templates"
Cohesion: 0.14
Nodes (18): Agent Evolve Template, Command Evolve Template, Rule Evolve Template, Skill Evolve Template, Plan 019: Canonical Root Symlinks for Plugin Loader, plugin.json Pruning (commands, skills fields removed), Plugin Loader Auto-Discovery, Windows Developer Mode Requirement (+10 more)

### Community 13 - "ECC Learning System Port"
Cohesion: 0.14
Nodes (16): Alchemik Rubric (Phase 3), Confidence Decay (-0.02/week), Cross-Project Auto-Promotion, Plan 018: ECC Features Port, migrate-v0.5.ts last_observed_at, user_correction Detector Ruled Out, Research 007: Graphify Spec from YouTube, Graphify External CLI Tool (+8 more)

### Community 14 - "Forge Report Writer"
Cohesion: 0.29
Nodes (11): assertSafeBaseDir(), assertSafeSessionId(), defaultBaseDir(), exportInstinctsToJson(), isUnder(), kadmonRoot(), pruneOldReports(), readClusterReport() (+3 more)

### Community 15 - "Plugin Session Dogfood"
Cohesion: 0.29
Nodes (11): buildEventSequence(), checkSandbox(), formatReport(), isSpawnError(), queryPersistedHookEvents(), runHookDirect(), runPluginModeDogfood(), cleanupDir() (+3 more)

### Community 16 - "Smoke-All-Hooks Harness"
Cohesion: 0.26
Nodes (10): classify(), generateStdin(), isSpawnError(), parseSettings(), reportTable(), runHook(), makeFailResult(), makeHook() (+2 more)

### Community 17 - "Session-End Pattern Evaluation"
Cohesion: 0.35
Nodes (10): addSessionToDb(), buildAgentDocsLines(), buildReadEditWriteLines(), buildStateStoreLines(), makeFindingLine(), makeObsLine(), openReadDb(), runHook() (+2 more)

### Community 18 - "YouTube Transcript Module"
Cohesion: 0.4
Nodes (7): buildCanonicalUrl(), checkYtDlp(), detectLanguage(), extractVideoId(), fetchYouTubeTranscript(), isMediaUrl(), parseVtt()

### Community 19 - "Insights Report 2026-04-17"
Cohesion: 0.18
Nodes (11): Insights Report â€” 2026-04-17, Semantic emoji override (docs/insights/ only), Win: Empirical verification over trust, Win: Full-stack rewrites preserving core, Interaction style: system-level orchestrator + skeptical reviewer, Friction Loop: diagnose without resolution, Friction Loop: Claude caves under pushback, Friction Loop: session lifecycle compact/exit noise (+3 more)

### Community 20 - "Research Report Persistence"
Cohesion: 0.4
Nodes (6): buildFrontmatter(), escapeYamlString(), padNumber(), runPersistReport(), sample(), validateSlug()

### Community 21 - "Session-End Hook Tests"
Cohesion: 0.44
Nodes (7): generateObsLines(), generatePatternALines(), makeObsLine(), readDb(), runHook(), seedDb(), writeObservations()

### Community 22 - "Project Language Detection"
Cohesion: 0.42
Nodes (5): detectProjectLanguage(), getToolchain(), isProjectLanguage(), safeExists(), cleanEnv()

### Community 23 - "Agent Frontmatter Linter"
Cohesion: 0.28
Nodes (3): lintAgentFrontmatter(), writeAgent(), writeSkill()

### Community 24 - "ClusterReport IPC Contract"
Cohesion: 0.28
Nodes (9): ClusterReport typed JSON IPC contract, ADR-005: /forge pipeline + /evolve handoff contract, Rationale: verb/noun split (/forge = action, instinct = data), ADR-006: Domain-specific pattern definitions, New pattern type: file_sequence, Rationale: hygiene patterns duplicate hooks (self-reinforcing loop), Pattern: alchemik proposes, /evolve command writes, Decision Q1: artifacts written to cwd/.claude/, not harness tree (+1 more)

### Community 25 - "Cost Calculator"
Cohesion: 0.39
Nodes (4): calculateCost(), estimateCharsPerToken(), formatCost(), resolvePricing()

### Community 26 - "Hook Duration Instrumentation"
Cohesion: 0.5
Nodes (6): assertDurationMs(), cleanSession(), hookEventsFile(), hookPath(), lastHookEvent(), runHook()

### Community 27 - "Orphan Staleness Detection"
Cohesion: 0.43
Nodes (4): isOrphanStale(), resolveStaleMs(), obsPathFor(), seedObs()

### Community 28 - "Skavenger Deep Research Agent"
Cohesion: 0.32
Nodes (8): Rationale: orphaned deep-research skill violates chain rule, ADR-009: Deep Research Capability (kerka/skavenger), Rationale: 'scavenger' describes multi-source research workflow, ADR-014: Rename kerka â†’ skavenger, ADR-015: Skavenger ULTIMATE Researcher, Three gaps: no docs, one-shot, single-angle, Rationale: Route D had 449 LOC with zero real invocations, ADR-016: Skavenger slim refactor (Route D removed, A expanded)

### Community 29 - "Pre-Compact Hook Tests"
Cohesion: 0.48
Nodes (5): makeObsLine(), readDb(), runHook(), seedDb(), writeObservations()

### Community 30 - "Rotating JSONL Log"
Cohesion: 0.38
Nodes (3): readRotatingJsonlLog(), setup(), writeRotatingJsonlLog()

### Community 31 - "Skill Frontmatter Syntax Fix"
Cohesion: 0.33
Nodes (7): ADR-011: Skill loading enforcement â€” superseded by ADR-012, Wrong diagnosis: assumed skills: field not parsed by loader, Evidence: docs.claude.com/sub-agents confirms native skills: parsing, ADR-012: Skill frontmatter YAML syntax fix, Decision: migrate skills: to YAML block-list syntax, Empirical evidence: kody INJECTION_STATUS: BROKEN, ADR-013: Skills at .claude/skills/<name>/SKILL.md

### Community 32 - "Plugin Hooks Generator"
Cohesion: 0.73
Nodes (4): buildPluginManifest(), extractScriptName(), main(), rewriteCommand()

### Community 33 - "Session-Start Hook Tests"
Cohesion: 0.53
Nodes (4): readOrphanEndedAt(), runHook(), seedDbWithCompactedSession(), seedDbWithOrphan()

### Community 34 - "Manifest Schema Tests"
Cohesion: 0.53
Nodes (4): basenamesGlob2(), countGlob2(), countGlob3(), loadJson()

### Community 35 - "Domain Pattern Engine"
Cohesion: 0.4
Nodes (6): 12 domain patterns (A-L) replace 13 hygiene patterns, Plan-006: Domain pattern engine â€” Sprint A v1.1, Pattern type: file_sequence, migrate-archive-hygiene-instincts.ts (one-shot migration), observe-pre.js Skill.skill â†’ metadata.skillName, Pattern type: tool_arg_presence

### Community 36 - "Skavenger Slim Refactor"
Cohesion: 0.33
Nodes (6): MEDIA_URL_RE Regex, Route A Media Expansion (yt-dlp multi-site), Route C to B Rename, Route D Removal, Single Commit Rationale (Q4), Plan 016: Skavenger Slim Refactor

### Community 37 - "pgvector HNSW Research"
Cohesion: 0.33
Nodes (6): CVE-2026-3172 (pgvector parallel HNSW buffer overflow), Iterative Index Scan (hnsw.iterative_scan / ivfflat.iterative_scan), Research 001: pgvector HNSW vs IVFFlat 2026 Q2, Research Report Frontmatter Schema, docs/research/ README (Cheat Sheet), Untrusted Content Boundary

### Community 38 - "Agent Template System"
Cohesion: 0.6
Nodes (5): Plan 017: Agent Template System, lint-agent-frontmatter Extension, Migration Targets (doks, kody, typescript-reviewer), _TEMPLATE.md Canonical Skeleton, Underscore Prefix Filter

### Community 39 - "Runtime Language Detection"
Cohesion: 0.5
Nodes (5): detectProjectLanguage Module, Language-Aware Hook Branching, Python Pattern-Definitions Extension, Plan 020: Runtime Language Detection, Toolchain Struct

### Community 40 - "Windows PowerShell Installer"
Cohesion: 0.67
Nodes (2): Invoke-OrDry(), Write-Log()

### Community 41 - "commit-quality Hook Tests"
Cohesion: 0.67
Nodes (2): gitExec(), runHook()

### Community 42 - "git-push-reminder Hook Tests"
Cohesion: 0.67
Nodes (2): runHook(), writeObservations()

### Community 43 - "is-disabled Hook Tests"
Cohesion: 0.67
Nodes (2): disableEnv(), runHookWithEnv()

### Community 44 - "log-hook-event Tests"
Cohesion: 0.83
Nodes (2): jsonlPath(), sessionDir()

### Community 45 - "mcp-health Hook Tests"
Cohesion: 0.67
Nodes (2): runCheck(), runFailure()

### Community 46 - "no-context-guard Tests"
Cohesion: 0.67
Nodes (2): addObservation(), runHook()

### Community 47 - "ts-review-reminder Tests"
Cohesion: 0.67
Nodes (2): runHook(), writeObs()

### Community 48 - "Skill-Comply Methodology"
Cohesion: 0.67
Nodes (4): Skill-Comply 5-Phase Methodology, Research 004: Skill-Comply kody Pilot, Research 005: Skill-Comply kody Complete, Research 006: Skill-Comply spektr Complete

### Community 49 - "backup-rotate Tests"
Cohesion: 0.67
Nodes (1): setup()

### Community 50 - "block-no-verify Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 51 - "commit-format-guard Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 52 - "config-protection Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 53 - "console-log-warn Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 54 - "daily-log Tests"
Cohesion: 0.67
Nodes (1): loadModule()

### Community 55 - "deps-change-reminder Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 56 - "ensure-dist Tests"
Cohesion: 0.67
Nodes (1): setupTempDirs()

### Community 57 - "generate-session-summary Tests"
Cohesion: 0.67
Nodes (1): writeObs()

### Community 58 - "hook-logger Tests"
Cohesion: 0.67
Nodes (1): setup()

### Community 59 - "observe-post Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 60 - "observe-pre Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 61 - "post-edit-format Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 62 - "post-edit-typecheck Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 63 - "pr-created Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 64 - "quality-gate Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 65 - "Agent Template Rationale"
Cohesion: 1.0
Nodes (2): ADR-017: Agent Template System, Evidence: structural variance across 16 agent files

### Community 66 - "TS Decorators Research"
Cohesion: 1.0
Nodes (2): Stage 3 ECMAScript Decorators (TS 5.x), Research 002: TypeScript Decorators 2026

## Knowledge Gaps
- **113 isolated node(s):** `Install: 5 steps`, `Observe -> Remember -> Verify -> Specialize -> Evolve mantra`, `docs/ README navigation guide`, `Decision: Dual Persistence (SQLite + Supabase)`, `Decision: Ephemeral Observations as JSONL` (+108 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Windows PowerShell Installer`** (4 nodes): `install.ps1`, `Invoke-OrDry()`, `install.ps1`, `Write-Log()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `commit-quality Hook Tests`** (4 nodes): `commit-quality.test.ts`, `gitExec()`, `runHook()`, `commit-quality.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `git-push-reminder Hook Tests`** (4 nodes): `git-push-reminder.test.ts`, `runHook()`, `writeObservations()`, `git-push-reminder.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `is-disabled Hook Tests`** (4 nodes): `is-disabled.test.ts`, `disableEnv()`, `runHookWithEnv()`, `is-disabled.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `log-hook-event Tests`** (4 nodes): `log-hook-event.test.ts`, `jsonlPath()`, `sessionDir()`, `log-hook-event.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `mcp-health Hook Tests`** (4 nodes): `mcp-health.test.ts`, `runCheck()`, `runFailure()`, `mcp-health.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `no-context-guard Tests`** (4 nodes): `no-context-guard.test.ts`, `addObservation()`, `runHook()`, `no-context-guard.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ts-review-reminder Tests`** (4 nodes): `ts-review-reminder.test.ts`, `ts-review-reminder.test.ts`, `runHook()`, `writeObs()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `backup-rotate Tests`** (3 nodes): `setup()`, `backup-rotate.test.ts`, `backup-rotate.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `block-no-verify Tests`** (3 nodes): `runHook()`, `block-no-verify.test.ts`, `block-no-verify.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `commit-format-guard Tests`** (3 nodes): `commit-format-guard.test.ts`, `runHook()`, `commit-format-guard.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `config-protection Tests`** (3 nodes): `config-protection.test.ts`, `runHook()`, `config-protection.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `console-log-warn Tests`** (3 nodes): `console-log-warn.test.ts`, `runHook()`, `console-log-warn.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `daily-log Tests`** (3 nodes): `daily-log.test.ts`, `loadModule()`, `daily-log.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `deps-change-reminder Tests`** (3 nodes): `deps-change-reminder.test.ts`, `runHook()`, `deps-change-reminder.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ensure-dist Tests`** (3 nodes): `ensure-dist.test.ts`, `setupTempDirs()`, `ensure-dist.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `generate-session-summary Tests`** (3 nodes): `generate-session-summary.test.ts`, `writeObs()`, `generate-session-summary.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `hook-logger Tests`** (3 nodes): `hook-logger.test.ts`, `setup()`, `hook-logger.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `observe-post Tests`** (3 nodes): `observe-post.test.ts`, `runHook()`, `observe-post.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `observe-pre Tests`** (3 nodes): `observe-pre.test.ts`, `runHook()`, `observe-pre.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `post-edit-format Tests`** (3 nodes): `post-edit-format.test.ts`, `runHook()`, `post-edit-format.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `post-edit-typecheck Tests`** (3 nodes): `post-edit-typecheck.test.ts`, `runHook()`, `post-edit-typecheck.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `pr-created Tests`** (3 nodes): `pr-created.test.ts`, `runHook()`, `pr-created.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `quality-gate Tests`** (3 nodes): `quality-gate.test.ts`, `runHook()`, `quality-gate.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Agent Template Rationale`** (2 nodes): `ADR-017: Agent Template System`, `Evidence: structural variance across 16 agent files`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `TS Decorators Research`** (2 nodes): `Stage 3 ECMAScript Decorators (TS 5.x)`, `Research 002: TypeScript Decorators 2026`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `tmpDir()` connect `E2E Workflow Test Harness` to `Forge Pipeline and Pattern Engine`, `Dashboard and Migrations`, `Evolve Generate Engine`, `Forge Report Writer`, `Plugin Session Dogfood`, `YouTube Transcript Module`, `Orphan Staleness Detection`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `log()` connect `Dashboard and Migrations` to `Plugin Hooks Generator`, `Database and Session Store`, `Dashboard Renderer`, `Install Apply and Helpers`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `main()` connect `Install Apply and Helpers` to `Dashboard and Migrations`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `getDb()` (e.g. with `runArchiveMigration()` and `runMigration()`) actually correct?**
  _`getDb()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `tmpDir()` (e.g. with `loadObservations()` and `findActiveSessionDir()`) actually correct?**
  _`tmpDir()` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `nowIso()` (e.g. with `applyForgePreview()` and `projectInMemory()`) actually correct?**
  _`nowIso()` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `renderDashboard()` (e.g. with `main()` and `getInstinctCounts()`) actually correct?**
  _`renderDashboard()` has 2 INFERRED edges - model-reasoned connections that need verification._