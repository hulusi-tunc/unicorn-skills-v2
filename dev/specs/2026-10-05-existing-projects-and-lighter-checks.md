# Existing projects and lighter checks

Agreed with the owner on 2026-10-05. Status: waiting for the owner's review, nothing built yet.

## Why

The owner tried the kit on their portfolio site (`nlanhson/portfolio`, a working Next.js site, one
repository, 24 commits). Two problems:

1. **It refused the project.** `bin/new-project` stops on a folder that is a git repository, holds
   `package.json` or has more than 20 entries. The portfolio's Claude then copied parts of the kit
   by hand over two days (11 skills, 2 agents, the reply style) and turned several kit rules down in
   `DECISIONS.md`: no comments, no spaced capitals, the `src/` layout, the data door, the second
   repository, the safety blocks.
2. **The deep reviews ran too often and too long.** The agents' descriptions ("after a big change",
   "after a screen is designed or built") read as permission to launch them unasked. Each covers
   the whole app, re-runs checks that already passed, and loads many skills first. The portfolio
   measured 20 to 40 minutes a run; eight runs in one day used most of the owner's tokens. Its rules
   for checks changed three times in two days before landing on: fast checks while working, deep
   reviews only when asked, scoped to what changed, never repeating a known finding.

## In short

1. **Checks in levels.** The slop gate on every save (seconds). Quick checks on every commit (about
   a minute). Deep reviews only when asked and once before handover, covering only what changed.
2. **The kit remembers.** It knows where the last review stopped and suggests the next one in one
   yes/no line when enough work has built up.
3. **One small status file** instead of a growing log: what is wrong now, what was left on
   purpose, where the last review stopped.
4. **Joining an existing project.** Same start as a new project; nothing moves; Claude reads the
   project first; the project's own ways win after one confirmation from the owner.
5. **Faster reviews.** Less to read, less repeated, fewer reviewers, a time limit. Target: 5 to 10
   minutes for a normal review, down from 20 to 40.

## 1. Checks in levels

| Level | When | What | Time |
|---|---|---|---|
| Save | Every save Claude makes in the app | Slop gate, as today | Seconds |
| Commit | Every commit in the app, owner's machine only | Slop gate on what is staged, then the quick checks | About a minute |
| Review | When asked, or on a yes to the reminder | `bug-hunter`, `slop-checker`, `design-reviewer` if something visual changed; changes since the last review only | 5 to 10 minutes |
| Handover | Once, before the handover line in `DECISIONS.md`; cannot be skipped | `/check` on the whole app, `code-reviewer` included, careful model | Longer, once |

**Quick checks.** `.claude/scripts/quick-check.mjs`, run by the app's pre-commit hook after the
gate. It runs, in order and stopping at the first failure: typecheck, lint, tests, build. A step is
skipped when the app has no such script. Which steps run is the list `quickCheck` in
`.claude/workspace.json`, written by `/setup` or the join from the app's own `package.json`
scripts (the portfolio would get `lint`, `check:taste`, `build`). At setup or join each step is timed
once; a step slower than 60 seconds (an end-to-end browser suite, say) stays out of the commit check
and runs in reviews instead, recorded in `DECISIONS.md`. A failure stops the commit and Claude fixes
it.

