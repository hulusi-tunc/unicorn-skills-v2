---
name: capture
description: Capture every screen, in its states, themes and sizes, and send it to the Unicorn gallery. "Capture everything" or one screen; web keeps itself up to date on every push.
argument-hint: "[nothing for everything, or the screens to capture]"
---
# /capture

The gallery is where the team, the PM, the client and the dev see the product. The designer never
installs or names anything: the gallery's own tool runs through npx.
`G="npx --yes https://${gallery}/cli/gallery-<version>.tgz"`, where `gallery` is `"gallery"` in
`.designkit/workspace.json`, else `unicorn-studio-gallery.vercel.app`, and `<version>` comes from
`https://${gallery}/cli/latest.json` (`{ version, file }`). Never `latest.tgz`: npx keeps the first
copy it fetched under that name forever. Exit codes: 2 the capture or
manifest is wrong (it prints every issue), 3 not signed in or not on the project.

## Steps
1. **Linked?** `.gallery.json` in the app. Missing: `$G login` (a browser window asks the designer
   to approve once), then `$G link --create` with the project's name. Never put a token in a file.
2. **Engine.** Web: Playwright, already in the app's dev tools, with `reducedMotion: 'reduce'`,
   `colorScheme` set to the theme, `fullPage: true` and `animations: 'disabled'`: two runs of an
   animated page then give identical files, so the gallery shows only real changes.
   iOS: Apple's own tools on a simulator made for this capture and deleted after (`xcrun simctl
   create <name>`; never a simulator another session booted). Pin the status bar (`simctl
   status_bar <udid> override --time 9:41 --batteryState charged --batteryLevel 100`), turn on Reduce
   Motion (`simctl spawn <udid> defaults write com.apple.Accessibility ReduceMotionEnabled -bool true`),
   set the theme with `simctl ui <udid> appearance`, open each screen with the app's launch arguments
   (`simctl launch --terminate-running-process`), then `simctl io <udid> screenshot`. Use a current
   Debug build: launch arguments usually work only there. With all of this, 12 of 12 screens matched
   between two runs. Check that the pictures are distinct screens before sending.
   e2e (`tools.mjs --suggest capture`) only for a flow that needs taps: its screenshot can wait
   forever on a screen that never stops moving, and its theme switch fails when several simulators
   are booted. Android: `adb`, the same steps, not tried yet.
3. **What.** Default set per screen: the normal state at every width `## Screen sizes` lists, in
   light and dark; every other data scenario once, at the widest width, light. Nothing more unless
   the designer asks for the full set. Screens come from the routes and the flows the project
   already has; each needs its test IDs (`/testable`).
4. **Capture** into `<app>/.capture/` (git-ignored), one file per screen named
   `<platform>/<flow>/<screen>@<state>.<theme>.<width>.png`, e.g.
   `web/checkout/payment@error.dark.390.png`. Signed-in screens: sign in once in a setup step, never
   inside the capture itself. With e2e on mobile: name each test by its frame key, run with its
   telemetry off (`tools.lock.json`), then `node .designkit/scripts/e2e-manifest.mjs .e2e/report.json
   ios` writes the gallery manifest from the report; failed tests and screens without a picture are
   listed, never sent. Before sending, drop pictures that are byte copies of another screen: a
   screen that falls back to another (missing state, a stale launch argument) is not a real screen.
   Reset the app's data before each screen, or a screen shows progress left by the one before.
5. **Send.** `$G upload .capture --json` (with `--manifest` from step 4 when e2e ran; a dry run
   first with `--dry-run` says how many pictures and how many distinct). One screen or a
   few: `--partial`, so the rest of the gallery stays as it is. It sends the commit and its message.
6. **On every push (web).** Offer once: `$G ci init --with-capture` writes the GitHub workflow (or
   `--gitlab`), a Playwright capture script and its settings; `$G ci token` gives the token to store
   as the `GALLERY_TOKEN` repository secret. It captures the preview after each push to the branch
   in `.gallery.json`, and uploads nothing if a screen failed, since a missing screen would read as
   removed. Mobile stays on this Mac (a simulator is needed).

## Output
The gallery link and one line from the upload's per-screen counts, never the per-variant ones:
"3 screens updated, 1 added, 40 unchanged".
