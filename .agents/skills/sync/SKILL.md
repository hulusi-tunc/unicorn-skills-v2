---
name: sync
description: Bring both repos, the borrowed skills and the app's packages up to date, and show what changed. Run when you come back to a project after time away, not every day.
---
# /sync

Upkeep done in one sitting instead of constantly. Read `.designkit/workspace.json` for the app folder.

In the kit folder itself (`./bin/new-project` exists), only step 2 applies: it refreshes the kit
without a project.

## Steps

1. **Both repos clean?** Run `git status --porcelain --untracked-files=no` in each. If either lists
   anything, stop: name the files and offer `/commit` first, because syncing on top of unsaved work
   hides what the sync changed. Untracked files do not count. Then `node .designkit/scripts/team-sync.mjs --start` (pulls both,
   shares unsent commits, lists what arrived). Then the kit: `git -C <kit> pull --ff-only` (`kit` in
   `.designkit/workspace.json`; a failure is one line, not a stop), then `<kit>/bin/update-project`: it
   brings this project's copy of the kit up to date and never touches a file the project wrote. Relay
   its list; anything it changed is committed in step 6. Then `npm ci --prefix .designkit/scripts --no-audit --no-fund`, so the slop
   gate's pinned parser matches `.designkit/scripts/package-lock.json`. Then `<kit>/bin/install` (`kit`
   in `.designkit/workspace.json`; skip if that folder is gone): checks Node.js and the agent tool.
2. **Borrowed skills** (this folder). Joined project (`"joined": true` in `.designkit/workspace.json`):
   skip this step; skill updates come from the kit. Otherwise `node .designkit/scripts/check-upstream.mjs`, then the same
   report, advice and choice as `/setup` step 1 (Take it, Skip it, Your call), and `--apply` or
   `--skip` for each. Applying updates this project and the kit together.
3. **The gate still works**: `node .designkit/scripts/slop-gate.mjs --self-test`. If it fails, a
   borrowed skill changed under the gate. Stop and report that before anything else.
4. **Packages** (app folder): `npm outdated`. Apply patch and minor updates with `npm update`. List
   major versions for a decision; do not apply them.
5. **Nothing broke** (app folder): `npm run lint`, `npm run dead`, and from this folder
   `node .designkit/scripts/slop-gate.mjs`. Report any new red with the tool that found it.
6. **Commit what changed**, following `/commit`: in this repo `chore(skills): take upstream skill
   changes`, one line per skill taken or skipped in the body; kit files the update changed: `chore(kit): update the design kit`, the update's list in the body; in
   the app `chore(deps): update packages`; `/commit` then shares both. The kit folder is never committed from here.

## Output

One screen: each repo pulled or not · tools current or updated · skills taken and skipped, one line each · packages updated · major
versions waiting for a decision · self-test, lint, knip and gate green or red. If anything is red,
name the first thing to fix.
