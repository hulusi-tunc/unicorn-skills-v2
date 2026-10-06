---
name: testable
description: Make the app ready for a tester from the first screen, and write the QA pack when it is ready for QA. Test IDs, the seven data scenarios, test accounts, the build number, and the pack a tester starts from the same day.
argument-hint: "[pack, to write the QA pack; nothing, to check readiness]"
---
# /testable

Testers have joined at the last moment and found what nobody built: test plans with no unhappy
paths, permission bugs, screens that broke on longer translated text. Build so a tester can start
the day the product is ready. Read `.designkit/workspace.json` for the app and `"type"`.

## Built in from the first screen (the gate and design-screen hold most of it)

1. **Test IDs.** `node .designkit/scripts/testids.mjs <app>`: every element a user touches has
   `data-testid` (web) or `testID` (React Native), `screen-element` in English, never translated.
   Flutter: `Semantics(identifier:)`; SwiftUI: `.accessibilityIdentifier`. Below 100%: add the
   missing ones, screen by screen, before anything else here.
2. **Seven scenarios** on every screen that shows data (`AGENTS.md` "Data"), reachable by link
   (`?scenario=no-access`) or `EXPO_PUBLIC_API_SCENARIO`, so a tester switches without code.
3. **Test accounts** per role the product has (admin, member, someone without access): names and
   roles in `project/qa/ACCOUNTS.md`, passwords only in the app's `.env.qa` (never committed, never in
   code). What the product itself can create, the tester creates; what only the back end can, the
   dev prepares: say so in `project/DEV.md`.
4. **The build number** visible in the app (settings or footer), so every bug names its build.
5. **Captcha and one-time codes**: staging uses the provider's test keys or a test bypass the dev
   switches on; never production. Not decided yet: a `project/DEV.md` meeting line.

## The QA pack (`/testable pack`, at "ready for QA")

Write `project/qa/PACK.md`, short, for a tester who has never seen the product:
- What it is in two lines, the project type, and which stories are in this round, each with its
  acceptance criteria from the brief or WBS. Test cases come from these and the design, never from
  the code.
- Where to test: the staging URL or preview build (never the Expo dev launcher) and its number.
- `project/qa/ACCOUNTS.md` and where the passwords live.
- The scenario links per screen.
- The test ID list: `node .designkit/scripts/testids.mjs <app> --list > project/qa/testids.md`.
- The real-phone list: passwords, captchas, payments, push, camera, anything a script cannot do.
- Known gaps from `project/reviews/STATUS.md` `## Open`, and the `debt:` list (`/handover`).
On a front-end-only project the pack goes with the handover; on A to Z it opens UAT; at 90% it goes
to the dev and the tester together.

Then `node .designkit/scripts/tools.mjs --suggest ready-for-qa` and offer what it prints.

## Rules for testing, whoever runs it
- Bad cases are in every test plan: empty, error, loading, long data, no access, long text.
- The agent runs only written steps. No bug found by an agent counts until a person reproduces it.
- A fix is checked by re-running that case and every case on the same screen.
- One bug log, each item marked defect or change request; client wishes are not bugs.
- A flow that passed twice becomes a script (e2e or Playwright on web, Maestro or e2e on mobile),
  kept in the app's repo, never on one laptop. No screenshot suites.
- The designer owns the UI check at each demo; the tester owns behaviour.

## Output
One line: ready for QA or not, with test ID coverage and what is missing; or the pack's path.
