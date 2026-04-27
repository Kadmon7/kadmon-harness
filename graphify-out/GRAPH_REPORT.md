# Graph Report - .  (2026-04-27)

## Corpus Check
- Large corpus: 221 files · ~323,602 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1110 nodes · 1935 edges · 69 communities detected
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 179 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Database & Session Store|Database & Session Store]]
- [[_COMMUNITY_Graphify & Language Detection|Graphify & Language Detection]]
- [[_COMMUNITY_Distribution & Install Telemetry|Distribution & Install Telemetry]]
- [[_COMMUNITY_Install Health & Remediation|Install Health & Remediation]]
- [[_COMMUNITY_Forge Pipeline & Cost Calculator|Forge Pipeline & Cost Calculator]]
- [[_COMMUNITY_Hook Test Harness|Hook Test Harness]]
- [[_COMMUNITY_Foundational Decisions|Foundational Decisions]]
- [[_COMMUNITY_Project Language Detection|Project Language Detection]]
- [[_COMMUNITY_Dashboard & Utils|Dashboard & Utils]]
- [[_COMMUNITY_Capability Alignment|Capability Alignment]]
- [[_COMMUNITY_Forge to Evolve Handoff|Forge to Evolve Handoff]]
- [[_COMMUNITY_Evolve Generate Engine|Evolve Generate Engine]]
- [[_COMMUNITY_Versioning Policy SemVer|Versioning Policy SemVer]]
- [[_COMMUNITY_Install Apply|Install Apply]]
- [[_COMMUNITY_Instinct Decay & Stale Plans|Instinct Decay & Stale Plans]]
- [[_COMMUNITY_Evolve Templates & Plugin Symlinks|Evolve Templates & Plugin Symlinks]]
- [[_COMMUNITY_Dogfood Plugin Session|Dogfood Plugin Session]]
- [[_COMMUNITY_Forge Report Writer|Forge Report Writer]]
- [[_COMMUNITY_Smoke All Hooks|Smoke All Hooks]]
- [[_COMMUNITY_Pattern Evaluation|Pattern Evaluation]]
- [[_COMMUNITY_Alchemik Rubric & ECC|Alchemik Rubric & ECC]]
- [[_COMMUNITY_YouTube Transcript|YouTube Transcript]]
- [[_COMMUNITY_Research Report Persistence|Research Report Persistence]]
- [[_COMMUNITY_Context Footprint & Foundations|Context Footprint & Foundations]]
- [[_COMMUNITY_Session End Pipeline|Session End Pipeline]]
- [[_COMMUNITY_Install Diagnostic Reader Tests|Install Diagnostic Reader Tests]]
- [[_COMMUNITY_Agent Frontmatter Linter|Agent Frontmatter Linter]]
- [[_COMMUNITY_ClusterReport IPC Contract|ClusterReport IPC Contract]]
- [[_COMMUNITY_Hook Duration Instrumentation|Hook Duration Instrumentation]]
- [[_COMMUNITY_Skavenger Researcher|Skavenger Researcher]]
- [[_COMMUNITY_Pre-Compact Save|Pre-Compact Save]]
- [[_COMMUNITY_Skill Loading Saga|Skill Loading Saga]]
- [[_COMMUNITY_Plugin Hooks Generator|Plugin Hooks Generator]]
- [[_COMMUNITY_Session Start Tests|Session Start Tests]]
- [[_COMMUNITY_Manifest Schema Tests|Manifest Schema Tests]]
- [[_COMMUNITY_Domain Pattern Engine|Domain Pattern Engine]]
- [[_COMMUNITY_Skavenger Slim Refactor|Skavenger Slim Refactor]]
- [[_COMMUNITY_pgvector Research|pgvector Research]]
- [[_COMMUNITY_Agent Template System|Agent Template System]]
- [[_COMMUNITY_Runtime Language Detection|Runtime Language Detection]]
- [[_COMMUNITY_Install PowerShell|Install PowerShell]]
- [[_COMMUNITY_commit-quality Tests|commit-quality Tests]]
- [[_COMMUNITY_git-push-reminder Tests|git-push-reminder Tests]]
- [[_COMMUNITY_is-disabled Tests|is-disabled Tests]]
- [[_COMMUNITY_log-hook-event Tests|log-hook-event Tests]]
- [[_COMMUNITY_mcp-health Tests|mcp-health Tests]]
- [[_COMMUNITY_no-context-guard Tests|no-context-guard Tests]]
- [[_COMMUNITY_post-edit-security Tests|post-edit-security Tests]]
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
- [[_COMMUNITY_session-summary Tests|session-summary Tests]]
- [[_COMMUNITY_hook-logger Tests|hook-logger Tests]]
- [[_COMMUNITY_observe-post Tests|observe-post Tests]]
- [[_COMMUNITY_observe-pre Tests|observe-pre Tests]]
- [[_COMMUNITY_post-edit-format Tests|post-edit-format Tests]]
- [[_COMMUNITY_post-edit-typecheck Tests|post-edit-typecheck Tests]]
- [[_COMMUNITY_pr-created Tests|pr-created Tests]]
- [[_COMMUNITY_quality-gate Tests|quality-gate Tests]]
- [[_COMMUNITY_Agent Template Variance|Agent Template Variance]]
- [[_COMMUNITY_TypeScript Decorators Research|TypeScript Decorators Research]]
- [[_COMMUNITY_ADR-013 Skills Subdirectory|ADR-013 Skills Subdirectory]]

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 47 edges
2. `tmpDir()` - 29 edges
3. `nowIso()` - 20 edges
4. `renderDashboard()` - 19 edges
5. `runEvolveGenerate()` - 13 edges
6. `ADR-035 Rules catalog source-of-truth via non-auto-loaded CATALOG.md` - 13 edges
7. `openDb()` - 12 edges
8. `ADR-031 Project-agnostic /skanner stack` - 12 edges
9. `reference_kadmon_harness.md cheat sheet` - 12 edges
10. `runForgePipeline()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Per-check cwd-target-existence guard` --implements--> `scripts/lib/medik-checks/capability-alignment.ts`  [EXTRACTED]
  docs/plans/plan-033-medik-project-agnostic.md → scripts/lib/medik-checks/capability-alignment.ts
