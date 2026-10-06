# Joined project

`"joined": true` in `.designkit/workspace.json`: the kit joined code that already existed. One
repository; `app` is `.`. In this project the kit's rules are `.designkit/rules.md`.

- Precedence: dated lines in `project/DECISIONS.md`, then the project's own rules (`AGENTS.md`,
  `CLAUDE.md`), then the kit's rules, then any skill.
- "Two repos", "App structure", "Data" and the main-only rule in "Working together" apply only where
  the project already has that shape. Build new work to fit the project's code map.
- Uploads to GitHub only when the designer says so (`"share": false`, the default): commits stay on
  this Mac; on "share", "push" or "publish", `team-sync.mjs --share --now`.
- Never move, rename or reformat existing code to match the kit. A kit rule or skill that clashes
  mid-work: stop, say it in one line, ask yes or no, record the answer in `DECISIONS.md`, never ask
  again.
- `"devRepo": true` as well: a developer works in this repository. The kit's files and `project/`
  never enter this repository; they stay on this Mac. Asked to share design notes there: say so in
  one line; never force-add a file git ignores.
