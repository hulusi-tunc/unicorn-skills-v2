---
name: check
description: Review what changed since the last review (bugs, slop, design) and save one report. /check all reviews the whole app, as before handover.
argument-hint: "[all, or paths inside the app relative to it; defaults to what changed since the last review]"
---
# /check

Runs only when the designer asks, says yes to a review reminder, or before handover. Read
`.designkit/workspace.json` for the app folder and `project/reviews/STATUS.md` for the marker.

## Steps

1. **Scope.** No argument: the commit after `Reviewed up to:` in `STATUS.md`; not in the history
   (a sync rewrote it): the last commit before the `Last review` date
   (`git -C <app> rev-list -1 --before=<date>T23:59:59 HEAD`). Nothing changed since
   (`git -C <app> diff --quiet <marker>` and `git -C <app> rev-list --count <marker>..HEAD` is 0):
   say so in one line and stop. `all`, and always before handover: the whole app. Paths: those.
   Joined project (`"joined": true`): leave `project/`, the rules files and every dot folder out of
   the scope.
2. **Reviewers.** Always `bug-hunter` and `slop-checker`. `design-reviewer` when a `.tsx`, `.jsx`,
   `.css`, `.scss` or token file is in scope. `code-reviewer` only for `/check all`, or when the
   designer asked whether the devs will be able to work with it.
3. **Launch them at once** where the tool has sub-agents, each by its name; else read
   `.designkit/agents/<name>.md` and do the reviews one after another yourself. Tell each: it runs under `/check`
   and returns findings without saving; the scope (the marker commit, `all`, or the paths); its
   budget, 8 minutes, or none for `/check all`. For `/check all`, give `slop-checker` and
   `code-reviewer` the strongest model the tool offers. Note the time (`date +%s`).
4. **Wait for all.** Do not summarise partial results.
5. **Merge** into one report. The same `file:line` from two agents is one row. Order: broken, blocks
   handoff, slop blocks, should fix, slop warnings, nice to have. Drop anything already under
   `## Open` or `## Left on purpose` in `STATUS.md`.
6. **Verdict**, one line: `READY` if nothing is broken, nothing blocks handoff and the gate has no
   blocks. Otherwise `NOT READY`, and the three things that would change that.
7. **Status.** Save the report as `project/reviews/check-<YYYY-MM-DD>.md` in this repo, never in the
   app, and delete older `check-*.md` there (git keeps them). In `STATUS.md`: set
   `Last review: <YYYY-MM-DD>, <verdict>, <minutes> min, report: check-<YYYY-MM-DD>.md` and
   `Reviewed up to: <app HEAD, short>`; delete `## Open` lines this review found fixed; add each new
   broken, blocks-handoff, slop-block and should-fix finding as one line,
   `<file:line>  <what> (<agent>, <YYYY-MM-DD>)`, on one line however long. Never reword a line. Then commit `project/reviews/`
   per `/commit`, as `docs(reviews): review up to <short commit>`.

## Output

In the chat: the verdict, the minutes it took, and at most the top five findings in plain language.
The file has the rest.
