---
name: commit
description: Turn the working tree into small, single-purpose commits, per repo, each saying what and why. Stages files by name, never signed by AI.
argument-hint: "[optional: which repo, docs or app]"
---
# /commit

Two repos, so this runs per repo. Read `.designkit/workspace.json` for the app folder.

## Rules

- Stage named paths only; the command guard refuses `git add -A`, `--all` and `.`. Many new files:
  `git ls-files --others --exclude-standard` lists them; read the list, then add them by name.
- No AI signature: no AI co-author line, no "generated with" line, no session link; the commit
  message check removes them.
- The app's commit hook runs the slop gate on exactly what is staged, then the quick checks
  (typecheck, lint, tests, build), and refuses the commit if either fails: fix what it names,
  `git add` the fixed files again, commit again. Never `--no-verify`.
- After handover: `.designkit/rules/handover.md` (a branch, never `main`).

## Steps

1. **Survey both repos**: `git status` and `git diff` in each. Work that touches both is two
   commits, one per repo, and is not done until both are in.
2. **Group into single-purpose commits.** The test: each commit can be reverted on its own. Flag
   anything accidental (a `.env`, a key, a build artifact, a `console.log`) and leave it unstaged
   unless the user confirms.
3. **Per commit**: read each file's `git diff`, then stage it by name (not `git add -p`: it is
   interactive). A file with two changes joins the commit it mostly serves; split it (its hunks as a
   patch, `git apply --cached`) only when the other must revert alone. Then write:
   ```
   type(scope): what changed, imperative

   why this change was needed, in one to three sentences
   ```
   `feat / fix / refactor / chore / docs`. In the app, the body is the only place the reason
   survives, because the code carries no comments. Write it for the developer who reads
   `git log` next year.
4. **Check** before committing: right type, readable subject, a body that gives the reason, no
   signature.
5. **Commit**, with a 10-minute timeout on the Bash call: the app's commit check builds the app.
   `main` is fine. Then `node .designkit/scripts/team-sync.mjs --share`: it pulls what others pushed,
   settles overlaps, and pushes both repos (without a GitHub home it only says so; a joined project
   with `"share": false` keeps commits here: add `--now` only when the designer asked). Relay what
   arrived in one line; an overlap: follow "Working together" in `AGENTS.md`. Then
   `node .designkit/scripts/review-due.mjs`: a line printed, ask it as one yes or no; a no:
   `node .designkit/scripts/review-due.mjs --decline`; a yes: `/check`.

## Output

The commits made, one line each, per repo, whether they reached GitHub, and what was left
unstaged and why. If a decision was
part of this work, remind the user to record it in `project/DECISIONS.md`.
