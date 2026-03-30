# Prompt 1 Output — Everything Claude Code Analysis

## Date
2026-03-23

## Source
Repository: github.com/affaan-m/everything-claude-code
Cloned and read in full. Every file inspected.

---

## 1. Executive Assessment

### What Is This Repo Really?

ECC is a **Claude Code prompt engineering distribution** — a curated set of markdown-based agents, skills, commands, rules, hooks, and MCP configurations that inject structured behavior into Claude Code sessions. It is not a framework, not a runtime, and not an application. It is an overlay that shapes how Claude Code behaves during development.

- 28 specialized agents
- 200+ skills across 10+ languages
- 60+ commands
- 25+ hook scripts with lifecycle automation
- 10 language-specific rule sets + common rules
- 25+ MCP server configurations

### Where the Real Value Lives

**1. The hooks system** (`hooks/hooks.json` + `scripts/hooks/`)
The most technically sophisticated part of ECC. Hooks intercept tool calls at lifecycle points (PreToolUse, PostToolUse, Stop, SessionStart, PreCompact) and run Node.js scripts that enforce quality gates, track sessions, auto-format code, block dangerous operations, and persist state. This is real automation, not just prompt text. Maps to **Verify** and **Observe**.

**2. The command/agent/workflow trio** (`commands/`, `agents/`, common rules)
Commands like `/plan`, `/tdd`, `/verify`, `/code-review`, and `/build-fix` form a coherent development workflow: plan before code, test before implementation, review before commit. The agents they invoke (planner, tdd-guide, code-reviewer, architect) are well-structured with clear roles. Maps to **Specialize**.

**3. The continuous-learning system** (`skills/continuous-learning-v2/`)
Instinct-based learning that observes sessions, extracts patterns, and promotes them into reusable skills. Conceptually aligned with **Evolve**. However, uses local SQLite and shell scripts — conflicts with Supabase-first persistence.

### What Is Mostly Padding

