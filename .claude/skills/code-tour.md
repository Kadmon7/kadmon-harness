---
name: code-tour
description: Create CodeTour `.tour` files — persona-targeted, step-by-step walkthroughs of a codebase with verified file and line anchors, written in the Microsoft CodeTour JSON format. Use this skill whenever the user asks for a code tour, onboarding tour, architecture walkthrough, PR tour, RCA tour, or security review tour, says "explain how X works" and wants a reusable guided artifact, or wants to create a ramp-up path for a new engineer or reviewer. Produces a coherent narrative anchored to real files; never generates ad-hoc Markdown notes when a tour artifact is what was asked for. Do NOT use for one-off chat explanations, prose docs editing, the implementation work itself, or broad codebase onboarding without a tour artifact (use `codebase-onboarding` for that).
---

# Code Tour

Create CodeTour `.tour` files for codebase walkthroughs that open directly to real files and line ranges. Tours live in `.tours/` and use the Microsoft CodeTour JSON format, not ad hoc Markdown notes.

A good tour is a narrative written for a **specific reader**:

- what they are looking at
- why it matters
- what path they should follow next

This skill only creates `.tour` JSON files. It does not modify source code.

## When to Use

- The user asks for a code tour, onboarding tour, architecture walkthrough, or PR tour
- The user says "explain how X works" and wants a reusable guided artifact
- The user wants a ramp-up path for a new engineer or reviewer
- The task is better served by a guided sequence than a flat summary

Examples:

- Onboarding a new maintainer
- Architecture tour for one service or package
- PR-review walkthrough anchored to changed files
- RCA tour showing the failure path
- Security review tour of trust boundaries and key checks

## When NOT to Use

| Instead of code-tour | Use |
|---|---|
| A one-off explanation in chat is enough | Just answer directly |
| The user wants prose docs, not a `.tour` artifact | `documentation-lookup` or repo docs editing |
| The task is implementation or refactoring | Just do the implementation work |
| Broad codebase onboarding without a tour artifact | `codebase-onboarding` |

## Workflow

### 1. Discover

Explore the repo before writing any steps:

- README and package/app entry points
- Folder structure
- Relevant config files
- Changed files if the tour is PR-focused

Do **not** start writing steps before you understand the shape of the code.

### 2. Infer the reader

Decide the persona and depth from the request:

| Request shape | Persona | Suggested depth |
|---|---|---|
| "onboarding", "new joiner" | `new-joiner` | 9-13 steps |
| "quick tour", "vibe check" | `vibecoder` | 5-8 steps |
| "architecture" | `architect` | 14-18 steps |
| "tour this PR" | `pr-reviewer` | 7-11 steps |
| "why did this break" | `rca-investigator` | 7-11 steps |
| "security review" | `security-reviewer` | 7-11 steps |
| "explain how this feature works" | `feature-explainer` | 7-11 steps |
| "debug this path" | `bug-fixer` | 7-11 steps |

### 3. Read and verify anchors

Every file path and line number must be real:

- Confirm the file exists
- Confirm the line numbers are in range
- If using a selection, verify the exact block
- If the file is volatile, prefer a pattern-based anchor

**Never guess line numbers.** A wrong anchor breaks the entire tour.

### 4. Write the `.tour`

Save to:

```
.tours/<persona>-<focus>.tour
```

Keep the path deterministic and readable.

### 5. Validate

Before declaring the tour finished:

- Every referenced path exists
- Every line or selection is valid
- The first step is anchored to a real file or directory (not a content-only step)
- The tour tells a coherent story rather than listing files

## Step Types

### Content (use sparingly)

Usually only for a closing step:

```json
{ "title": "Next Steps", "description": "You can now trace the request path end to end." }
```

The first step must **not** be content-only.

### Directory (use to orient)

```json
{ "directory": "src/services", "title": "Service Layer", "description": "Core orchestration logic lives here." }
```

### File + line (default)

