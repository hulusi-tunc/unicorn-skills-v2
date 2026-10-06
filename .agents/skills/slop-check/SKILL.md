---
name: slop-check
description: Just the slop pass, by pattern and then by judgment, over the app or part of it.
argument-hint: "[paths inside the app, relative to it; defaults to the whole app]"
---
# /slop-check

Hand the work to the `slop-checker` reviewer (a sub-agent where the tool has them, else
`.designkit/agents/slop-checker.md` done by you) with the paths the designer named as the target. It runs the gate from
this folder (`node .designkit/scripts/slop-gate.mjs <paths> --json`, paths relative to the app), then a
judgment pass for what a pattern cannot see, then writes one table.

If web code is in scope, it also applies `web-design-guidelines`. If motion is in scope, it uses
`emil-design-eng` together with the Motion part of `accessibility`.

## Output

One row per finding: where (`file:line` relative to the app), pattern, level, fix. Then PASS or FAIL
with the counts. Saved to `project/reviews/slop-<YYYY-MM-DD>-<target>.md` in this repo, never in
the app.