- `/medik Check #11 hook-health-24h` --implements--> `scripts/lib/medik-checks/types.ts (CheckContext)`  [INFERRED]
  docs/plans/plan-028-v1.3-medik-expansion-release.md → scripts/lib/medik-checks/types.ts
- `/medik Check #12 instinct-decay-candidates` --implements--> `scripts/lib/medik-checks/types.ts (CheckContext)`  [INFERRED]
  docs/plans/plan-028-v1.3-medik-expansion-release.md → scripts/lib/medik-checks/types.ts
- `/medik --ALV diagnostic export` --implements--> `scripts/lib/medik-alv.ts`  [EXTRACTED]
  docs/plans/plan-028-v1.3-medik-expansion-release.md → scripts/lib/medik-alv.ts
- `loadObservations()` --calls--> `tmpDir()`  [INFERRED]
  C:\Command-Center\Kadmon-Harness\scripts\dashboard.ts → C:\Command-Center\Kadmon-Harness\scripts\lib\utils.ts

## Hyperedges (group relationships)
- **Skill loading correction saga (ADR-011 â†’ ADR-012 â†’ ADR-013)** — adr_011_skill_loading_enforcement, adr_012_skill_frontmatter_syntax_fix, adr_013_skills_subdirectory_structure [EXTRACTED 0.95]
- **Skavenger agent lifecycle (ADR-009 â†’ ADR-014 â†’ ADR-015 â†’ ADR-016)** — adr_009_deep_research_capability, adr_014_rename_kerka_to_skavenger, adr_015_skavenger_ultimate, adr_016_skavenger_slim_refactor [EXTRACTED 0.95]
- **Harness distribution evolution (ADR-003 â†’ ADR-010 â†’ ADR-019 â†’ ADR-021)** — adr_003_harness_distribution, adr_010_harness_distribution_hybrid, adr_019_canonical_root_symlinks, adr_021_install_allow_merge [EXTRACTED 0.95]
- **Forgeâ†’Evolve producer-consumer handoff pipeline** — plan005_forge_pipeline, plan005_cluster_report, plan005_forge_report_writer, plan008_evolve_report_reader, plan008_run_evolve_generate, plan008_apply_evolve_generate [EXTRACTED 0.90]
- **Hybrid distribution stack (plugin + bootstrap + runtime primitive)** — plan010_plugin_manifest, plan010_generate_plugin_hooks, plan010_install_sh, plan010_kadmon_runtime_root, plan003_harness_distribution [EXTRACTED 0.90]
- **Skills loader reliability chain (YAML syntax + subdir layout + linter)** — plan011_skill_loading_superseded, plan012_yaml_syntax_fix, plan012_yaml_block_list, plan013_skills_subdir, plan013_skill_md_uppercase, plan012_lint_frontmatter [EXTRACTED 0.90]
- **Skill-Comply Reports (methodology applied across agents)** — research004_skill_comply_kody_pilot, research005_skill_comply_kody_complete, research006_skill_comply_spektr, research004_compliance_methodology [EXTRACTED 0.90]
- **v1.1 Sprint D Distribution (plan + loader + hybrid install)** — roadmap_v11_sprint_d_distribution, plan019_canonical_root_symlinks, plan019_plugin_loader_auto_discovery, plan019_windows_dev_mode_requirement [EXTRACTED 0.90]
- **Evolve Generate Template Set (4 artifact types)** — evolve_template_agent, evolve_template_command, evolve_template_rule, evolve_template_skill [EXTRACTED 0.95]
- **Project-agnostic command stack (skanner/doks/medik/chekpoint)** — adr_031_skanner_agnostic, adr_032_doks_agnostic, adr_033_medik_agnostic, adr_034_chekpoint_diff_scope, detect_project_profile_fn [INFERRED 0.90]
- **v1.3.0 narrative: medik expansion + diag export + graphify gate + python SAST** — changelog_v1_3_0, adr_028_v1_3_release, adr_029_capability_alignment, adr_026_graphify_adoption, adr_027_python_bandit [EXTRACTED 1.00]
- **Windows install bug chain (symlinks + MSYS + bash hook error)** — bug1_symlinks_text_files, bug2_pretooluse_agent_error, msys_winsymlinks_env, install_health_check9 [EXTRACTED 0.95]
- **Project-agnostic profile detection pattern (skanner/doks/medik)** — plan_031_detect_skanner_profile, plan_032_detect_project_profile_rename, plan_033_detect_medik_profile, module_detect_project_language [EXTRACTED 0.95]
- **v1.3.0 medik expansion shipped (5 plans + 4 ADRs)** — plan_027_python_bandit_sast_hook, plan_028_v1_3_release, plan_029_capability_alignment, adr_026_graphify_adoption, roadmap_v1_3_medik_expansion [EXTRACTED 0.95]
- **Diff-scope-aware /chekpoint pipeline (helper + Phase 1 + Phase 2a routing + invariants)** — plan_034_get_diff_scope, plan_034_phase_1_mechanical_wiring, plan_034_phase_2a_conditional_reviewers, plan_034_kody_always_runs, plan_034_conservative_default, plan_034_force_overrides [EXTRACTED 0.90]