~40-50% of the skills catalog is domain-specific content irrelevant to our projects: supply-chain skills, marketing skills, and language-specific skills for dropped languages. The multi-language coverage (Go, Rust, Swift, Java, Kotlin, C++, C#, Perl, PHP, Flutter/Dart) accounts for ~14 of 28 agents, 30+ skills, 20+ commands, and 50 of 65 rule files. All DROP.

---

## 2. Classification Tables

### 2.1 Agents (28 total → 9 CORE, 5 USEFUL, 1 OPTIONAL, 13 DROP)

| # | Agent | Class | Mantra | Why |
|---|-------|-------|--------|-----|
| 1 | architect | **CORE** | Specialize | System design for all three projects. Opus-tier reasoning. |
| 2 | build-error-resolver | **CORE** | Verify | Generic TS/build error resolution. Daily driver. |
| 3 | chief-of-staff | USEFUL | Observe | Communication triager. Useful once multi-agent is active (v2). |
| 4 | code-reviewer | **CORE** | Verify | Code quality enforcement. Direct `no_context` alignment. |
| 5 | cpp-build-resolver | DROP | - | C++ not in ecosystem. |
| 6 | cpp-reviewer | DROP | - | C++ not in ecosystem. |
| 7 | database-reviewer | **CORE** | Verify+Specialize | PostgreSQL/Supabase specialist. Directly relevant. |
| 8 | docs-lookup | **CORE** | Remember | Documentation fetcher via Context7 MCP. Prevents hallucination. |
| 9 | doc-updater | USEFUL | Remember | Codemap/docs generation. Not day-1 essential. |
| 10 | e2e-runner | USEFUL | Verify | E2E testing. Can wait for v2. |
| 11 | flutter-reviewer | DROP | - | Flutter/Dart not in ecosystem. |
| 12 | go-build-resolver | DROP | - | Go not in ecosystem. |
| 13 | go-reviewer | DROP | - | Go not in ecosystem. |
| 14 | harness-optimizer | USEFUL | Evolve | Meta-optimization. v2 after baseline is stable. |
| 15 | java-build-resolver | DROP | - | Java not in ecosystem. |
| 16 | java-reviewer | DROP | - | Java not in ecosystem. |
| 17 | kotlin-build-resolver | DROP | - | Kotlin not in ecosystem. |
| 18 | kotlin-reviewer | DROP | - | Kotlin not in ecosystem. |
| 19 | loop-operator | USEFUL | Evolve | Autonomous loops. Needed for O.L.A.M. phase. |
| 20 | planner | **CORE** | Observe+Specialize | Implementation planning. Foundation. |
| 21 | python-reviewer | USEFUL | Verify | Python phase 2. Keep for later. |
| 22 | pytorch-build-resolver | OPTIONAL | - | Only if ML pipeline is built. |
| 23 | refactor-cleaner | **CORE** | Evolve | Refactoring specialist. Keeps codebase healthy. |
| 24 | rust-build-resolver | DROP | - | Rust not in ecosystem. |
| 25 | rust-reviewer | DROP | - | Rust not in ecosystem. |
| 26 | security-reviewer | **CORE** | Verify | Security review. Non-negotiable. |
| 27 | tdd-guide | **CORE** | Verify | TDD workflow driver. Core discipline. |
| 28 | typescript-reviewer | **CORE** | Verify | Primary language reviewer. Essential. |

### 2.2 Skills (120+ total → ~20 CORE, ~22 USEFUL, ~14 OPTIONAL, ~64 DROP)

| Skill | Class | Mantra | Why |
|-------|-------|--------|-----|
| agentic-engineering | **CORE** | Specialize | Core AI-first dev methodology. |
| ai-first-engineering | **CORE** | Specialize | Complement to above. Consider merging. |
| api-design | **CORE** | Specialize | API patterns. Needed for all projects. |
| architecture-decision-records | **CORE** | Remember | ADR discipline. Aligns with `no_context`. |
| claude-api | **CORE** | Specialize | Essential for UNIVERSO KAIRON and O.L.A.M. |
| coding-standards | **CORE** | Specialize | General standards. |
| configure-ecc | **CORE** | Observe | Installation bootstrap. |
| context-budget | **CORE** | Observe | Context window management. Critical. |
| continuous-learning-v2 | **CORE** | Evolve | Instinct learning. Core to mantra. Needs Supabase rewrite. |
| cost-aware-llm-pipeline | **CORE** | Specialize | Cost optimization for all projects. |
| database-migrations | **CORE** | Specialize | Supabase migration patterns. Essential. |
| documentation-lookup | **CORE** | Remember | Prevents hallucination. |
| iterative-retrieval | **CORE** | Specialize | RAG patterns. Directly relevant for ToratNetz. |
| mcp-server-patterns | **CORE** | Specialize | MCP server building. Essential for extending Claude Code. |
| postgres-patterns | **CORE** | Specialize | PostgreSQL best practices. Direct Supabase relevance. |
| safety-guard | **CORE** | Verify | Destructive operation prevention. Non-negotiable. |
| search-first | **CORE** | Observe | Research-before-code. Aligns with `no_context`. |
| security-review | **CORE** | Verify | Security patterns. Backs security-reviewer agent. |
| strategic-compact | **CORE** | Observe | Context management for long sessions. |
| tdd-workflow | **CORE** | Verify | TDD methodology. Backs /tdd command. |
| verification-loop | **CORE** | Verify | Verification system. Backs /verify command. |
| agent-eval | USEFUL | Verify | Agent evaluation. For O.L.A.M. |
| agent-harness-construction | USEFUL | Specialize | Building agent harnesses. For O.L.A.M. |
| ai-regression-testing | USEFUL | Verify | AI output regression testing. |
| codebase-onboarding | USEFUL | Observe | Helps Claude understand new codebases. |
| content-hash-cache-pattern | USEFUL | Specialize | Caching. Useful for ToratNetz RAG. |
| continuous-agent-loop | USEFUL | Evolve | Canonical loop pattern. For O.L.A.M. |
| claude-devfleet | USEFUL | Evolve | Multi-agent orchestration. |
| deep-research | USEFUL | Observe | Research methodology. |
| deployment-patterns | USEFUL | Specialize | Docker deployment-only. |
| docker-patterns | USEFUL | Specialize | Deployment-only Docker. |
| e2e-testing | USEFUL | Verify | E2E patterns. |
| eval-harness | USEFUL | Verify | Evaluation harness. |
| exa-search | USEFUL | Observe | Web search integration. |
| frontend-patterns | USEFUL | Specialize | Frontend patterns. |
| nextjs-turbopack | USEFUL | Specialize | If using Next.js. |
| prompt-optimizer | USEFUL | Specialize | Prompt improvement. |
| python-patterns | USEFUL | Specialize | Python phase 2. |
| python-testing | USEFUL | Verify | Python phase 2. |
| quality-nonconformance | USEFUL | Verify | Quality tracking. |
| rules-distill | USEFUL | Evolve | Distill rules from experience. |
| security-scan | USEFUL | Verify | Automated security scanning. |
| skill-comply | USEFUL | Evolve | Skill compliance checking. |
| skill-stocktake | USEFUL | Evolve | Skill inventory management. |
| article-writing | OPTIONAL | - | Content creation. Not core dev. |
| benchmark | OPTIONAL | - | Performance benchmarking. |
| blueprint | OPTIONAL | - | Project scaffolding. |
| bun-runtime | OPTIONAL | - | Only if Bun adopted. |
| data-scraper-agent | OPTIONAL | - | Web scraping. Maybe for ToratNetz corpus. |
| design-system | OPTIONAL | - | UI design. |
| dmux-workflows | OPTIONAL | - | tmux. Windows compatibility unclear. |
| fal-ai-media | OPTIONAL | - | AI media. Maybe for UNIVERSO KAIRON. |
| nanoclaw-repl | OPTIONAL | - | NanoClaw REPL. Niche. |
| plankton-code-quality | OPTIONAL | - | Code quality metrics. |
| project-guidelines-example | OPTIONAL | - | Reference only. |
| pytorch-patterns | OPTIONAL | - | Only if ML pipeline. |
| regex-vs-llm-structured-text | OPTIONAL | - | Text extraction. Maybe ToratNetz. |
| All Go/Rust/Swift/Java/Kotlin/C++/C#/Perl/PHP/Flutter skills | DROP | - | Languages not in ecosystem. |
| All supply-chain/business skills | DROP | - | Domain irrelevant. |
| All investor/marketing skills | DROP | - | Domain irrelevant. |
| videodb, video-editing, visa-doc-translate, x-api, crosspost | DROP | - | Domain irrelevant. |

### 2.3 Commands (60 total → 13 CORE, 22 USEFUL, 7 OPTIONAL, 18 DROP)

| Command | Class | Mantra | Why |
|---------|-------|--------|-----|
| build-fix | **CORE** | Verify | Fix build errors. Daily driver. |
| checkpoint | **CORE** | Remember | Save progress checkpoints. |
| code-review | **CORE** | Verify | Code review invocation. |
| context-budget | **CORE** | Observe | Context window audit. |
| docs | **CORE** | Remember | Documentation lookup. Prevents hallucination. |
| learn | **CORE** | Evolve | Extract patterns from sessions. Core to mantra. |
| plan | **CORE** | Observe+Specialize | Implementation planning. Foundation. |
| quality-gate | **CORE** | Verify | Quality gate checks. |
| refactor-clean | **CORE** | Evolve | Refactoring invocation. |
| tdd | **CORE** | Verify | TDD workflow. |
| test-coverage | **CORE** | Verify | Coverage checking. |
| verify | **CORE** | Verify | Comprehensive verification. |
| aside | USEFUL | - | Side conversation. |
| devfleet | USEFUL | Evolve | Multi-agent dispatch. For O.L.A.M. |
| e2e | USEFUL | Verify | E2E test generation. |
| eval | USEFUL | Verify | Evaluation runner. |
| evolve | USEFUL | Evolve | Skill evolution trigger. |
| harness-audit | USEFUL | Observe | Harness self-audit. |
| instinct-export/import/status | USEFUL | Evolve | Instinct management. |
| learn-eval | USEFUL | Evolve | Evaluate learned patterns. |
| loop-start/status | USEFUL | Evolve | Autonomous loops. For O.L.A.M. |
| model-route | USEFUL | Specialize | Model tier routing. |
| orchestrate | USEFUL | Evolve | Orchestration. For O.L.A.M. |
| promote | USEFUL | Evolve | Promote instinct to skill. |
| prompt-optimize | USEFUL | Specialize | Prompt improvement. |
| prune | USEFUL | Evolve | Clean up unused components. |
| python-review | USEFUL | Verify | Python phase 2. |
| resume-session/save-session | USEFUL | Remember | Session management. |
| rules-distill | USEFUL | Evolve | Rules from experience. |
| sessions | USEFUL | Remember | Session management. |
| skill-create/health | USEFUL | Evolve | Skill lifecycle. |
| update-codemaps/docs | USEFUL | Remember | Documentation updates. |
| claw | OPTIONAL | - | NanoClaw REPL. Niche. |
| multi-backend/execute/frontend/plan/workflow | OPTIONAL | - | Complex orchestration. |
| projects | OPTIONAL | - | Project listing. |
| setup-pm | OPTIONAL | - | Package manager setup. |
| All Go/Rust/Kotlin/C++ commands | DROP | - | Languages not in ecosystem. |
| gradle-build | DROP | - | Java/Kotlin. |
| pm2 | DROP | - | Not in stack. |

### 2.4 Hooks (27 total → 16 CORE, 6 USEFUL, 5 OPTIONAL)

| Hook | Class | Mantra | Why |
|------|-------|--------|-----|
| block-no-verify | **CORE** | Verify | Prevents git hook bypass. Safety. |
| git-push-reminder | **CORE** | Verify | Review before push. |
| suggest-compact | **CORE** | Observe | Compaction reminders. |
| config-protection | **CORE** | Verify | Prevents weakening linter configs. |
| mcp-health-check | **CORE** | Verify | MCP server monitoring. |
| continuous-learning observe (pre) | **CORE** | Observe | Session observation. |
| quality-gate | **CORE** | Verify | Quality after edits. |
| post-edit-format (prettier) | **CORE** | Verify | Auto-formatting TS. |
| post-edit-typecheck (tsc) | **CORE** | Verify | TypeScript check. |
| continuous-learning observe (post) | **CORE** | Observe | Result observation. |
| mcp-health-check failure | **CORE** | Verify | Failed MCP recovery. |
| pre-compact state save | **CORE** | Remember | Save state before compaction. |
| session-start | **CORE** | Observe+Remember | Load previous context. |
| session-end persist | **CORE** | Remember | Session persistence. |
| evaluate-session | **CORE** | Evolve | Pattern extraction. |
| cost-tracker | **CORE** | Observe | Cost tracking. |
| doc-file-warning | USEFUL | Remember | Non-standard doc warnings. |
| pr-created logger | USEFUL | Remember | PR tracking. |
| build-complete analysis | USEFUL | Verify | Build analysis. |
| console-warn | USEFUL | Verify | console.log warnings. |
| check-console-log (Stop) | USEFUL | Verify | console.log audit. |
| session-end-marker | USEFUL | Remember | Lifecycle marker. |
| auto-tmux-dev | OPTIONAL | - | tmux. Problematic on Windows. |
| tmux-reminder | OPTIONAL | - | tmux. Same issue. |
| insaits-security-monitor | OPTIONAL | - | External dependency. |
| governance-capture (pre) | OPTIONAL | - | Enterprise. Overkill for solo dev. |
| governance-capture (post) | OPTIONAL | - | Same. |

### 2.5 Rules (69 files → 14 CORE, 5 USEFUL, 50 DROP)

| Rule Set | Class | Why |
|----------|-------|-----|
| common/* (9 files) | **CORE** | Universal development standards. |
| TypeScript/* (5 files) | **CORE** | Primary language. |
| Python/* (5 files) | USEFUL | Phase 2. |
| Go, Rust, Swift, Java, Kotlin, C#, C++, Perl, PHP (50 files) | DROP | Not in ecosystem. |

### 2.6 Contexts (3 total → 3 CORE)

| Context | Class | Mantra | Why |
|---------|-------|--------|-----|
| dev.md | **CORE** | Specialize | Development mode. |
| research.md | **CORE** | Observe | Research mode. Aligns with `no_context`. |
| review.md | **CORE** | Verify | Code review mode. |

### 2.7 MCP Configs (25+ → 3 CORE, 5 USEFUL, 5 OPTIONAL, 12 DROP)

| MCP Server | Class | Why |
|------------|-------|-----|
| github | **CORE** | Already configured. Source of truth. |
| supabase | **CORE** | Already configured. Persistence. |
| context7 | **CORE** | Documentation lookup. Prevents hallucination. |
| memory | USEFUL | Persistent memory. Overlaps with Supabase. |
| sequential-thinking | USEFUL | Chain-of-thought reasoning. |
| exa-web-search | USEFUL | Web research. |
| playwright | USEFUL | Browser testing. E2E. |
| devfleet | USEFUL | Multi-agent. For O.L.A.M. |
| token-optimizer | USEFUL | Token compression. |
| firecrawl | OPTIONAL | Web scraping. Maybe for ToratNetz. |
| magic | OPTIONAL | UI components. |
| filesystem | OPTIONAL | Redundant — Claude Code already has file access. |
| insaits | OPTIONAL | Security monitoring. |
| fal-ai | OPTIONAL | AI media. Maybe for UNIVERSO KAIRON. |
| vercel, railway, cloudflare-* (7), clickhouse, browserbase, browser-use, confluence | DROP | Not in stack. |

---

## 3. What to Drop or Redesign

### 3.1 Pure DROP (do not copy)

- **50+ language-specific files** for Go, Rust, Swift, Java, Kotlin, C++, C#, Perl, PHP, Flutter/Dart
- **Domain-specific skills**: carrier-relationship-management, customs-trade-compliance, energy-procurement, inventory-demand-planning, logistics-exception-management, production-scheduling, returns-reverse-logistics, investor-materials, investor-outreach, market-research, product-lens, team-builder, visa-doc-translate, x-api, crosspost
- **Platform MCP configs**: Vercel, Railway, Cloudflare (4), ClickHouse, Confluence, BrowserBase, browser-use

### 3.2 Redesign Required

| Component | Problem | Redesign Direction |
|-----------|---------|-------------------|
| continuous-learning-v2 | Uses local SQLite + shell scripts. Conflicts with Supabase persistence. Unix shell assumptions. | Rewrite: persist instincts to Supabase. Replace shell scripts with Node.js. Replace Python CLI with TypeScript. |
| state-store (scripts/lib/state-store/) | SQLite local state for sessions, skill runs, decisions. Duplicates Supabase. | Migrate to Supabase tables. Single source of truth. |
| tmux hooks (auto-tmux-dev, tmux-reminder) | tmux not native on Windows. | Drop or replace with Windows Terminal alternatives. Make conditional. |
| session-adapters | dmux-tmux adapter useless on Windows. | Keep adapter pattern, implement Windows-compatible adapter. |
| observe.sh (continuous-learning) | Bash script called from hooks. Windows fragile. | Rewrite as Node.js. |
| instinct-cli.py | Python dependency in a TypeScript system. | Rewrite in TypeScript. |
| ai-first-engineering + agentic-engineering | Significant content overlap. | Merge into single skill. |
| autonomous-loops + continuous-agent-loop | Deprecated kept alongside replacement. | Drop autonomous-loops, keep continuous-agent-loop only. |
| memory MCP | Overlaps with continuous-learning instincts AND Supabase. Three competing persistence layers. | Decide one strategy: Supabase. Drop or use only as session cache. |
| Hook profiles (minimal/standard/strict) | run-with-flags.js adds complexity. Solo user doesn't need profiles. | Simplify: enable/disable hooks directly. Single "Kadmon" profile. |
| governance-capture | Enterprise compliance. Overkill for solo dev. | DROP or defer. Security hooks cover the critical parts. |

### 3.3 Copy As-Is (No Changes Needed)

- All 9 common rules files
- All 5 TypeScript rules files
- All 3 context files
- Core agents: architect, planner, code-reviewer, tdd-guide, security-reviewer, database-reviewer, typescript-reviewer, build-error-resolver, refactor-cleaner, docs-lookup
- Core commands: plan, tdd, verify, build-fix, code-review, checkpoint, learn, quality-gate, refactor-clean, context-budget, docs, test-coverage
- Most Node.js hook scripts: block-no-verify, git-push-reminder, config-protection, quality-gate, post-edit-format, post-edit-typecheck, session-start, session-end, pre-compact, cost-tracker, evaluate-session, mcp-health-check
- Core skills: search-first, tdd-workflow, verification-loop, postgres-patterns, database-migrations, security-review, strategic-compact, context-budget, claude-api, cost-aware-llm-pipeline, mcp-server-patterns, documentation-lookup, architecture-decision-records, coding-standards, safety-guard, iterative-retrieval, api-design, agentic-engineering

---

## 4. Honest Critique

### Weakness 1: Persistence Layer Is Incoherent

ECC has **three competing persistence mechanisms** and none is Supabase:
1. SQLite state-store — sessions, skill runs, decisions
2. Local filesystem instincts — `~/.claude/homunculus/`
3. Memory MCP server — knowledge graph

None talk to each other. None survive a machine wipe. None are queryable from other contexts. For `no_context` and Supabase-first, this is a fundamental design problem. Must unify all state into Supabase before "Remember" actually works across sessions.

### Weakness 2: Low Signal-to-Noise Skill Catalog

Of 120+ skills, ~64 are DROP, ~14 OPTIONAL, and several overlap significantly. The "everything" in the name is the problem — built to serve every developer means most is irrelevant to any specific developer. Token cost of loading even skill names into context is non-trivial.

### Weakness 3: Windows Is a Second-Class Citizen

Built on macOS/Linux. Problems:
- tmux hooks fail on Windows
- Shell scripts (.sh) rely on bash behavior fragile under Git Bash/MSYS2
- instinct-cli.py assumes `python3` on PATH (Windows uses `python`)
- Path separators and temp directories (`/tmp/`) are Unix assumptions
- dmux-tmux session adapter is Linux-only
- install.sh has no real Windows equivalent

### Weakness 4: Hook System Fragile at Scale

hooks.json has 25+ entries, many with `matcher: "*"` (every tool call). Each hook spawns Node.js through run-with-flags.js which:
1. Reads flags config
2. Resolves script path
3. Spawns actual hook

On Windows, spawning Node.js on every tool call adds measurable latency. The "observe" hooks run on every PreToolUse AND PostToolUse — every Read, Grep, Glob, Bash, Edit, Write spawns two extra processes.

### Weakness 5: `no_context` Is Not Enforced

The search-first skill encourages research before coding. The docs-lookup agent facilitates finding real docs. But nothing in the hook system **blocks** Claude from generating code without evidence. A true `no_context` enforcement needs a PreToolUse hook on Write/Edit that verifies research was done. ECC does not have this. Must build it.

---

## 5. Open Questions for the Architect

### Q1: Supabase Schema Timing
Should we design Supabase tables for sessions, instincts, skill runs, and decisions in Prompt 2, or as a separate prompt? This is foundational — continuous-learning, session persistence, and cost tracking all need it.

### Q2: Windows Hooks Strategy
The tmux hooks and shell-based hooks need a decision:
- (a) Drop all tmux-dependent features
- (b) Rewrite for Windows Terminal
- (c) Assume WSL is available

### Q3: Python Phase 2 Scope
Python is "phase 2 optional." Do you want Python rules and python-reviewer agent included-but-disabled, or completely omitted from v1? The continuous-learning system has a Python dependency (instinct-cli.py) — rewrite in TypeScript for v1?

### Q4: O.L.A.M. Timeline
Multi-agent orchestration skills (autonomous-loops, continuous-agent-loop, devfleet, loop-operator, orchestrate) are USEFUL for O.L.A.M. How soon is O.L.A.M. development starting? If month 1, several should be promoted to CORE.

### Q5: n8n Confirmation
You said n8n is "historical only." ECC has no n8n-specific components. Confirm there are no n8n integrations to worry about?

### Q6: Hook Profile Decision
ECC supports three profiles (minimal/standard/strict). Preserve this complexity, or simplify to a single "Kadmon" profile? I recommend the latter.

### Q7: Docker Scope
"Deployment-only, not dev-time." Keep docker-patterns skill for deployment phases, or tag OPTIONAL?

### Q8: ToratNetz RAG Specifics
iterative-retrieval is CORE. But ToratNetz needs domain-specific retrieval (Hebrew text, Torah embeddings, pgvector search). Should Prompt 2 include a custom ToratNetz RAG skill, or is that project-level?

---

## Summary Counts

| Component | Total | CORE | USEFUL | OPTIONAL | DROP |
|-----------|-------|------|--------|----------|------|
| Agents | 28 | 9 | 5 | 1 | 13 |
| Skills | 120+ | ~20 | ~22 | ~14 | ~64 |
| Commands | 60 | 13 | 22 | 7 | 18 |
| Hooks | 27 | 16 | 6 | 5 | 0 |
| Rules | 69 | 14 | 5 | 0 | 50 |
| Contexts | 3 | 3 | 0 | 0 | 0 |
| MCPs | 25+ | 3 | 5 | 5 | 12+ |

**The Kadmon Harness v1 core: 9 agents, ~20 skills, 13 commands, 16 hooks, 14 rules, 3 contexts, 3 MCPs.**

A smaller, stronger core — not a bloated clone.

## Status
Prompt 1 complete. Waiting for architect answers to open questions before Prompt 2.