```json
{ "file": "src/auth/middleware.ts", "line": 42, "title": "Auth Gate", "description": "Every protected request passes here first." }
```

### Selection (one block matters more than the file)

```json
{
  "file": "src/core/pipeline.ts",
  "selection": {
    "start": { "line": 15, "character": 0 },
    "end": { "line": 34, "character": 0 }
  },
  "title": "Request Pipeline",
  "description": "This block wires validation, auth, and downstream execution."
}
```

### Pattern (use when exact lines may drift)

```json
{ "file": "src/app.ts", "pattern": "export default class App", "title": "Application Entry" }
```

### URI (PRs, issues, external docs)

```json
{ "uri": "https://github.com/org/repo/pull/456", "title": "The PR" }
```

## Writing Rule — SMIG

Each description should answer:

- **Situation** — what the reader is looking at
- **Mechanism** — how it works
- **Implication** — why it matters for this persona
- **Gotcha** — what a smart reader might miss

Keep descriptions compact, specific, and grounded in the actual code.

## Narrative Shape

Use this arc unless the task clearly needs something different:

1. Orientation
2. Module map
3. Core execution path
4. Edge case or gotcha
5. Closing / next move

The tour should feel like a path, not an inventory.

## Example

```json
{
  "$schema": "https://aka.ms/codetour-schema",
  "title": "API Service Tour",
  "description": "Walkthrough of the request path for the payments service.",
  "ref": "main",
  "steps": [
    {
      "directory": "src",
      "title": "Source Root",
      "description": "All runtime code for the service starts here."
    },
    {
      "file": "src/server.ts",
      "line": 12,
      "title": "Entry Point",
      "description": "The server boots here and wires middleware before any route is reached."
    },
    {
      "file": "src/routes/payments.ts",
      "line": 8,
      "title": "Payment Routes",
      "description": "Every payments request enters through this router before hitting service logic."
    },
    {
      "title": "Next Steps",
      "description": "You can now follow any payment request end to end with the main anchors in place."
    }
  ]
}
```

## Anti-Patterns

| Anti-pattern | Fix |
|---|---|
| Flat file listing | Tell a story with dependency between steps |
| Generic descriptions | Name the concrete code path or pattern |
| Guessed anchors | Verify every file and line first |
| Too many steps for a quick tour | Cut aggressively |
| First step is content-only | Anchor the first step to a real file or directory |
| Persona mismatch | Write for the actual reader, not a generic engineer |

## Best Practices

- Keep step count proportional to repo size and persona depth
- Use directory steps for orientation, file steps for substance
- For PR tours, cover changed files first
- For monorepos, scope to the relevant packages instead of touring everything
- Close with what the reader can now do, not a recap

## Integration

- **doks agent** (opus) — primary owner. doks owns documentation sync; this skill is the narrative-walkthrough format doks reaches for when the user needs a guided tour, not a flat docs page.
- **codebase-onboarding skill** — sibling. `codebase-onboarding` produces a structural map (architecture, conventions, CLAUDE.md); `code-tour` produces a guided narrative through that structure. Use `codebase-onboarding` first to understand the shape, then `code-tour` to walk a reader through it.
- **docs-sync skill** — complementary. `docs-sync` keeps existing docs aligned with code; `code-tour` creates new tour artifacts that sit alongside docs.
- **/doks command** — entry point. doks can be asked to "make a tour of X" and load this skill.
- **External format** — Microsoft [CodeTour](https://github.com/microsoft/codetour) extension for VS Code is the canonical reader. The `.tour` files are valid JSON that the extension consumes.

## no_context Application

Every anchor in a tour is a claim about the current state of the code. Before writing `"file": "src/server.ts", "line": 12`, you must have read that file and verified the line. A tour with phantom anchors is worse than no tour — it teaches the reader the wrong mental model and breaks trust the moment they click. The `no_context` principle here is unusually strict: every file and line must be reproducible by the next reader, and patterns (not raw line numbers) should be used in any file that's likely to drift.