## Communities

### Community 0 - "Database & Session Store"
Cohesion: 0.04
Nodes (77): seed(), detectAnomalies(), getDbHealthReport(), nowIso(), applyForgePreview(), runCheck(), nowIso(), contradictInstinct() (+69 more)

### Community 1 - "Graphify & Language Detection"
Cohesion: 0.02
Nodes (108): ADR-020 Runtime language detection, ADR-025 Versioning policy (SemVer), Adopt graphify as external dependency, not internal code, ADR-026 Graphify adoption, Rationale: zero internal TS code, single-commit reversible, Sprint E Measurement Gate (3.0x threshold), Option A: dedicated post-edit-security.js hook, ADR-027 Python bandit SAST hook (+100 more)

### Community 2 - "Distribution & Install Telemetry"
Cohesion: 0.03
Nodes (90): ADR-010 Hybrid distribution (plugin + install.sh), ADR-017 _TEMPLATE.md.example agent skeleton, ADR-019 Canonical root symlinks for plugin loader, ADR-020 language detection module, ADR-024 Install Health Telemetry, D3 Cross-platform redaction with literal-string regex, Kody exemption (Phase 2b consolidator), ADR-031 Project-agnostic /skanner stack (+82 more)

### Community 3 - "Install Health & Remediation"
Cohesion: 0.08
Nodes (35): isValidEntry(), readTypedInstallDiagnostics(), warnDropped(), mkReport(), setup(), checkInstallHealth(), detectAnomalies(), detectSymlink() (+27 more)

