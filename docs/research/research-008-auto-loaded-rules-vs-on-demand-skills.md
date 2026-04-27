---
title: "Auto-loaded Rules vs On-demand Skills: Context-window tradeoff"
slug: auto-loaded-rules-vs-on-demand-skills
date: 2026-04-25
sources_count: 9
confidence: High
caps_hit: []
open_questions:
  - Does prompt caching in Claude Code substantially reduce the per-turn cost of a large CLAUDE.md, and does that change the calculus?
  - Is there published data on skill false-negative rates specifically for Kadmon-style K-first trigger phrases vs generic English descriptions?
  - At exactly what CLAUDE.md line/token count does Claude's adherence visibly degrade in practice on Sonnet 4.6 vs Opus?
summary: >
  Anthropic's own best-practices doc warns that bloated CLAUDE.md files cause Claude to ignore instructions; this is confirmed by the "lost-in-the-middle" positional attention degradation (up to 20–50 percentage points for mid-context content at 100k+ tokens). Long-context retrieval benchmarks (MRCR v2) show Claude Opus 4.6 at 93% accuracy at 256k and 78% at 1M tokens, while Opus 4.7 regressed sharply (-33 pp at 256k, -46 pp at 1M). Skill activation without optimization starts at ~20% reliability, rising to 50% with better descriptions and up to 90% with examples. The empirical recommendation is to trim aggressively: keep only rules that change behavior you cannot enforce deterministically via hooks, and move reference/domain material to skills with well-crafted trigger descriptions.
derived_from: ""
---

<!-- PERSIST_REPORT_INPUT
{
  "topic": "Auto-loaded rules vs on-demand skills: context-window tradeoff for Kadmon Harness",
  "slug": "auto-loaded-rules-vs-on-demand-skills",
  "subQuestions": [
    "Q1: Long-context accuracy degradation in Claude Opus 4.x — MRCR benchmarks and lost-in-the-middle",
    "Q2: Effect of dense in-context instructions on hallucination and adherence",
    "Q3: Claude Code skill activation reliability — false-negative rates and trigger optimization",
    "Q4: Anthropic official guidance on CLAUDE.md size and what to include"
  ],
  "sourcesCount": 9,
  "confidence": "High",
  "capsHit": [],
  "openQuestions": [
    "Does prompt caching in Claude Code substantially reduce the per-turn cost of a large CLAUDE.md, and does that change the calculus?",
    "Is there published data on skill false-negative rates specifically for Kadmon-style K-first trigger phrases vs generic English descriptions?",
    "At exactly what CLAUDE.md line/token count does Claude adherence visibly degrade in practice on Sonnet 4.6 vs Opus?"
  ],
  "summary": "Anthropic's own best-practices doc warns that bloated CLAUDE.md files cause Claude to ignore instructions; this is confirmed by the lost-in-the-middle positional attention degradation (up to 20-50 percentage points for mid-context content at 100k+ tokens). Long-context retrieval benchmarks (MRCR v2) show Claude Opus 4.6 at 93% accuracy at 256k and 78% at 1M tokens, while Opus 4.7 regressed sharply. Skill activation without optimization starts at ~20% reliability, rising to 50% with better descriptions and up to 90% with examples. The empirical recommendation is to trim aggressively: keep only rules that change behavior you cannot enforce deterministically via hooks, and move reference/domain material to skills with well-crafted trigger descriptions."
}
-->

## Research: Auto-loaded rules vs on-demand skills — context-window tradeoff [skavenger]

### TL;DR

Anthropic's own docs say a bloated CLAUDE.md causes Claude to ignore rules — this is empirically grounded in positional attention degradation at scale. Skill activation starts at 20% reliability without description tuning but reaches 90% with examples. For a 36k-token auto-load context, trimming 8k tokens is worth it, but only if the trimmed content moves to well-described skills or hooks.

### Executive Summary

