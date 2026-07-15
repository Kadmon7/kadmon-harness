---
name: copy-deslop
description: >-
  De-slop marketing, UX, and landing copy: strip the "tells" that make prose read as
  AI-generated (em-dash overuse, "not just X but Y", rule-of-three triads, slop vocabulary
  like seamlessly / robust / elevate / unlock / delve, hedging, and generic openers) and
  tighten it to concrete, human, on-brand writing. Use this whenever polishing or reviewing
  ANY customer-facing prose — landing pages, hero copy, marketing sites, product emails, UX
  microcopy, app-store descriptions, ad copy, social posts — and especially when the user
  says "make this sound human", "less AI", "punchier", "tighter", "this feels generic", or
  "clean up the copy", even if they never say the word "de-slop". Works per-language
  (English, Spanish, and others). It is a quality-and-voice tool, NOT an AI-detector-evasion
  tool.
---

# copy-deslop

Turn draft or AI-generated copy into writing a real person at the company would have written.
The goal is not "different words" — it is prose that is concrete, specific, and in the brand's
own voice, with the machine cadence removed.

## What this is and is not

- **Is:** a quality + voice pass. Remove LLM cadence, name real things, tighten.
- **Is not:** an AI-detector-evasion tool. Do not optimize to fool GPTZero or similar — that
  produces worse copy and is a losing game. Optimize for a human reader, not a classifier.
- **Is not:** a personality injection. Do not add jokes, slang, or a "voice" the brand does
  not have. De-slopping flattens *toward the brand's real register*, not toward yours.
- **Is not:** a length increase. De-slopped copy is almost always shorter.

## Process

1. **Anchor the voice first.** If a brand-voice source exists (e.g. a brand book, an About
   page, a positioning or business doc, the founder's own words), read it before touching anything. Slop is
   generic *because it has no owner* — you are giving the copy back its owner. Without this,
   you risk replacing AI-generic with your-own-generic.
2. **Scan and flag.** Read the copy and list the specific tells you see, with a location for
   each (line, selector, or the quoted phrase). Naming them makes the rewrite honest and lets
   the user veto.
3. **Rewrite tight.** Fix each tell using the moves below. Preserve meaning, the call-to-action,
   and any claims/numbers exactly. Change cadence and concreteness, not facts.
4. **Verify.** Re-read as the reader. Meaning intact? CTA intact? Voice consistent with step 1?
   Shorter or equal length? No new tells introduced? If a sentence still sounds like it could
   sell anything, it is still slop — make it specific to *this* thing.

## The tell checklist (what to kill)

These are the patterns that make copy read as machine-made. You will not see all of them; hunt
for the ones present.

- **Em-dash as a rhythm crutch** — sprinkled to fake sophistication. Keep the occasional real
  one; cut the rest for periods or commas.
- **"Not just X — it's Y" / "not only… but also"** — the signature LLM see-saw. State Y directly.
- **Rule-of-three triads:** "faster, smarter, and more efficient." Pick the one true word.
- **Slop vocabulary:** seamlessly, effortlessly, truly, powerful, robust, elevate, unlock, delve,
  tapestry, testament, game-changer, revolutionize, cutting-edge, leverage, streamline, "solutions",
  "empower", "in today's fast-paced world", "at the end of the day". These are filler that survives
  because it sounds like something. Replace with the concrete thing that is actually happening.
- **Hedging:** "designed to help", "can help you", "might", "aims to". If it does the thing, say it
  does the thing.
- **Over-symmetry:** every sentence the same length, every clause balanced. Real writing has an
  uneven pulse — a long sentence, then three words.
- **Generic openers:** "In a world where…", "Imagine a…", "Picture this." Start with the reader's
  actual situation.
- **Abstraction where a specific belongs:** "streamline your workflow" vs "answer the same booking
  question at 11pm so you don't have to". Nouns and numbers beat adjectives.
- **Over-explaining / wall-of-text:** three sentences doing one sentence's job.
- **Decorative emoji:** emoji standing in for a point instead of making one.

## The moves (what to replace with)

- **Concrete over abstract.** Name the real object, moment, or number. "You get your time back"
  becomes stronger as "8–15 hours a week back" when a number is available.
- **Active voice, second person, plain verbs.** The reader does things; the product does things.
- **Say what happens, not what it "helps you" do.** "helps you manage bookings" → "books the
  appointment and sends the reminder".
- **Vary sentence length for rhythm.** A short sentence lands. Use it after a long one.
- **Specific nouns > adjectives.** "a leafy street in the German Colony" > "a charming location".
- **Keep the brand's real voice.** Match the register from step 1 — warm, blunt, technical,
  whatever it actually is.

## Per-language

De-slop each language *natively* — never machine-translate a fix from another language, because
the tells differ.

- **Spanish tells:** "En el mundo actual", "no solo… sino (que) también", "sin duda", "sin
  esfuerzo", "potente / robusto", "soluciones", "impulsar", "revolucionar", over-formality
  (unneeded usted-register, "le invitamos a"), and an excess of "que" chaining clauses. Prefer
  plain verbs and concrete nouns, same as English.
- For any language, if you are not fluent enough to hear the tells, say so rather than guessing —
  a confident wrong rewrite is worse than flagging it for a native speaker.

## Examples

**Example 1 (EN, hero):**
Before: "Our cutting-edge AI solution seamlessly empowers your business to unlock its full
potential — not just saving time, but revolutionizing the way you work."
After: "It answers WhatsApp for you — bookings, reminders, the same five questions all day.
Most owners get 8–15 hours a week back."

**Example 2 (EN, microcopy):**
Before: "Effortlessly get started on your journey today!"
After: "Message us. We'll send a 2-minute demo."

**Example 3 (ES):**
Before: "En el mundo actual, nuestra potente solución de automatización no solo optimiza tus
procesos, sino que también revoluciona la manera en que gestionas tu negocio."
After: "Contesta tu WhatsApp por ti: agenda citas, manda recordatorios y responde las mismas
preguntas de siempre. Recuperas entre 8 y 15 horas a la semana."

## Verify before you hand it back

- Every claim, price, and number is unchanged.
- The CTA still says the same action.
- Nothing reads like it could sell a different product.
- It is shorter than or equal to the original.
- The voice matches the brand source from step 1, not a generic "confident startup".

## Follow-up: enrich the evals

The `evals/evals.json` here starts with generic before/after prompts. When this skill is run on a
real landing page or marketing asset, harvest 2–3 genuine before/after pairs from that
pass and add them as eval cases — real slop from the wild is the best test material.