### Community 4 - "Forge Pipeline & Cost Calculator"
Cohesion: 0.08
Nodes (31): makeFixture(), calculateCost(), estimateCharsPerToken(), formatCost(), resolvePricing(), applyProjectionInMemory(), assertSafeSessionId(), buildCluster() (+23 more)

### Community 5 - "Hook Test Harness"
Cohesion: 0.06
Nodes (31): cleanupTmpDir(), runHook(), setupTmpFixtures(), globalTeardown(), createTestDir(), createFakeTarget(), createFakeUserSettings(), detectPowerShell() (+23 more)

### Community 6 - "Foundational Decisions"
Cohesion: 0.05
Nodes (47): Decision: Dual Persistence (SQLite + Supabase), Decision: Ephemeral Observations as JSONL, Decision: No Bash, No Python (Node.js only), Decision: no-context-guard PreToolUse hook, ADR-001: v0.3 Foundations (Archived), ADR-003: Harness Distribution (copy-based bootstrap) â€” superseded, Option A: Bootstrap Script (copy-based), Rationale: rules + permissions.deny are non-negotiable (+39 more)

### Community 7 - "Project Language Detection"
Cohesion: 0.1
Nodes (28): detectMedikProfile(), detectProjectLanguage(), detectProjectProfile(), getDiffScope(), getToolchain(), isDiffConfigFile(), isDiffDocFile(), isDiffProductionSource() (+20 more)

### Community 8 - "Dashboard & Utils"
Cohesion: 0.12
Nodes (28): computeHealthScore(), findActiveSessionDir(), fmtDuration(), fmtMs(), fmtTokens(), getAgentStatRows(), getDbStatus(), getHookHealthRows() (+20 more)

### Community 9 - "Capability Alignment"
Cohesion: 0.14
Nodes (27): runCheck(), seedClaude(), writeAgent(), writeSkill(), worstStatus(), basenameNoExt(), buildCapabilityMatrix(), extractFrontmatter() (+19 more)

### Community 10 - "Forge to Evolve Handoff"
Cohesion: 0.08
Nodes (32): ClusterReport type contract (handoff for /evolve), /instinct deprecation alias (through 2026-04-20), forge-pipeline.ts (runForgePipeline + applyForgePreview), Plan-005: /instinct â†’ /forge refactor with unified pipeline, forge-report-writer.ts (writeClusterReport, retention), agent-metadata-sync hook (PostToolUse Edit|Write), applyEvolveGenerate (single mutator, transactional), Plan-008: Sprint B /evolve Generate step 6 cross-project pipeline (+24 more)

### Community 11 - "Evolve Generate Engine"
Cohesion: 0.16
Nodes (20): applyEvolveGenerate(), buildSpec(), buildTargetPath(), categoryToType(), computeSourceWindow(), defaultReportsDir(), deriveComplexity(), deriveConfidence() (+12 more)

### Community 12 - "Versioning Policy SemVer"
Cohesion: 0.08
Nodes (26): ADR-024 Install Health Telemetry (referenced), Anti-patterns: one-commit = one release, Human-review enforcement (no mechanical gate), MAJOR â€” breaking changes to public contract, MINOR â€” narrative feature ready for collaborators, PATCH â€” post-release hotfix only, Rationale: release noise from PATCH-per-commit cadence, SemVer MAJOR/MINOR/PATCH (+18 more)

### Community 13 - "Install Apply"
Cohesion: 0.2
Nodes (16): applyProjectSettings(), applyUserSettings(), main(), parseArgs(), readJsonOrEmpty(), runInstallApply(), writeJson(), detectPlatform() (+8 more)

### Community 14 - "Instinct Decay & Stale Plans"
Cohesion: 0.13
Nodes (8): runCheck(), daysAgoISO(), runCheck(), hasPlanRecentGitActivity(), runCheck(), daysAgoISO(), makeTmpDir(), writePlan()

### Community 15 - "Evolve Templates & Plugin Symlinks"
Cohesion: 0.14
Nodes (18): Agent Evolve Template, Command Evolve Template, Rule Evolve Template, Skill Evolve Template, Plan 019: Canonical Root Symlinks for Plugin Loader, plugin.json Pruning (commands, skills fields removed), Plugin Loader Auto-Discovery, Windows Developer Mode Requirement (+10 more)