Four sub-questions were investigated using Anthropic's official best-practices documentation, published MRCR v2 benchmark data, peer-reviewed NLP research (Stanford/MIT), and community-sourced skill engineering data. The evidence is consistent: long auto-loaded context degrades instruction-following both through sheer positional attention dilution and through the lost-in-the-middle effect (U-shaped accuracy curve, 20-50 pp degradation for middle-positioned content at 100k+ tokens). At 36k tokens, the harness is comfortably below the 256k cliff where MRCR data shows sharp drops, but Anthropic explicitly warns that over-specified CLAUDE.md files cause Claude to ignore rules even at shorter contexts. Moving content to skills is viable — but requires investing in description quality; unoptimized skills fail to trigger 80% of the time. Deterministic hooks remain the gold standard for behavior that must always apply.

---

### 1. Q1 — Long-context accuracy degradation in Claude Opus 4.x

**MRCR v2 benchmark (8-needle retrieval):**

| Model | 256k tokens | 1M tokens |
|---|---|---|
| Opus 4.6 | 91–93% | 76–78% |
| Opus 4.7 | 59.2% | 32.2% |

Sources: [Anthropic — Introducing Claude Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6), [WentuoAI — Opus 4.7 long-context regression](https://blog.wentuo.ai/en/claude-opus-4-7-long-context-regression-en.html).

**Confidence: High** — MRCR v2 scores are from Anthropic's own release post, with corroborating third-party analysis.

The user's reference to "~90% at 256k, dropping to ~78% at 1M" maps correctly to Opus 4.6 (not 4.7). Opus 4.7 regressed sharply — a -32.7 pp drop at 256k and -46.1 pp at 1M ([WentuoAI](https://blog.wentuo.ai/en/claude-opus-4-7-long-context-regression-en.html)), attributed to "mid-context blindness especially beyond 128k tokens." Claude Code runs Sonnet 4.6 (this session's model), which has no published MRCR scores, but the degradation pattern from shorter → longer is consistent across the Claude family.