**Record of quick checks.** A commit only exists if its checks passed, so the save history is the
record. The last pass is also written to `.claude/state/last-check.json` (local, ignored by git):
the date, the tree it checked (`git write-tree`, which equals the commit's tree) and each step's
time. Reviews use it to skip work already done. It stays local because a file written during a
commit would leave the repository changed after every commit.

**Agents never start themselves.** Each agent's `description` loses its "use after..." wording and
says it runs only when the owner asks, under `/check`, or at handover. `CLAUDE.md` "Quality" and
`/design-screen` step 9 change to match: the end of a screen runs the save-level gate, not
`slop-checker`, then Claude may suggest a review.

## 2. The reminder

`.claude/scripts/review-due.mjs` compares the app now with the review marker (see section 3) and
prints one line when a review is due, or nothing. Due when any of these holds, counted from the
later of the marker and the last declined reminder:

- 3 or more screens changed. A screen is a folder under `src/features/` or `features/`; without
  those, a route folder under `src/app/` or `app/`.
- 500 or more changed lines of app code (lock files and generated files left out).
- 14 days since the marker, with at least one change.

The line names the reason and an estimate, for example: "Three screens changed since the last
review. Run one now? About 7 minutes." Estimate: 3 minutes plus 2 per changed screen, at most 10.
If `STATUS.md` has 20 or more open problems, the line suggests a fix-up session instead of a
review.

When it runs: at the start of a chat (from the start hook, after `team-sync.mjs --start`), and
after `/commit` and at the end of `/design-screen`. A "no" is written to
`.claude/state/review.json` (local) as the current app commit, so the reminder stays quiet until
enough new work builds up past that point. Claude relays the line as written: one yes/no, never a
menu.

## 3. The status file

`project/reviews/STATUS.md`, committed, in the design folder (in a joined project, the project
itself). Four parts:

```
# Status

Last review: 2026-10-05, NOT READY, 6 min, report: check-2026-10-05.md
Reviewed up to: a1b2c3d

## Open
- features/home/Deck.tsx:120  focus lost after closing the menu (bug-hunter, 2026-10-05)
- dk-05 comments: 41 in 12 files, from before joining (gate; run it to list them)

## Left on purpose
- Spaced capitals in the deck: DECISIONS.md 2026-10-04
```

Rules, so the file never drifts or grows without end:
- Lines are added or deleted, never reworded. A fixed problem's line is deleted.
- Problems the gate can list again are one line per rule with a count, never one per hit.
- After each review: update the two top lines, delete fixed lines, add new ones, skip anything
  already under Open or Left on purpose. Then delete older reports of the same kind
  (`check-`, `bugs-`, `slop-`; `design-` per screen); `project/reviews/conflicts/` is never touched.
  Commit as `docs(reviews): review up to <short commit>`.
- Old versions stay in git history; nothing else keeps them.
- Two teammates changing `STATUS.md` at once: `team-sync.mjs` merges it like `WORKING.md`, keeping
  both sides' Open lines and the later marker.

The marker starts at `/setup` (the first app commit) or at the join (the current commit). The first
review after joining covers changes since joining; a whole-app review runs only when asked.

## 4. Joining an existing project

**Two modes, picked from what is in the folder.** Unchanged for the owner: open Claude in the
project's folder, paste the kit link. `bin/new-project` decides, prints the mode on its first line,
and Claude tells the owner in one line which mode it picked and why. The owner never chooses.
- **Start**: an empty folder, a folder holding only brief files, or an empty git repository (no
  commits yet, as when someone makes an empty repository on GitHub and downloads it). A new project
  is built as today. An empty repository keeps its GitHub link (`origin`), so `/setup` step 9
  creates only the app's repository.
- **Join**: a folder with code (`package.json`) or saved history (a `.git` with commits). The kit
  fits around it, as below.

It still refuses the kit itself, the home folder and the like. Code without git gets a first commit
of things as they are. A working tree with uncommitted changes: it stops and asks Claude to commit
them first, so the kit arrives as one clean commit.

**One repository.** `.claude/workspace.json` gets `"app": "."` and `"joined": true`. Every script
that treats the app and the design folder as two repositories treats them as one when both paths
match (`team-sync.mjs` builds its repository list without duplicates).

**What is added; what is never touched.**
- Added: `.claude/` (agents, commands, skills, scripts, output style, `slop-policy.json`) and
  `project/` with its folders.
- The kit's `CLAUDE.md` is copied to `.claude/design-kit.md`. The project's `CLAUDE.md` gets one
  line, `@.claude/design-kit.md`, or is created with only that line.
- An existing `.claude/settings.json` is merged: the kit's hooks and blocks are added, nothing of
  the project's is removed.
- A file the project already has with the same name (an agent, a skill, `TASTE.md`) is never
  overwritten. Claude lists those in the join message; an agent the project adapted keeps its
  project-specific notes by moving them into the project's `CLAUDE.md` before the kit's version
  replaces it, on the owner's yes.
- Never: moving, renaming or reformatting the project's code; installing tools without a yes.

**Rules for joined projects.** A new section at the top of the kit's `CLAUDE.md`, "Joined
projects", applies when `joined` is true: precedence is the owner's decisions in `DECISIONS.md`,
then the project's own `CLAUDE.md`, then the kit, then any skill. "Two repos", "App structure" and
"Data" apply only where the project already has that shape. Claude builds new work to fit the
project's code map.

**Join steps** (a "Joined project" branch in `.claude/commands/setup.md`):
1. Read the code, `package.json`, `README.md`, any `CLAUDE.md` or `AGENTS.md`, and the git history.
2. Write `PROJECT.md` from what was found; `TASTE.md` from the colours, fonts and spacing already in
   the code; `DECISIONS.md` from the history (an existing one is kept and gets a dated join line). If
   the project's `CLAUDE.md` has no code map, add a short one.
3. Ask, one at a time, only what could not be found.
4. **The clash message**, one message with a recommended answer for each:
   - Code and copy rules (`dk-01` to `dk-07` and the kill-ai-slop patterns): the gate runs over the
     whole app in report mode; a rule with existing hits is listed with its count and "switch off
     here" recommended where the hits look deliberate. Off: added to `skip` in `slop-policy.json`.
     On: new work must follow it; old hits become one Open line in `STATUS.md`.
   - Structure (`dk-08`, `dk-09`, the folder layout, two repositories, the data door): switched off
     without asking where the project lacks the shape; listed for information only.
   - Ways of working: existing branches, pull requests or GitHub checks are followed (`team-sync`
     never switches branch; it shares the current one). The safety blocks are recommended, with one
     line on why; the owner may still decline.
   - Anything `DECISIONS.md` already settles is not asked again.
   Each answer becomes a dated line in `DECISIONS.md`. In a joined project `dk-05` and `dk-07` can
   be switched off like any other rule; in a project the kit started they keep no off switch.
   The upstream skill check (`/setup` step 1, `/sync` step 2) is skipped in joined projects: skill
   updates come from the kit.
5. Commit check: if the project uses husky, append the gate and quick-check lines to
   `.husky/pre-commit`; otherwise write `.git/hooks/pre-commit` (local, adds no package). Set
   `git config designkit.docs .` so the hook finds the gate, and only on this machine. The gate
   runs with `--staged --new-only` (see section 6). Time the quick-check steps; write `quickCheck`.
6. One offer, as a yes/no for the bundle: the extras the kit would add (knip for dead code,
   the accessibility lint plugin). Prettier is never offered: formatting an existing codebase
   rewrites every file.
7. Write `STATUS.md` with the marker at the current commit. Commit as `chore: add the design kit`,
   with the why in the body. Share.

**Public repositories.** Fourteen of the kit's skills cannot be shared publicly. If the
repository is public (`gh repo view --json visibility`; unknown counts as public; no remote counts
as private), the kit's copied files are listed in `.git/info/exclude` and the hooks go in
`.claude/settings.local.json`, so nothing of the kit enters the history. The import line still goes
in `CLAUDE.md`: for anyone without the kit it points at nothing. `project/` is the
owner's own writing and is committed. Claude says this once.

**Found in the portfolio trial (2026-10-05), added to the design.**
- A joined project uploads to GitHub only when the owner says so: `"share": false` in
  `.claude/workspace.json` by default, so `team-sync.mjs` pulls but never pushes on its own;
  `--share --now` uploads when asked; `/setup` asks once whether to upload after every commit. The
  trial's first headless chat pushed the join commit to the real portfolio through the start hook
  (reverted the same day, `0d77683`).
- Tailwind 4 scans every file in the repository for class names, the kit's guides included: the
  portfolio's stylesheet grew from 46 KB to 60 KB. The join adds `@source not "<root>/.claude";` and
  `@source not "<root>/project";` after the imports of the stylesheet that imports Tailwind, as its
  own commit (36 KB on the portfolio, all 45 of its tests green).

- Auto mode refuses Claude editing `permissions` in a settings file ("Self-Modification") and then
  blocks the rest of that chat, read-only commands included. So the kit's safety blocks stay in a
  joined project even where its `DECISIONS.md` declined them; setup records why, and the owner can
  turn one off in `/permissions`. This narrows "the owner may still decline" above.
- Setup installs the project's packages before timing its checks; a fresh clone timed every step
  as failing.

**Clashes found later.** Mid-work, a skill or kit rule that disagrees with the project: Claude
stops, says it in one line, asks yes/no, records it in `DECISIONS.md`, and does not ask again.

**Out of scope.** Apps a dev team owns. They need a mode that proposes changes instead of making
them; the "After handover" rules are the starting point when it is needed.

## 5. Faster reviews

- **Scope.** `/check` with no argument reviews changes since the marker: `git diff <marker>` in the
  app plus uncommitted work, and the files that import a changed file (one level). `/check all`
  reviews the whole app. Handover always uses `all`.
- **No repeat work.** `bug-hunter` reads `.claude/state/last-check.json`. If its tree matches the
  app's current tree, it skips typecheck, lint, tests and build and spends the time on knip, slow
  steps left out of the commit check, and the browser pass. Every reviewer reads `STATUS.md` and
  `project/IDEAS.md` (if present) first and does not report what is already there.
- **Browser pass.** Only pages whose files changed. The five data scenarios only for a page that
  imports from `@/api`. No browser at all when nothing visual changed.
- **Lighter start.** Skills an agent always loads at start, versus read from
  `.claude/skills/<name>/SKILL.md` only when a finding needs one:

  | Agent | Loaded at start | Read when needed | Words at start |
  |---|---|---|---|
  | `design-reviewer` | `inclusive-design`, `motion-sensitivity`, `web-design-guidelines` | `no-slop`, `redesign-existing-projects`, `prototyping-testing`, `accessible-content`, `adaptive-interfaces`, `emil-design-eng` | 15,900 to 3,100 |
  | `slop-checker` | `no-slop`, `kill-ai-slop` | `redesign-existing-projects`, `web-design-guidelines`, `emil-design-eng` | 9,200 to 2,950 |
  | `bug-hunter` | the two React skills | (drops `dev-conventions`: it never commits) | 2,750 to 1,500 |
  | `code-reviewer` | unchanged | | |

- **Reviewers per moment.** A normal review: `bug-hunter`, `slop-checker`, and `design-reviewer`
  when a `.tsx`, `.jsx`, `.css` or token file changed. `code-reviewer` only at handover, or when
  the owner asks whether the devs can work with it.
- **Model.** Normal reviews run every agent on `sonnet` (`slop-checker` moves from `opus`).
  Handover passes `opus` to the Agent call for `slop-checker` and `code-reviewer`.
- **Time limit.** `/check` gives each agent a budget: 8 minutes in a normal review, none at
  handover. The agent notes the time at start (`date +%s`), checks it before each new file or page,
  and at the limit stops and reports what it covered and what it did not. The duration goes in
  `STATUS.md`'s top line.

## 6. Files that change

| File | Change |
|---|---|
| `bin/new-project` | Start or join, picked from the folder and printed first; an empty repository starts and keeps its GitHub link; refusals kept for kit, home, system folders |
| `README.md` "For Claude" | One line: an existing project joins through the same steps |
| `CLAUDE.md` | "Joined projects" section; "Quality" rewritten for the levels and the reminder; agents never start themselves |
| `.claude/commands/setup.md` | "Joined project" branch (section 4); new projects also write `quickCheck` and `STATUS.md`; step 9 creates only the app's repository when this folder already has a GitHub home |
| `.claude/commands/check.md` | Scope from the marker, `all`, reviewer choice, budgets, model at handover, `STATUS.md` update |
| `.claude/commands/commit.md`, `design-screen.md` | Run `review-due.mjs` at the end; step 9 no longer launches `slop-checker` |
| `.claude/agents/*.md` | Descriptions, skills lists, scope, no-repeat, budget (section 5) |
| `.claude/scripts/slop-gate.mjs` | `--new-only` with `--staged`: a hit blocks only if the same rule and line text are not in the file's `HEAD` version, as the save hook already does |
| `.claude/scripts/quick-check.mjs` | New (section 1) |
| `.claude/scripts/review-due.mjs` | New (section 2) |
| `.claude/scripts/team-sync.mjs` | One repository when `app` is `.`; never switches branch in a joined project; `STATUS.md` merge; start hook prints `review-due` |
| `.claude/settings.json` | Start hook also runs `review-due.mjs` |
| `.gitignore` (kit and projects) | `.claude/state/` |
| `dev/NOTES.md` | A "Decisions and why" entry once built |

## 7. Tests

- `dev/tests/gate`: probes for `--staged --new-only` (old hit in a touched file passes; a new hit
  blocks; a moved line does not count as new).
- `dev/tests/install`: join on a folder with git and `package.json`; refusal on uncommitted
  changes; refusals for kit and home kept; a file with the same name is not overwritten; public
  mode puts kit files in `.git/info/exclude`.
- `dev/tests/team`: one-repository mode pulls and pushes once; `STATUS.md` clash keeps both Open
  sets and the later marker.
- New `dev/tests/review`: `review-due.mjs` against a scratch repository: below and at each
  threshold, a decline silences it until new work passes the threshold again, 20 open problems
  switch it to fix-up.
- Live: join a fresh clone of the portfolio headless in auto mode, then a small change and
  `/check`, timed.

## 8. Done when (the portfolio)

Joining a fresh clone of the portfolio:
- succeeds without moving or reformatting any file;
- asks one clash message, and does not re-ask what its `DECISIONS.md` already settles (no comments
  rule, spaced capitals, the safety blocks);
- keeps its adapted `bug-hunter` notes (Brave, the two home page trees) by moving them into its
  `CLAUDE.md`;
- puts `lint`, `check:taste` and `build` in the commit check, and the Playwright suite there only
  if it runs under 60 seconds;
- then a one-file change and `/check` finishes in 10 minutes or less, reports nothing already in
  `IDEAS.md`, and leaves a `STATUS.md` with the marker moved.
