# Agent Docs

> 14 nodes

## Key Concepts

- **Upstream BLOCK preservation (may consolidate/escalate, must never downgrade or suppress)** (7 connections) — `.claude/agents/kody.md`
- **spektr (Security Specialist, opus)** (7 connections) — `.claude/agents/spektr.md`
- **kody (Lead Reviewer / consolidator, sonnet)** (5 connections) — `.claude/agents/kody.md`
- **Confidence-based filtering (>80% confident, consolidate similar, skip style noise)** (4 connections) — `.claude/agents/kody.md`
- **SAFE / CAREFUL / RISKY removal categorization (grep beats static analysis)** (2 connections) — `.claude/agents/kurator.md`
- **Code pattern severity table (hardcoded secrets, shell injection, concat SQL, eval)** (2 connections) — `.claude/agents/spektr.md`
- **Common false positives (verify context before flagging; .env.example, test fixtures, checksums)** (2 connections) — `.claude/agents/spektr.md`
- **C-005 - heuristic guard hooks: fix realistic cases, document scope, stop the bypass arms race** (2 connections) — `CORRECTIONS.md`
- **Blocking security hooks fail closed on malformed stdin (AUD-12)** (2 connections) — `CHANGELOG.md`
- **/chekpoint diff-scope-aware via getDiffScope (ADR-034 runtime authority)** (2 connections) — `CHANGELOG.md`
- **AUD-33 - config-protection.js residual heuristic scope (no JS tokenizer)** (2 connections) — `BACKLOG.md`
- **Approval criteria (Approve / Warning / Block by CRITICAL-HIGH severity)** (1 connections) — `.claude/agents/kody.md`
- **AI-generated code review addendum (regressions, trust boundaries, hidden coupling, model cost)** (1 connections) — `.claude/agents/kody.md`
- **Emergency response (STOP, document, alert, remediate, verify, rotate)** (1 connections) — `.claude/agents/spektr.md`

## Relationships

- [Agent Docs](Agent_Docs.md) (6 shared connections)
- [Architect & Alchemist Agents](Architect_%26_Alchemist_Agents.md) (4 shared connections)

## Source Files

- `.claude/agents/kody.md`
- `.claude/agents/kurator.md`
- `.claude/agents/spektr.md`
- `BACKLOG.md`
- `CHANGELOG.md`
- `CORRECTIONS.md`

## Audit Trail

- EXTRACTED: 32 (80%)
- INFERRED: 8 (20%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*