### Community 16 - "Dogfood Plugin Session"
Cohesion: 0.29
Nodes (11): buildEventSequence(), checkSandbox(), formatReport(), isSpawnError(), queryPersistedHookEvents(), runHookDirect(), runPluginModeDogfood(), cleanupDir() (+3 more)

### Community 17 - "Forge Report Writer"
Cohesion: 0.29
Nodes (11): assertSafeBaseDir(), assertSafeSessionId(), defaultBaseDir(), exportInstinctsToJson(), isUnder(), kadmonRoot(), pruneOldReports(), readClusterReport() (+3 more)

### Community 18 - "Smoke All Hooks"
Cohesion: 0.26
Nodes (10): classify(), generateStdin(), isSpawnError(), parseSettings(), reportTable(), runHook(), makeFailResult(), makeHook() (+2 more)

### Community 19 - "Pattern Evaluation"
Cohesion: 0.35
Nodes (10): addSessionToDb(), buildAgentDocsLines(), buildReadEditWriteLines(), buildStateStoreLines(), makeFindingLine(), makeObsLine(), openReadDb(), runHook() (+2 more)

### Community 20 - "Alchemik Rubric & ECC"
Cohesion: 0.2
Nodes (12): Alchemik Rubric (Phase 3), Confidence Decay (-0.02/week), Cross-Project Auto-Promotion, Plan 018: ECC Features Port, migrate-v0.5.ts last_observed_at, user_correction Detector Ruled Out, Research 007: Graphify Spec from YouTube, Graphify External CLI Tool (+4 more)

### Community 21 - "YouTube Transcript"
Cohesion: 0.4
Nodes (7): buildCanonicalUrl(), checkYtDlp(), detectLanguage(), extractVideoId(), fetchYouTubeTranscript(), isMediaUrl(), parseVtt()

### Community 22 - "Research Report Persistence"
Cohesion: 0.4
Nodes (6): buildFrontmatter(), escapeYamlString(), padNumber(), runPersistReport(), sample(), validateSlug()

### Community 23 - "Context Footprint & Foundations"
Cohesion: 0.2
Nodes (10): Context Footprint (~18K tokens always-loaded, 3 tiers), 8 founding ADRs (ADR-001-v03-foundations), Kadmon Harness Genesis, Hook Reliability (ensure-dist, hook-logger, backup-rotate), Orchestration Chain (commands â†’ agents â†’ skills), Persistence (SQLite + JSONL observations + orphan recovery), Genesis Timeline (2026-03 to 2026-04), v1.0 Components (15 agents, 22 skills, 12 commands, 20 hooks, 19 rules) (+2 more)

### Community 24 - "Session End Pipeline"
Cohesion: 0.44
Nodes (7): generateObsLines(), generatePatternALines(), makeObsLine(), readDb(), runHook(), seedDb(), writeObservations()

### Community 25 - "Install Diagnostic Reader Tests"
Cohesion: 0.42
Nodes (7): importReader(), logPath(), mkCorruptEntry(), mkLegacyEntry(), mkV1Entry(), setupDir(), writeLine()

### Community 26 - "Agent Frontmatter Linter"
Cohesion: 0.28
Nodes (3): lintAgentFrontmatter(), writeAgent(), writeSkill()

### Community 27 - "ClusterReport IPC Contract"
Cohesion: 0.28
Nodes (9): ClusterReport typed JSON IPC contract, ADR-005: /forge pipeline + /evolve handoff contract, Rationale: verb/noun split (/forge = action, instinct = data), ADR-006: Domain-specific pattern definitions, New pattern type: file_sequence, Rationale: hygiene patterns duplicate hooks (self-reinforcing loop), Pattern: alchemik proposes, /evolve command writes, Decision Q1: artifacts written to cwd/.claude/, not harness tree (+1 more)

### Community 28 - "Hook Duration Instrumentation"
Cohesion: 0.5
Nodes (6): assertDurationMs(), cleanSession(), hookEventsFile(), hookPath(), lastHookEvent(), runHook()

