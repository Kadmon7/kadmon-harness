---
name: hebrew-native-copy
description: >-
  Rewrite Hebrew marketing, landing, and UI copy so it reads as native Israeli writing
  instead of machine-translated Hebrew. Fixes the two things that instantly mark Hebrew
  copy as translated: gendered second-person address (the default-masculine אתה trap that
  excludes half your customers) and literal English calques. Produces a native-quality,
  gender-safe, professional-warm draft. Use this whenever writing, reviewing, localizing,
  or polishing ANY customer-facing Hebrew — a landing page, hero copy, a marketing site,
  UI microcopy, a bot or voice persona, ad or WhatsApp copy — and especially when the
  Hebrew was translated from English/Spanish, when someone says the Hebrew "sounds
  translated / stiff / generic / off", when it mixes masculine and plural address
  inconsistently, or when you need Hebrew that works for both male and female readers.
  Trigger even if the user only says "fix the Hebrew" or "make the Hebrew sound native".
  It raises the floor to ~native; it does not replace a final native-speaker glance on
  shipped brand copy.
---

# hebrew-native-copy

Turn translated or draft Hebrew into copy a native Israeli marketer would have written.
The goal is not "different words" — it is Hebrew with the right *address strategy*, no
English cadence underneath, and a consistent, warm, professional register.

## Why generic Hebrew fails (the two tells)

Machine-assisted Hebrew gives itself away in two ways, and they are the first things a
native reader notices:

1. **Gendered second person, defaulted to masculine.** Hebrew has no genderless "you":
   `אתה` (you, m.) and `את` (you, f.) are different words, and verbs/adjectives inflect
   with them. Translation tools default to masculine `אתה`, so the copy silently tells
   every female reader "not written for you." For businesses whose owners are often women
   (salons, clinics, studios), masculine-default copy is not a nuance — it is losing the
   reader. A second failure mode is *inconsistency*: a hero that says `אתה` in one line and
   a plural imperative (`צפו`, `כתבו`) in the next reads as stitched-together, not authored.
2. **English calques.** Word-for-word structure carried over from the source language:
   English word order, "solutions"/"empower"-type abstractions rendered literally, CTAs
   phrased the English way. The words are Hebrew; the skeleton is foreign.

Fixing these two is 80% of what makes Hebrew read native. The rest is register discipline.

## What this is and is not

- **Is:** a native-register + gender-safety pass on Hebrew copy. Choose one address
  strategy, apply it consistently, remove the English skeleton, match the brand's register.
- **Is not:** an AI-detector-evasion tool. Optimize for a native reader, not a classifier.
- **Is not:** a personality injection. Do not add slang the brand does not have. For
  business-owner audiences, slangy Hebrew (`אחלה`, `סבבה`, street register) usually reads
  *less* professional, not more "native" — native and slangy are different axes.
- **Is not:** a substitute for a native editor on final brand copy. See "Honesty contract."

## Process

1. **Anchor the voice.** Read the brand-voice source (a brand book, an About page, the
   English/Spanish copy that already carries the intended tone) before touching anything.
   You are giving the Hebrew the same owner the other languages have.
2. **Pick the address strategy — once — and write it down.** This is the highest-leverage
   decision. Choose the strategy that fits the audience (see `references/hebrew.md` →
   "Address strategy") and state your choice explicitly so the user can veto it. Then apply
   it to *every* string. Consistency is itself a mark of authorship.
3. **Rewrite native.** Fix gender first, then de-calque each line so the Hebrew sentence is
   built the way a Hebrew sentence is built — not the English one translated. Preserve every
   claim, price, number, and the CTA's action exactly. Change cadence and structure, not facts.
4. **Verify against the checklist** (below).
5. **Flag for a native pass.** Mark the result as native-quality DRAFT and tell the user
   plainly that shipped, customer-facing brand copy should still get one native-speaker
   glance for the last 5–10% of nuance you cannot self-verify.

## Language reference

Read the reference for the target language before rewriting. Each file carries the
language-specific gender rules, calque list, register guidance, and typography conventions.

- **Hebrew** → read `references/hebrew.md` (the primary, fully-developed reference).
- Other languages can be added as `references/<language>.md` following the same structure;
  if a reference does not exist for the requested language, say so rather than guessing.

## Verify before you hand it back

- **One address strategy, applied everywhere.** No mix of `אתה` and plural imperatives
  unless that mix is a deliberate, stated choice (e.g. buttons imperative, body impersonal).
- **Gender-safe** for the whole audience — no string silently assumes a male (or female)
  reader unless the audience genuinely is single-gender.
- **No English skeleton.** Read each line and ask: would a Hebrew speaker have built the
  sentence this way, or is this an English sentence wearing Hebrew words?
- **Facts intact.** Every claim, price, number, and CTA action is unchanged.
- **Register matches the brand** from step 1 — warm and professional by default, not stiff
  and not slangy.
- **Numbers, punctuation, and RTL** follow Hebrew convention (see the reference).

## Honesty contract

State this to the user with the result: this pass raises the Hebrew from "obviously
translated" to "reads native to ~85–90% of readers," and it makes the copy gender-safe and
internally consistent — a large, shippable improvement. It does **not** make the author a
native editor. For copy that represents the brand to paying customers, budget one native
Hebrew speaker's read before it ships; that closes the last 5–10% of idiom and nuance that
cannot be self-verified from outside the language. This is the same manual-verify ethos as
the copy-deslop skill: a confident wrong rewrite is worse than an honest flag.
