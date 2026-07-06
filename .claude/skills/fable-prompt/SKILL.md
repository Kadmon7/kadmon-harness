---
name: fable-prompt
description: "Author high-leverage prompts for Claude Fable 5 runs following Matt Shumer's method — goal-not-steps, house rules, a concrete self-checkable bar for done, fresh-context adversarial verification, loop-until-bar, building on prior work and traces, and effort selection (ultrathink single-turn, ultracode only for foundations). Use this skill whenever the user is about to hand Claude a big autonomous, long-running, or creative task and wants the prompt engineered well: 'how should I prompt this', 'help me write the prompt', 'prompt fable', 'set the bar', planning a /loop run, an overnight or weekend autonomous build, a multi-session build, deciding whether ultracode is worth the cost, or asking why their Fable results look average when the demos look magical. The fix is usually the prompting method, not the model."
---

# Fable Prompt

Help the user author the prompt for a Claude Fable 5 run — especially big, autonomous, long-running, or creative work. This skill owns the process (interview, synthesize, present); the method it applies lives in `references/method.md`. The value the user gets is a finished, copy-pasteable prompt built on that method — not a lecture about the method.

## Process

### 1. Read the method first

Read `references/method.md` before asking or writing anything. The priority order in it matters: Shumer's seven-point spine is non-negotiable; the supporting layers (effort mechanics, guardrail blocks, unknown-discovery) are optional reinforcements, and two of them are explicitly flagged as unverified summaries — do not present those as official guidance.

### 2. Interview — one question at a time

Fable prompts fail on unresolved unknowns, not on wording. Interview the user one question at a time, prioritizing the questions whose answers change the prompt structurally:

1. **Goal** — what does the world look like when this is done? (Deliberately not: what are the steps.)
2. **The bar** — how would a skeptic verify "done" without trusting the builder? Push past adjectives; "high quality" is not a bar. If the user can't articulate a measurable bar, that's fine — measuring it becomes part of Fable's job, and the prompt should say so.
3. **House rules** — the handful of things that must always be true no matter which path Fable takes.
4. **Budget and permissions** — paid services, where keys live, what Fable may decide alone, what only the user can decide.
5. **Prior work** — existing code, traces of old sessions, references to imitate ("reimplement these semantics" beats prose descriptions).
6. **Duration and shape** — single deep turn, a /loop run, or a team of coordinated sessions?

Skip any question the user's message or the conversation already answers. Stop interviewing as soon as the seven spine elements are resolvable — over-interviewing wastes exactly the time this method is meant to save. For genuinely underspecified taste-driven work, offer a blind-spot pass or throwaway prototypes (method reference, supporting layer C) instead of more questions.

### 3. Synthesize the prompt

Assemble the prompt with these elements, in roughly this order:

1. The goal, stated as an outcome, with zero implementation steps.
2. House rules (short list; each one a hard invariant, not a preference).
3. The bar for done — concrete and self-checkable, or an instruction to build the measurement first.
4. Verification: whatever builds never grades itself — spin up a fresh-context sub-agent pointed at the real output (pixels, running app) whose job is to prove the work is NOT passing.
5. Loop instruction when the run is long or creative: build, check against the bar, find the biggest gap, close it, repeat; the run never self-declares finished.
6. Prior work pointers: code paths, session traces, references.
7. Get-out-of-the-way clauses: budget, key locations, "make your own calls; only return if truly blocked or facing a decision only I can make."
8. Effort recommendation with rationale: default high; `ultrathink` for one hard turn; `ultracode` only for foundations the user will build on for months. Recommend against paying for ultracode anywhere else.

For huge, consequential builds, add the planning exception: require the plan and all clarifying questions BEFORE any code, then an uninterrupted run.

### 4. Present

Present three things, nothing else:

1. The finished prompt in one fenced block, ready to paste.
2. A short rationale (2-4 bullets): the bar you chose and why, the effort level and why, anything you decided on the user's behalf.
3. What to watch during the run (progress doc, when to intervene, what failure looks like).

## Harness note (Kadmon projects)

This skill ships inside the Kadmon Harness, which already covers two of the method's guardrail blocks — do not duplicate them into prompts for harness-managed sessions:

- **Memory block**: do NOT include it. Harness projects run a richer file-based memory system (auto-memory, typed entries, MEMORY.md index). Adopting the method's simpler block would be a downgrade. Include it only when prompting a bare environment without the harness.
- **Progress-verification block**: overlaps the harness reporting rules and /chekpoint evidence discipline. Include it only for non-harness or API-side runs.

Useful equivalences when the user works inside the harness: builder-never-grades maps to /chekpoint's fresh-context reviewers; loop-until-bar maps to /loop; "read the traces" maps to session memory and observations.

## Pitfalls

- **Adjectives as bar.** "Make it high quality / polished / production-ready" guarantees Fable stops below the user's standard. Every bar must be checkable by someone who distrusts the builder.
- **Dictating steps.** Each prescribed step overrides Fable's judgment with the user's — usually a downgrade. Push how-details out of the prompt; keep invariants in.
- **Builder self-grading.** A run that verifies its own success will declare victory. The verification sub-agent must have a fresh context and an adversarial goal.
- **Ultracode by default.** It is a foundations-only spend. A good loop with an ambitious bar gets there without it.
- **Interviewing forever.** The interview exists to resolve the spine, not to be thorough. Six questions maximum before drafting; iterate on the draft instead.
