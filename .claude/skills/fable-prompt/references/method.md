# How to Prompt Fable 5 — Method Reference

The knowledge base for the `fable-prompt` skill. The skill owns the *process* (interview → synthesize → present); this file owns the *method* it draws on.

**Primary source:** Matt Shumer's "How I Prompt Fable" (the simplemarkdowneditor doc). His approach is the spine of this guide.

**Supporting sources (secondary, reinforce the spine — never replace it):**
- A cyrilXBT article that *summarizes what it describes as* Anthropic's official Fable 5 guidance. This is a secondary, **unverified** summary — not confirmed Anthropic-official. Use its mechanics (effort levels, guardrail blocks); do not treat its wording as canonical.
- Thariq's "Field Guide to Fable: Finding Your Unknowns" (@trq212) — unknown-discovery patterns (blind-spot pass, interviews, references, prototypes, implementation notes).

Shumer's own summary of why his results look different: *"I don't spoon-feed it, I hold it to a bar it can't talk its way out of, and I let it build on everything it's already made."*

## Priority order

If sources conflict, follow Shumer. The non-negotiable spine:
1. goal, not steps;
2. house rules;
3. concrete self-checkable bar for done;
4. builder never grades itself (fresh-context adversarial sub-agent);
5. loop against the bar when long or creative;
6. build on prior work / traces;
7. remove unnecessary permission stops.

Supporting-source mechanics are optional guardrails that reinforce the spine.

---

## The one-line thesis

Fable is a genuine next-gen model. **Prompt it like the current models and you get current-model results.** Change how you prompt it — and what you're willing to hand it — and the door opens. The demos that look impossible are usually *simpler* prompts than people assume; the difference is method, not complexity.

---

## Shumer's method (the core — apply this first)

### 1. Give it the goal, not the steps
Stop spelling out *how*. Older models wandered without step-by-step; Fable is the opposite — **the more room you give it, the better it does.** Hand it big, sweeping, underspecified work the way you'd hand a goal to a brilliant person you trust. Every step you dictate is you overriding its judgment with yours, and yours is usually worse. This feels risky; the next two rules make it safe.

### 2. Set house rules so you can trust it
An underspecified goal is safe when you fence it with a **handful of things that must always be true**, no matter how it reaches the goal. Example house rule: *"Don't hard-code special cases. Describe the behavior you want in the agent's system prompt and let the agent reason."* (Models love to over-engineer — a regex for one case where a prompt would do.)
- For extra protection: have Fable always hand **one sub-agent a single job — check the work against the house rules before anything ships.** Now you can let it run wide open and still know it won't break what you care about.

### 3. Give it a real bar for "done"
**Never use adjectives like "high quality."** Fable will stop at its own idea of good enough, which is lower than yours. Give a **concrete, self-checkable, hard bar.**
- Write the test yourself when you can: *"a stranger can't tell our render from the real photo."*
- When you can't even measure the thing, **hand that problem to Fable too.** (Real example: to clone a component library, Fable took a screen recording of the real components, turned it into a heat map of where everything moved, and looped until its version matched. They defined *done*, not *how*.)
- **The single most important rule:** *whatever builds something never gets to grade it.* The build agent is biased and has a whole trajectory of reasons to declare victory. Always spin up a **separate Fable sub-agent with a fresh context window**, point it at the *real output* (actual pixels, actual running app), and have it **try to prove the thing is NOT passing.**

### 4. Loop it until it hits the bar (especially creative work)
Once there's a bar, put Fable on a loop: build → check itself → find the biggest gap → close it → repeat. For hours or days. Use **`/loop`**. The whole point: **Fable never gets to decide it's finished** — there's always a next gap. It stops when you say so, or when it genuinely can't find anything left to fix.
- **Progress via a live doc:** have Fable post progress (screenshots, notes) to a shared markdown doc as it runs. Glance from your phone, drop comments anytime to steer it mid-run.
- **Multi-Fable coordination:** a shared doc with a Trello-style board + chat lets several Fables post tasks for each other, claim them, ask questions, and flag conflicts. The doc becomes the coordination layer.