### Community 29 - "Skavenger Researcher"
Cohesion: 0.32
Nodes (8): Rationale: orphaned deep-research skill violates chain rule, ADR-009: Deep Research Capability (kerka/skavenger), Rationale: 'scavenger' describes multi-source research workflow, ADR-014: Rename kerka â†’ skavenger, ADR-015: Skavenger ULTIMATE Researcher, Three gaps: no docs, one-shot, single-angle, Rationale: Route D had 449 LOC with zero real invocations, ADR-016: Skavenger slim refactor (Route D removed, A expanded)

### Community 30 - "Pre-Compact Save"
Cohesion: 0.48
Nodes (5): makeObsLine(), readDb(), runHook(), seedDb(), writeObservations()

### Community 31 - "Skill Loading Saga"
Cohesion: 0.33
Nodes (7): ADR-011: Skill loading enforcement â€” superseded by ADR-012, Wrong diagnosis: assumed skills: field not parsed by loader, Evidence: docs.claude.com/sub-agents confirms native skills: parsing, ADR-012: Skill frontmatter YAML syntax fix, Decision: migrate skills: to YAML block-list syntax, Empirical evidence: kody INJECTION_STATUS: BROKEN, ADR-013: Skills at .claude/skills/<name>/SKILL.md

### Community 32 - "Plugin Hooks Generator"
Cohesion: 0.73
Nodes (4): buildPluginManifest(), extractScriptName(), main(), rewriteCommand()

### Community 33 - "Session Start Tests"
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

### Community 37 - "pgvector Research"
Cohesion: 0.33
Nodes (6): CVE-2026-3172 (pgvector parallel HNSW buffer overflow), Iterative Index Scan (hnsw.iterative_scan / ivfflat.iterative_scan), Research 001: pgvector HNSW vs IVFFlat 2026 Q2, Research Report Frontmatter Schema, docs/research/ README (Cheat Sheet), Untrusted Content Boundary

### Community 38 - "Agent Template System"
Cohesion: 0.6
Nodes (5): Plan 017: Agent Template System, lint-agent-frontmatter Extension, Migration Targets (doks, kody, typescript-reviewer), _TEMPLATE.md Canonical Skeleton, Underscore Prefix Filter

### Community 39 - "Runtime Language Detection"
Cohesion: 0.5
Nodes (5): detectProjectLanguage Module, Language-Aware Hook Branching, Python Pattern-Definitions Extension, Plan 020: Runtime Language Detection, Toolchain Struct

### Community 40 - "Install PowerShell"
Cohesion: 0.67
Nodes (2): Invoke-OrDry(), Write-Log()

### Community 41 - "commit-quality Tests"
Cohesion: 0.67
Nodes (2): gitExec(), runHook()

### Community 42 - "git-push-reminder Tests"
Cohesion: 0.67
Nodes (2): runHook(), writeObservations()

### Community 43 - "is-disabled Tests"
Cohesion: 0.67
Nodes (2): disableEnv(), runHookWithEnv()

### Community 44 - "log-hook-event Tests"
Cohesion: 0.83
Nodes (2): jsonlPath(), sessionDir()

### Community 45 - "mcp-health Tests"
Cohesion: 0.67
Nodes (2): runCheck(), runFailure()

### Community 46 - "no-context-guard Tests"
Cohesion: 0.67
Nodes (2): addObservation(), runHook()

### Community 47 - "post-edit-security Tests"
Cohesion: 0.67
Nodes (2): banditAvailable(), runHook()

### Community 48 - "ts-review-reminder Tests"
Cohesion: 0.67
Nodes (2): runHook(), writeObs()

### Community 49 - "Skill-Comply Methodology"
Cohesion: 0.67
Nodes (4): Skill-Comply 5-Phase Methodology, Research 004: Skill-Comply kody Pilot, Research 005: Skill-Comply kody Complete, Research 006: Skill-Comply spektr Complete

### Community 50 - "backup-rotate Tests"
Cohesion: 0.67
Nodes (1): setup()

### Community 51 - "block-no-verify Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 52 - "commit-format-guard Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 53 - "config-protection Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 54 - "console-log-warn Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 55 - "daily-log Tests"
Cohesion: 0.67
Nodes (1): loadModule()

### Community 56 - "deps-change-reminder Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 57 - "ensure-dist Tests"
Cohesion: 0.67
Nodes (1): setupTempDirs()

