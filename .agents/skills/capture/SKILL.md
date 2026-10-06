---
name: capture
description: Capture every screen, in its states, themes and sizes, and send it to the Unicorn gallery. "Capture everything" or one screen; web keeps itself up to date on every push.
argument-hint: "[nothing for everything, or the screens to capture]"
---
# /capture

The gallery is where the team, the PM, the client and the dev see the product. The designer never
installs or names anything: the gallery's own tool runs through npx.
`G="npx --yes https://${gallery}/cli/latest.tgz"`, where `gallery` is `"gallery"` in
`.designkit/workspace.json`, else `unicorn-studio-gallery.vercel.app`. The tool not reachable yet:
say so in one line and stop.

## Steps
1. **Linked?** `.gallery.json` in the app. Missing: `$G login` (a browser window asks the designer
   to approve once), then `$G link --create` with the project's name. Never put a token in a file.
2. **Engine.** `node .designkit/scripts/tools.mjs --suggest capture`; on yes the e2e tool is pulled.
   Without it: Playwright on web, the gallery's own capture on mobile.
3. **What.** Default set per screen: the normal state at every width `## Screen sizes` lists, in
   light and dark; every other data scenario once, at the widest width, light. Nothing more unless
   the designer asks for the full set. Screens come from the routes and the flows the project
   already has; each needs its test IDs (`/testable`).
4. **Capture** into `<app>/.capture/` (git-ignored), one file per screen named
   `<platform>/<flow>/<screen>@<state>.<theme>.<width>.png`, e.g.
   `web/checkout/payment@error.dark.390.png`. Signed-in screens: sign in once in a setup step, never
   inside the capture itself. With e2e: run with its telemetry off (`tools.lock.json`) and write a
   manifest that maps each screenshot to its key, since e2e names files its own way.
5. **Send.** `$G upload .capture` (with `--manifest` from step 4 when e2e ran). One screen or a
   few: `--partial`, so the rest of the gallery stays as it is. It sends the commit and its message.
6. **On every push (web).** Offer once: a CI step that runs steps 3 to 5 against the preview after
   each push to the branch in `.gallery.json`, with the project's gallery token as a repository
   secret. Mobile stays on this Mac (a simulator is needed).

## Output
The gallery link and its line: added, updated, unchanged, removed.