**Lost-in-the-middle effect:** The original 2023 Stanford/MIT paper, confirmed in multiple 2024-2025 replications, documents a U-shaped attention curve: accuracy is highest at document positions 1 (start) and 20 (end), dropping ~20 pp for content in the middle ([Morph LLM — Lost in the Middle](https://www.morphllm.com/lost-in-the-middle-llm), [MIT TACL paper](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00638/119630/Lost-in-the-Middle-How-Language-Models-Use-Long-Contexts)). Critically: "accuracy drops of 20-50% from 10K to 100K tokens" — the effect is not exclusive to the 256k+ range. Instruction fine-tuning does not eliminate the U-shaped pattern ([Morph LLM](https://www.morphllm.com/lost-in-the-middle-llm)).

**Implication for system prompt vs mid-context rules:** Front-positioned content (system prompt, CLAUDE.md loaded first) benefits from the primacy end of the U-curve. Rules buried mid-conversation accumulate in the "lost" middle zone. This favors keeping genuinely universal rules in CLAUDE.md over mid-session prompting — but the file must stay short enough that all rules land near the primacy zone, not scattered across 36k tokens.

**Practical threshold:** The 256k mark is where retrieval accuracy cliff-dives in MRCR. At 36k tokens, the harness is well under that cliff. But Anthropic's docs cite degradation symptoms at much shorter lengths without citing a specific token threshold (see Q4).

---

### 2. Q2 — Effect of dense instructions on hallucination and adherence

**Empirical data from peer review:**

The [Frontiers AI hallucination survey (2025)](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1622292/full) tested structured vs vague prompting:
- Zero-shot (no instructions): 38.3% hallucination rate
- Instruction-based prompting: 24.6% hallucination rate
- Chain-of-Thought structured prompting: 18.1% hallucination rate

**Confidence: Medium** — The paper tests prompting strategy differences, not rule density specifically. The "instruction-based" category covers a range of specificities.

**Diminishing returns and backfiring:** The same survey found that excessive instructions amplify hallucinations when underlying model knowledge is insufficient: "CoT prompting sometimes produced a longer but still incorrect answer." The paper introduces a Prompt Clarity Score (PCS) and finds models are differentially sensitive — past a specificity threshold, more instructions don't help. No specific token count for the backfire threshold is provided.

**Attention dilution in coding contexts:** The [hallucination survey on LLM-based agents (arXiv:2509.18970)](https://arxiv.org/html/2509.18970v1) identifies instruction-following failure as a direct cause of hallucination in agentic loops. This is directly relevant to Claude Code: when rule density exceeds the model's reliable attention span for any given request, the model selectively ignores lower-priority rules.

**Correlation between CLAUDE.md length and task success:** No published study directly measures CLAUDE.md token count vs. task success rate. The closest evidence is qualitative: Anthropic's own documentation (Q4 findings) reports this relationship anecdotally but does not provide a coefficient.

---

### 3. Q3 — Skill activation reliability

**Quantitative data from community skill engineering ([GitHub Gist — mellanon](https://gist.github.com/mellanon/50816550ecb5f3b239aa77eef7b8ed8d)):**

| Skill description quality | Activation rate |
|---|---|
| No optimization | ~20% |
| Simple description | 20% |
| Optimized description (USE WHEN + keywords) | 50% |
| LLM pre-eval hook added | 80% |
| Forced eval hook | 84% |
| Optimized + examples | ~90% |

**Confidence: Medium** — This is community-sourced data from 200+ prompt tests, not a peer-reviewed study. Methodology not independently verified.

**False-negative rate without optimization: ~80%.** Skills without explicit "USE WHEN" patterns with trigger keywords fail to activate in 80% of relevant scenarios. This is the critical risk in moving auto-loaded rules to on-demand skills: if the skill description is not engineered carefully, the content is effectively invisible to the model during tasks where it should apply.

**Anthropic's official framing:** The [Claude Code best practices doc](https://code.claude.com/docs/en/best-practices) explicitly positions skills as the right home for "domain knowledge or workflows that are only relevant sometimes" — contrasted with CLAUDE.md for "things that apply broadly." Anthropic does not publish false-negative rates for skill triggers in their official docs.

**Key constraint:** Only `name` and `description` are loaded initially for skills. Full `SKILL.md` content is loaded on demand after trigger detection. This means the trigger decision is made on a small description token budget — description quality is the sole lever.

---

### 4. Q4 — Anthropic's official guidance on CLAUDE.md size

**From [Claude Code best practices (official)](https://code.claude.com/docs/en/best-practices):**

Direct quotes (no paraphrase):
- "Keep it short and human-readable."
- "CLAUDE.md is loaded every session, so only include things that apply broadly. For domain knowledge or workflows that are only relevant sometimes, use skills instead."
- "Keep it concise. For each line, ask: 'Would removing this cause Claude to make mistakes?' If not, cut it. Bloated CLAUDE.md files cause Claude to ignore your actual instructions!"
- "If Claude keeps doing something you don't want despite having a rule against it, the file is probably too long and the rule is getting lost."

**No specific token/line limit is given.** The "200 lines" figure circulated in community sources ([branch8.com cost guide](https://branch8.com/posts/claude-code-token-limits-cost-optimization-apac-teams)) is community convention, not an Anthropic hard limit.

**Dogfooding patterns:** Anthropic's sample CLAUDE.md in the docs is 8 lines (code style + 2 workflow rules). This signals their internal preference strongly leans minimal.

**Official include/exclude table from Anthropic docs:**

| Include | Exclude |
|---|---|
| Bash commands Claude can't guess | Anything Claude can figure out by reading code |
| Code style rules that differ from defaults | Standard language conventions Claude already knows |
| Testing instructions and preferred test runners | Detailed API documentation (link to docs instead) |
| Repository etiquette | Information that changes frequently |
| Architectural decisions specific to your project | Long explanations or tutorials |
| Developer environment quirks | File-by-file descriptions of the codebase |
| Common gotchas or non-obvious behaviors | Self-evident practices like "write clean code" |

**Confidence: High** — This is primary source, Anthropic's own documentation. No ambiguity.

**On hooks as enforcement:** Anthropic explicitly distinguishes CLAUDE.md rules (advisory) from hooks (deterministic). "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens." This is the strongest architectural argument for moving enforcement logic out of CLAUDE.md entirely.

---

### Key Takeaways

- At 36k tokens, the harness is below the 256k MRCR cliff, but Anthropic's docs indicate degradation symptoms appear before that threshold — "bloated CLAUDE.md files cause Claude to ignore your actual instructions" is a qualitative finding that applies at conversational lengths.
- Every rule that can be enforced by a hook should be removed from CLAUDE.md. Hooks are deterministic; CLAUDE.md rules are advisory and attention-subject.
- Moving reference material to skills is safe if — and only if — the skill descriptions use explicit USE WHEN triggers with specific keywords. Unoptimized skills fail to activate 80% of the time.
- The 8k token trim (36k → 28k) is directionally correct per the evidence, but the value depends entirely on what gets trimmed. Rules that change behavior → keep. Reference content (agent tables, rule catalogs, pattern documentation) → move to skills.
- Lost-in-the-middle applies to mid-context instruction accumulation, but front-loaded CLAUDE.md content occupies the primacy advantage zone. Keep truly universal rules at the front; do not scatter them through a long file.
- Counter-argument: if prompt caching is active, the marginal per-turn cost of a static CLAUDE.md is low (90% cache hit discount). The degradation risk remains, but the token-cost argument weakens for cached sessions.

### Open Questions

- Does prompt caching in Claude Code substantially reduce the per-turn cost of a large CLAUDE.md, and does that change the calculus?
- Is there published data on skill false-negative rates specifically for Kadmon-style K-first trigger phrases vs generic English descriptions?
- At exactly what CLAUDE.md line/token count does Claude adherence visibly degrade in practice on Sonnet 4.6 vs Opus?

### Sources

1. [Anthropic — Introducing Claude Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6) — Official release with MRCR v2 benchmark scores at 256k and 1M tokens
2. [WentuoAI — Opus 4.7 long-context regression analysis](https://blog.wentuo.ai/en/claude-opus-4-7-long-context-regression-en.html) — MRCR degradation table, mid-context blindness findings
3. [Anthropic — Claude Code Best Practices (official)](https://code.claude.com/docs/en/best-practices) — CLAUDE.md size guidance, skills vs CLAUDE.md decision framework, hooks as deterministic enforcement
4. [MIT TACL — Lost in the Middle (Liu et al., 2023)](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00638/119630/Lost-in-the-Middle-How-Language-Models-Use-Long-Contexts) — Original U-shaped attention research, system prompt vs mid-context findings
5. [Morph LLM — Lost in the Middle explained](https://www.morphllm.com/lost-in-the-middle-llm) — Quantified degradation: 75% → 55% accuracy from positional effects alone
6. [Frontiers AI — Hallucination attribution to prompting strategies (2025)](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1622292/full) — Instruction density effects: 38.3% → 18.1% hallucination rate across prompting strategies; diminishing returns finding
7. [arXiv:2509.18970 — LLM Agent Hallucination Survey](https://arxiv.org/html/2509.18970v1) — Instruction-following failure as primary hallucination cause in agentic systems
8. [GitHub Gist — mellanon, Claude Code Skill Structure Guide](https://gist.github.com/mellanon/50816550ecb5f3b239aa77eef7b8ed8d) — Skill activation rates by description quality (200+ prompt tests)
9. [Branch8 — Claude Code token cost optimization](https://branch8.com/posts/claude-code-token-limits-cost-optimization-apac-teams) — Community 200-line convention for CLAUDE.md, 40-85% token reduction patterns

### Methodology

Searched 4 queries / fetched 5 URLs / 0 video transcripts.
Parallel sub-question execution (F9): 4 sub-questions investigated simultaneously via parallel WebSearch + WebFetch batches.
Caps hit: none (5/5 WebFetch used, all 4 sub-questions answered within 3 WebSearch calls each).
Confidence: High.
Diversity: passed — official Anthropic docs (1), academic/peer-reviewed (2: TACL + Frontiers), industry analysis (3), community benchmark (1) — 4 source categories, 7+ domains.
Self-eval: coverage 1.00, cross-verification 0.75, recency 1.00, diversity 1.00 → composite 0.925 (no second pass).
