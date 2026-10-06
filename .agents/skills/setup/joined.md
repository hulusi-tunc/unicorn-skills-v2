# /setup, joined project

For `"joined": true`: the code already existed and stays as it is. A bare step number is this file's;
`SKILL.md` step N is the main file's. The app is this folder; there is
one repository. Never move, rename or reformat its files. Skip the upstream skill check.

1. **Read first.** `package.json`, `README.md`, the project's own `AGENTS.md` and `CLAUDE.md`, the
   folder tree (three levels, no `node_modules`), the colour, type and spacing values in its styles,
   and `git log -n 200 --format='%ad %s' --date=short`. `new-project` named any files it kept instead of the
   kit's.
2. **Write.** `project/PROJECT.md` as in `SKILL.md` step 6, with `## Repos`: one repository, the project's own.
   `## Screen sizes` from the code: React Native or Expo is a mobile app; on the web, the widths
   its styles already change at (`sm:` to `2xl:`, `@media`) are the sizes in scope.
   Then `node .designkit/scripts/skills-for.mjs <web|mobile|both>` for the platform found.
   `project/TASTE.md` from what the code already does: each `## Do` rule cites the file it comes
   from; `## Never` from what the code avoids. `project/DECISIONS.md`: keep an existing one; else
   start it from the history, one line per real choice with its reversal cost. Then today's line:
   the design kit joined the existing code, nothing moved (reversal: low, remove
   `.designkit/`, `.agents/`, the kit's files in each tool's folder, and the kit's line in `CLAUDE.md`
   and `AGENTS.md`). `new-project` added `@source not` lines to the
   stylesheet: one more line, why (the kit's guides stay out of the site's CSS). It said it could not
   save them: add them after the stylesheet's imports and commit them in step 8. The project's
   rules file (`AGENTS.md`, else `CLAUDE.md`) has no code map: add `## Code map`, one line per top
   folder.
3. **Ask** only what step 1 could not answer, in one round, as in `SKILL.md` step 3.
4. **Clashes, in one message**, then one question (several answers allowed: the rules to keep on;
   the recommendations preselected as the first option's wording). Skip anything `DECISIONS.md`
   already settles.
   - `node .designkit/scripts/slop-gate.mjs --json --no-fail`; count hits per id. For each id with hits:
     what it means in plain words, the count, and the advice: "switch off here" when the hits look
     deliberate (across the site's look, or a `DECISIONS.md` line), else "keep". Off: add the id to
     `skip` in `.designkit/slop-policy.json`. Kept with old hits: one `## Open` line in step 7.
   - No `src/components/ui`: add `dk-08` to `skip`. No `src/api`: add `dk-09`. Say so in one line;
     no question. The kit's folder layout, data door and two repositories do not apply; say so once.
   - The kit's refusals (`git add -A`, `--no-verify`, force-push, Figma writes) stay; never edit
     `permissions` in a tool's settings file (a tool can refuse an agent loosening its own rules,
     then block the rest of the chat). Say in one line they stop a slip from erasing shared
     work. `DECISIONS.md` declined them before: add a dated line that they now stay, because the
     commit checks rely on them; reversal: the designer turns one off in the tool's own permission settings.
   - Branches other than `main` on the remote (`git branch -r`), or a pull request template: the kit
     follows the project's branches; say so once.
   - Uploading: the project has a GitHub home. Ask whether to upload after every commit (say if a
     push publishes the live site); recommend no for one person, yes for a team. Yes: `"share": true`
     in `.designkit/workspace.json`. Until then commits stay here and go up only when asked.
   Record each answer as a dated line in `DECISIONS.md`.
5. **Kept files.** An agent or skill the project adapted (step 1): if it holds project notes (a
   browser, a test setup, a page that renders twice), propose moving those notes into the project's
   rules file and replacing the file with the kit's; do it on a yes.
6. **Commit check.** No `node_modules`: `npm ci` first (`npm install` without a lock file), else
   every step times as failing. Then `node .designkit/scripts/quick-check.mjs --time <the project's own check scripts,
   such as check:taste; never one that needs the network>`. Steps that passed in 60 seconds or less
   become `quickCheck` in `.designkit/workspace.json`. Slower: a `DECISIONS.md` line (runs in reviews).
   Failing on existing code: left out, one `## Open` line ("lint fails on existing code"). Then the
   hook, never replacing one the project has: `.husky/` exists, append to `.husky/pre-commit`; another
   `git config core.hooksPath`, append to `pre-commit` there; a hook manager (`lefthook.yml`,
   `.pre-commit-config.yaml`, `simple-git-hooks` in `package.json`), ask first and add the lines
   through it; else append to `.git/hooks/pre-commit`, creating it with `#!/bin/sh` and `chmod +x`
   when missing. The lines:
   ```
   d=$(git config --get designkit.docs) || exit 0
   [ -f "$d/.designkit/scripts/slop-gate.mjs" ] || { echo "slop gate: not found at $d" >&2; exit 1; }
   node "$d/.designkit/scripts/slop-gate.mjs" --staged --new-only || exit 1
   node "$d/.designkit/scripts/quick-check.mjs"
   ```
   The same way, never replacing a hook the project has: `commit-msg` gets
   `d=$(git config --get designkit.docs) || exit 0` and
   `node "$d/.designkit/scripts/commit-msg.mjs" "$1"`; `pre-push` gets the same first line and
   `node "$d/.designkit/scripts/pre-push.mjs" "$@" || exit 1`.
   One offer, one yes or no for both: knip (as in `bug-hunter` "No knip") and, on web without it,
   `eslint-plugin-jsx-a11y` (as in `build.md` `### Lint`). Never Prettier: it would rewrite every file.
7. **Status.** `project/reviews/STATUS.md` as in `SKILL.md` step 8, marker at the current `HEAD`, with the
   `## Open` lines from steps 4 and 6.
8. **Commit and share**, per `/commit`, by name: `docs: write down <Name> for the design kit`
   (`project/`, the project's `CLAUDE.md` and `AGENTS.md`, `.designkit/slop-policy.json`,
   `.designkit/workspace.json`, the tool settings the kit changed); if the hook went into `.husky/`, `chore: run the design kit's checks
   before each commit`, with the why. Public (`"visibility": "public"`): commit only `project/` and
   the project's own files. A repo a dev works in (`"devRepo": true`): commit only the project's own
   files; `project/` stays on this Mac. Then `node .designkit/scripts/team-sync.mjs --share`.
9. **Next**, in a few lines: what the kit now knows, what it switched off, that reviews run when
   asked and the reminder suggests them. A first whole-site review only if the designer wants a
   starting point.