### Community 58 - "session-summary Tests"
Cohesion: 0.67
Nodes (1): writeObs()

### Community 59 - "hook-logger Tests"
Cohesion: 0.67
Nodes (1): setup()

### Community 60 - "observe-post Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 61 - "observe-pre Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 62 - "post-edit-format Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 63 - "post-edit-typecheck Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 64 - "pr-created Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 65 - "quality-gate Tests"
Cohesion: 0.67
Nodes (1): runHook()

### Community 66 - "Agent Template Variance"
Cohesion: 1.0
Nodes (2): ADR-017: Agent Template System, Evidence: structural variance across 16 agent files

### Community 67 - "TypeScript Decorators Research"
Cohesion: 1.0
Nodes (2): Stage 3 ECMAScript Decorators (TS 5.x), Research 002: TypeScript Decorators 2026

### Community 78 - "ADR-013 Skills Subdirectory"
Cohesion: 1.0
Nodes (1): ADR-013 Skills subdirectory layout (SKILL.md literal)

## Knowledge Gaps
- **197 isolated node(s):** `docs/ README navigation guide`, `Decision: Dual Persistence (SQLite + Supabase)`, `Decision: no-context-guard PreToolUse hook`, `Decision: Ephemeral Observations as JSONL`, `Rationale: rules + permissions.deny are non-negotiable` (+192 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Install PowerShell`** (4 nodes): `install.ps1`, `Invoke-OrDry()`, `install.ps1`, `Write-Log()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `commit-quality Tests`** (4 nodes): `commit-quality.test.ts`, `gitExec()`, `runHook()`, `commit-quality.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `git-push-reminder Tests`** (4 nodes): `git-push-reminder.test.ts`, `runHook()`, `writeObservations()`, `git-push-reminder.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `is-disabled Tests`** (4 nodes): `is-disabled.test.ts`, `disableEnv()`, `runHookWithEnv()`, `is-disabled.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `log-hook-event Tests`** (4 nodes): `log-hook-event.test.ts`, `jsonlPath()`, `sessionDir()`, `log-hook-event.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `mcp-health Tests`** (4 nodes): `mcp-health.test.ts`, `runCheck()`, `runFailure()`, `mcp-health.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `no-context-guard Tests`** (4 nodes): `no-context-guard.test.ts`, `addObservation()`, `runHook()`, `no-context-guard.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `post-edit-security Tests`** (4 nodes): `post-edit-security.test.ts`, `banditAvailable()`, `runHook()`, `post-edit-security.test.ts`
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
- **Thin community `session-summary Tests`** (3 nodes): `generate-session-summary.test.ts`, `writeObs()`, `generate-session-summary.test.ts`
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
- **Thin community `Agent Template Variance`** (2 nodes): `ADR-017: Agent Template System`, `Evidence: structural variance across 16 agent files`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `TypeScript Decorators Research`** (2 nodes): `Stage 3 ECMAScript Decorators (TS 5.x)`, `Research 002: TypeScript Decorators 2026`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ADR-013 Skills Subdirectory`** (1 nodes): `ADR-013 Skills subdirectory layout (SKILL.md literal)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `tmpDir()` connect `Hook Test Harness` to `Install Health & Remediation`, `Forge Pipeline & Cost Calculator`, `Project Language Detection`, `Dashboard & Utils`, `Evolve Generate Engine`, `Instinct Decay & Stale Plans`, `Dogfood Plugin Session`, `Forge Report Writer`, `YouTube Transcript`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **Why does `writeAlvReport()` connect `Install Health & Remediation` to `Hook Test Harness`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `makeTmpDir()` connect `Project Language Detection` to `Hook Test Harness`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `getDb()` (e.g. with `runArchiveMigration()` and `runMigration()`) actually correct?**
  _`getDb()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Are the 26 inferred relationships involving `tmpDir()` (e.g. with `loadObservations()` and `findActiveSessionDir()`) actually correct?**
  _`tmpDir()` has 26 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `nowIso()` (e.g. with `applyForgePreview()` and `projectInMemory()`) actually correct?**
  _`nowIso()` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `renderDashboard()` (e.g. with `main()` and `getInstinctCounts()`) actually correct?**
  _`renderDashboard()` has 2 INFERRED edges - model-reasoned connections that need verification._