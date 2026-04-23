---
name: receiving-code-review
description: Evaluate code review feedback with technical rigor before implementing. Use this skill whenever receiving code review feedback from kody, typescript-reviewer, spektr, external reviewers, GitHub PR comments, or any automated tool; especially when suggestions seem unclear, technically questionable, YAGNI-violating, or conflict with project conventions; when the user says "review fixes", "address PR comments", "the reviewer said", or when tempted to respond with "you're absolutely right!"; and always before implementing ANY review suggestion. The skill blocks performative agreement ("great catch!") and forces verification against the actual codebase — wrong suggestions get technical pushback, not compliance.
---

# Code Review Reception

Code review requires technical evaluation, not emotional performance.

**Core principle:** Verify before implementing. Ask before assuming. Technical correctness over social comfort.

## The Response Pattern

```
WHEN receiving code review feedback:

1. READ: Complete feedback without reacting
2. UNDERSTAND: Restate requirement in own words (or ask)
3. VERIFY: Check against codebase reality
4. EVALUATE: Technically sound for THIS codebase?
5. RESPOND: Technical acknowledgment or reasoned pushback
6. IMPLEMENT: One item at a time, test each
```

## Forbidden Responses

**NEVER:**
- "You're absolutely right!"
- "Great point!" / "Excellent feedback!"
- "Let me implement that now" (before verification)

**INSTEAD:**
- Restate the technical requirement
- Ask clarifying questions
- Push back with technical reasoning if wrong
- Just start working (actions > words)

## Handling Unclear Feedback

```
IF any item is unclear:
  STOP — do not implement anything yet
  ASK for clarification on unclear items

WHY: Items may be related. Partial understanding = wrong implementation.
```

## Source-Specific Handling

### From the User
- Trusted — implement after understanding
- Still ask if scope unclear
- No performative agreement
- Skip to action or technical acknowledgment

### From External Reviewers
```
BEFORE implementing:
  1. Technically correct for THIS codebase?
  2. Breaks existing functionality?
  3. Reason for current implementation?
  4. Works on all platforms? (Windows/Git Bash)
  5. Does reviewer understand full context?

IF suggestion seems wrong:
  Push back with technical reasoning

IF conflicts with user's prior decisions:
  Stop and discuss with user first
```

## YAGNI Check

```
IF reviewer suggests "implementing properly":
  grep codebase for actual usage

  IF unused: "This isn't called anywhere. Remove it (YAGNI)?"
  IF used: Then implement properly
```

## Implementation Order

For multi-item feedback:
1. Clarify anything unclear FIRST
2. Implement in order: blocking issues → simple fixes → complex fixes
3. Test each fix individually
4. Run /chekpoint for regression check

## When to Push Back

Push back when:
- Suggestion breaks existing functionality
- Reviewer lacks full context
- Violates YAGNI (unused feature)
- Technically incorrect for this stack
- Conflicts with user's architectural decisions

**How:** Technical reasoning, specific questions, reference working tests/code.

## Acknowledging Correct Feedback

```
GOOD: "Fixed. [Brief description]"
GOOD: "Good catch — [specific issue]. Fixed in [location]."
GOOD: [Just fix it and show in the code]

BAD: "You're absolutely right!"
BAD: "Thanks for catching that!"
BAD: ANY gratitude expression
```

Actions speak. Just fix it.

## Handling "kody dissent" NOTEs

When `/chekpoint` full tier runs, Phase 2a specialists (typescript-reviewer, python-reviewer, spektr, orakle) emit the authoritative severity. Phase 2b kody then consolidates but cannot downgrade any upstream BLOCK. If kody disagrees with a specialist BLOCK, it preserves the BLOCK and attaches a dissenting NOTE labeled exactly `kody dissent: <rationale>`.

When you encounter a `kody dissent:` NOTE:

1. **Do not treat the dissent as authoritative.** It is a second opinion, not a verdict. The upstream BLOCK still blocks the commit.
2. **Read both findings in full** — the specialist's BLOCK and kody's counter-argument. The disagreement itself is load-bearing information about the diff.
3. **Resolve with the user, not by picking a side.** If the specialist is right → fix the issue. If kody is right → fix the upstream false positive in the specialist's prompt or rule, file that as a separate concern, and only then proceed.
4. **Never silently downgrade.** If you believe the BLOCK is a false positive, fix the triggering condition (refactor the code, adjust the rule, add a justification comment). Do not bypass via `--no-verify` or by editing the review output.

See `.claude/agents/kody.md` → "Upstream BLOCK Preservation" for the authoring rule and `.claude/commands/chekpoint.md` → Phase 3 for the dual-check gate that enforces it mechanically.

## GitHub Thread Replies

Reply in the comment thread, not as top-level PR comment:
```bash
gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies
```

## Integration

**Project commands:**
- /chekpoint — triggers code review that may produce feedback
- /chekpoint — run after implementing review fixes (verify + review + commit)

**Project agents:**
- kody — produces the review feedback this skill helps process
- typescript-reviewer, spektr, orakle, python-reviewer — also produce feedback that runs through this evaluation pattern

## no_context Application

A reviewer's comment is a claim, not a verdict. The `no_context` principle demands evidence: before implementing a suggestion, verify it against the actual codebase — grep for the symbol, read the surrounding code, check whether the condition the reviewer assumes is actually true. External reviewers (especially automated tools) often lack context about Windows-specific constraints, project conventions, or prior architectural decisions. "The reviewer said so" is not evidence; running the code and checking the result is.
