---
description: Save progress — run verification then commit and push
agent: code-reviewer
skills: [verification-loop, coding-standards]
---

## Purpose
Safe commit workflow: verify first, then commit with conventional commit message.

## Steps
1. Run /verify (typecheck + tests + lint)
2. If any check fails: STOP — do not commit
3. If all pass: `git add -A`
4. Ask user for commit description
5. Format as conventional commit: `feat|fix|docs|chore: description`
6. `git commit -m "type: description"`
7. `git push`

## Output
Verification results + commit hash + push confirmation.

## Example
```
Verify: PASS (63 tests, 0 errors)
Commit: feat: add instinct export functionality
Hash:   abc1234
Pushed: origin/main
```