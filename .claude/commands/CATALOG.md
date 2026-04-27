---
name: commands-catalog
description: Full command reference (11 commands grouped by 7 phases) with purpose and routing agent. Read on-demand by /doks drift detection and human readers. Source-of-truth; rules reference this file via pointer.
---

<!-- DO NOT AUTO-LOAD: this file is read on-demand by /doks and human readers. Lives outside .claude/rules/ to avoid eager context injection. See ADR-035. -->

# Command Catalog

## Command Reference (11)

### Observe Phase (2)
| Command | Purpose | Agent |
|---------|---------|-------|
| /nexus | Show harness dashboard (instincts, sessions, costs, hook health) | — |
| /kompact | Smart context compaction with audit and safety checks. Use `/kompact audit` for context audit only | — |

### Plan Phase (1)
| Command | Purpose | Agent |
|---------|---------|-------|
| /abra-kdabra | Smart planning — arkitect -> konstruct -> feniks (if TDD) chain with user approval gate. Code review = /chekpoint's job. | arkitect, konstruct, feniks |

### Build Phase (1)
| Command | Purpose | Agent |
|---------|---------|-------|
| /medik | Full harness diagnostic — 8 health checks, approval gate, repair, cleanup. Alias: /MediK. Use `/medik build`, `/medik hooks`, `/medik db`, or `/medik clean` for single phase | mekanik, kurator |

### Scan Phase (1)
| Command | Purpose | Agent |
|---------|---------|-------|
| /skanner | Deep system assessment — performance profiling + E2E workflow tests in parallel. Profile-aware (`harness|web|cli`): explicit profile arg > `KADMON_SKANNER_PROFILE` env > marker scan. Phase 1a hook-latency benchmarking activates only on harness profile; Phase 1b scenarios are profile-matched (5 harness lifecycle / 4 web auth-search-CRUD-realtime / 4 cli invocation-config-IO-subprocess). Optional agent evaluation. | arkonte, kartograf |

### Research Phase (1)
| Command | Purpose | Agent |
|---------|---------|-------|
| /skavenger | Multi-source deep research — web, media transcripts (YouTube/Vimeo/SoundCloud/Twitch/X/TikTok/Archive.org/Dailymotion via yt-dlp), PDFs. Two routes: A=Media, B=General. Ad-hoc GitHub research runs inline via `gh api`. Auto-writes reports to `docs/research/` unless `KADMON_RESEARCH_AUTOWRITE=off`. Flags (one at a time): `--continue` (extend last session report), `--plan <topic>` (zero-fetch dry-run), `--verify <hypothesis>` (pro/contra tagging), `--drill <N>` (expand open question N), `--history <query>` (search archive), `--verify-citations <N>` (re-fetch URLs of report N). Skavenger spawns sub-agents via `Task` for ≥3 sub-questions; enforces source diversity. `--premium` (Perplexity Sonar) remains deferred. | skavenger |

### Remember Phase (3)
| Command | Purpose | Agent |
|---------|---------|-------|
| /chekpoint | Tiered verification + review + commit and push (full/lite/skip — see Tiers section) | kody + specialists |
| /almanak | Look up live documentation for any library or framework | almanak |
| /doks | Sync project documentation with code changes (4-layer sync) | doks |

### Evolve Phase (2)
| Command | Purpose | Agent |
|---------|---------|-------|
| /forge | Forge session observations into instincts via unified preview-gated pipeline. Flags: `--dry-run`, `export`. | — |
| /evolve | Run harness self-optimization analysis. Step 6 "Generate" reads ClusterReports written by `/forge` and proposes new skills/commands/agents/rules through a preview gate; `/evolve` command invokes `skill-creator:skill-creator` plugin for PROMOTE proposals (target path `.claude/skills/<slug>/SKILL.md`) and a built-in mutator for the rest (commands/agents/rules stay flat). | alchemik |