### 5. Let it build on what you've already done
Old work is fuel. The first hard thing takes a carefully-written prompt (Shumer's first build, a photorealistic 3D forest, had no reference point). After that, **point Fable at the prior work**: *"here's the code, here's the quality bar — match this and go beyond it."*
- Goes beyond reusing code: Fable can **read the traces of your old Claude Code sessions** — what it tried, what worked, what didn't. Instead of re-explaining an approach, say *"read the forest traces and learn what worked."* The later Hogwarts build came together far faster this way.

### 6. Get out of its way
Every stop-and-ask costs time. Clear obstacles up front:
- Give it a **budget** instead of per-use permission for paid services.
- Tell it **where keys/credentials live.**
- Tell it, in writing, to **make its own calls and only return if truly blocked or facing something only you can decide.**
- **Exception — planning:** only for huge, extremely consequential builds, get the plan *before* any code and have it ask you everything it's unsure about up front. Once the plan is settled, it runs without stopping.

### 7. Two ways Shumer runs this
Same loop, same hard bar, same evidence — the setup around it changes:
- **Engineering — run a team.** Several Fable sessions pull tasks (a list, Linear, the shared board, or hand-dealt). Each does its task, triple-checks with sub-agents, opens a PR **with evidence**. One more Fable does *nothing but integrate*: merges PRs, runs everything, tests like a real user, keeps it green. Overlapping features → tell one Fable to watch the other's traces and stay compatible; they coordinate in the doc's chat.
- **Creative — momentum + detail.** Same loop and bar, but **fan out sub-agents to perfect individual pieces** (a separate sub-agent for each kind of tree in a forest). Sometimes run several completely separate attempts at once, keep the best, carry what worked into the next round.

You mix these however the build demands.

### 8. When to spend on ultracode
There's a heavier mode, `ultracode`, that costs a lot more. Shumer **almost never uses it** — a good loop with an ambitious enough goal gets there without it. Where it earns its cost: **foundations.** A new system you'll build on for months (the core of a business or codebase) should be right from day one — same reason he threw out ShadCN and started from scratch. A good foundation makes everything on top easier; a bad one makes everything harder forever. For that, and pretty much only that, pay for it.

---

## Supporting layer A: reported effort mechanics (cyrilXBT summary, unverified)

Fable responses take longer *by design* — it plans, self-checks, expands context. Minutes for one high-effort turn; hours autonomous. That's the work being done right.

**Effort is a cost/latency dial, NOT a quality dial:**
- **low / medium** — routine subtasks, cost-sensitive.
- **high** — default; most demanding work.
- **xhigh** — max; when first-shot correctness > speed (it validates its own work). Worth it for a migration; overkill for formatting.

**Triggering:**
- Single-turn depth: put **`ultrathink`** in the prompt (xhigh for that turn only).
- Session-wide: **`/effort ultracode`** in Claude Code (xhigh + dynamic parallel-agent orchestration). Matches Shumer's "foundations only" advice above.
- API: set `effort`. Raw chain-of-thought is never returned; `thinking.display` = `summarized` or `omitted` (default).
- **Extend your timeouts** — an Opus-era timeout will kill a 3-minute Fable planning phase.

## Supporting layer B: reported long-run guardrail blocks (cyrilXBT summary, unverified)

Add the relevant ones to any run longer than a few minutes or involving tool execution. These reinforce Shumer's method (esp. the "prove it's not done" and "get out of its way" rules).

**Progress verification** (kills fabricated "I did it" reports — the highest-value block; note it echoes the harness's own reporting rule):
> "Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for. If something is not yet verified, say so explicitly. Report outcomes faithfully: if tests fail, say so with the output. If a step was skipped, state that. When something is done and verified, state it plainly without hedging."

**Proactivity constraint** (Fable is noticeably more proactive — may draft emails, make git branches unasked):
> "When the user is describing a problem, asking a question, or thinking out loud rather than requesting a change, the deliverable is your assessment. Report your findings and stop. Do not apply a fix until asked. Before running a command that changes system state, including restarts, deletes, or config edits, confirm that the evidence actually supports that specific action."

**Final response format** (long runs end in shorthand only the watcher can parse):
> "For your final response: state the outcome first, then the key supporting details. No working abbreviations, internal labels, or arrow chains in user-facing output. Give the outcome, the evidence, the risks if any, and the next step."

**Memory across sessions** (enables multi-day coherence — the systematized version of Shumer's "build on prior work"):
> "Maintain a memory system in [folder]. One lesson per file with a one-line summary at top. Record corrections and confirmed approaches, including why they mattered. Don't save what's already in the repo or chat history. Update existing notes rather than duplicate. Delete notes proven wrong."

**Sub-agent delegation:**
> "Delegate independent subtasks to sub-agents and continue working while they run. Each gets a specific, bounded scope and explicit success criteria. Synthesize only after all report. If a sub-agent fails, report that clearly rather than inferring what it would have found."

**Vision compare** (Fable reads raw/messy screenshots and can self-check UI):
> "Here is the design target and a screenshot of the current implementation. Use vision to identify differences and generate the changes to close the gap. Crop and zoom into any unclear areas before reporting."

## Supporting layer C: finding your unknowns (Thariq / @trq212)

Quality is bottlenecked by your ability to **clarify Fable's unknowns**, not by the model. Before a big run, resolve them cheaply:
- **Blind spot pass** (use the literal words): *"Do a blindspot pass to help me find my unknown unknowns and prompt you better."* Give context on who you are and what you already know.
- **Brainstorm / prototype** to set scope — for taste-driven work, ask for several wildly different HTML mockups with fake data to react to *before* wiring anything.
- **Interview me**: *"Interview me one question at a time; prioritize questions where my answer would change the architecture."*
- **References beat prose** — point Fable at source code (a folder/library/component you like, any language) and say "reimplement these semantics." This is Shumer's "build on prior work" from the other direction.
- **Implementation plan** that leads with the decisions you're most likely to change (data models, interfaces, UX) and buries mechanical refactoring.
- Keep an **`implementation-notes.md`** during the run for deviations; a **quiz** after ("give me an HTML report + a quiz I must pass") before you merge.

---

## Refusals (API builders)
Safety classifiers (offensive cyber, bio/life-sciences, thinking-extraction) return **`stop_reason: "refusal"` as HTTP 200**, not an error. Parse `stop_reason` separately from HTTP status; SDK middleware can auto-fall-back to Opus 4.8. <5% of typical dev queries, but test flagged-domain workflows first.
