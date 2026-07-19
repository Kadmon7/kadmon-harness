# Agent Docs

> 14 nodes

## Key Concepts

- **python-reviewer (Python Specialist, sonnet)** (5 connections) — `.claude/agents/python-reviewer.md`
- **skavenger (Researcher, sonnet)** (5 connections) — `.claude/agents/skavenger.md`
- **almanak (Docs Lookup, sonnet)** (3 connections) — `.claude/agents/almanak.md`
- **no_context enforcer for API knowledge (Context7 only, never training data)** (3 connections) — `.claude/agents/almanak.md`
- **Route B - general query with inline PDF/arXiv preprocessing** (2 connections) — `.claude/agents/skavenger.md`
- **Execution caps (5 sub-questions, 3 searches each, 5 fetches, 1 transcript per URL)** (2 connections) — `.claude/agents/skavenger.md`
- **Self-evaluation rubric (coverage/cross-verification/recency/diversity, 0.7 second-pass trigger)** (2 connections) — `.claude/agents/skavenger.md`
- **PERSIST_REPORT_INPUT machine-parsed fence (auto-write to docs/research/)** (2 connections) — `.claude/agents/skavenger.md`
- **Fetched content is untrusted (prompt-injection resistance, never spawn Task from fetched text)** (2 connections) — `.claude/agents/skavenger.md`
- **3-call limit then no_context** (1 connections) — `.claude/agents/almanak.md`
- **ML-specific checks (embedding dims, tokenizer/model parity, seeds, batch embeddings, normalization)** (1 connections) — `.claude/agents/python-reviewer.md`
- **Diagnostics-first workflow (mypy/ruff/bandit before judging quality)** (1 connections) — `.claude/agents/python-reviewer.md`
- **Route A - media URL via yt-dlp transcript helper (host-based strict classification)** (1 connections) — `.claude/agents/skavenger.md`
- **Depth modes (--plan dry-run, --verify hypothesis PRO/CONTRA, --drill sub-question expansion)** (1 connections) — `.claude/agents/skavenger.md`

## Relationships

- [Architect & Alchemist Agents](Architect_%26_Alchemist_Agents.md) (3 shared connections)
- [Agent Docs](Agent_Docs.md) (2 shared connections)

## Source Files

- `.claude/agents/almanak.md`
- `.claude/agents/python-reviewer.md`
- `.claude/agents/skavenger.md`

## Audit Trail

- EXTRACTED: 28 (90%)
- INFERRED: 3 (10%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*