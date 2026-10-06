---
name: design-screen
description: Design one screen end to end: layout, type, colour, screen sizes, dark mode, data, states, accessibility, slop gate. Spec here, code in the app.
argument-hint: "[screen description, e.g. 'profile settings']"
---
# /design-screen

Read `project/TASTE.md` and `project/design-system/` first; use tokens only. Read
`.designkit/workspace.json` for the app folder.

## Steps
0. **Screen sizes, then claim it.** `## Screen sizes` missing from `project/PROJECT.md` (a project
   from before it existed): write it there now, as `/setup` step 6 does (the kind, the sizes, a
   one-line why), and say so in one line; this is not optional. Then
   `node .designkit/scripts/team-sync.mjs --claim <Screen>`, per "Working together" in `AGENTS.md`.
   Someone else has it: stop and say so before any design work.
1. **Grid and hierarchy** with `ui-design`.
2. **Type, colour, spacing** from the tokens, with `ui-design`.
3. **Screen sizes and dark mode**: read `## Screen sizes` in `project/PROJECT.md` and design only
   the sizes it lists, with `ui-design`, changing layout only at the breakpoint tokens. A mobile app
   gets no responsive work: Dynamic Type to 200% and safe areas only. Dark mode with `ui-design`.
4. **Data**, following "Data" in `AGENTS.md`: list the calls this screen needs. First screen with
   data: create `src/api/` (`client.ts`, `types.ts`, `mock/index.ts`, `mock/scenario.ts`, `index.ts`
   exporting the client and types). `scenario.ts` reads `NEXT_PUBLIC_API_SCENARIO` or
   `EXPO_PUBLIC_API_SCENARIO`, on web also `?scenario=` in the browser, default `normal`; `error`
   throws, `slow` waits two seconds, `no-access` answers as the server does for a person without the
   right (403 with its message), `long-text` stretches every string about 40%. Add each call to `types.ts` and `client.ts`, its sample data to
   `mock/` with `empty` and `long` versions (`long` with a total in the thousands and long text, so
   paging or a count gets designed), and its lines to `docs/api/contract.md` in the app (the
   call, in, out; then this screen: calls and states). No outside data: skip this step and the data
   states.
5. **Interaction states** with `interaction-design`: pressed, focus, loading, error, empty, success.
   Data states come from the scenarios, never from extra sample data in the screen.
6. **Accessibility pass** with `accessibility`: keyboard, touch targets, contrast, motion, content.
   Fields show focus by their border colour (the focus token, 3:1 against the field and the page);
   buttons and links show a ring for keyboard focus only (`:focus-visible`).
7. **Parts**, following "App structure" in `AGENTS.md`: the screen lives in
   `src/features/<job>/`, the business job it serves; its route file only assembles it. Reuse
   `src/components/DS<Part>`. Missing: web, `npx shadcn@latest add <part> -y -s`, then write
   `src/components/DS<Part>.tsx` by the wrapper rule (`shadcn-ui`); mobile, wrap the React Native
   primitive the same way. The screen never uses a raw `<button>`, `<input>`, `<select>` or
   `<textarea>` (gate `dk-11`). Everything a user touches gets a test ID, `data-testid` on web and
   `testID` in React Native: `screen-element` in English (`checkout-pay-button`), never translated,
   kept through redesigns; parts pass it through (gate `dk-12`).
8. **Build it** in the app with `frontend-design` and the platform skill, following "No comments in
   code" in `AGENTS.md`. Every save goes through the slop gate; fix what it names before moving on.
   Then open the screen in every scenario (web: `?scenario=empty`, `long`, `error`, `slow`,
   `no-access`, `long-text` with the
   Chrome DevTools tools; mobile: `EXPO_PUBLIC_API_SCENARIO`) and fix what breaks, long text and
   thousands of rows included. Web: open it at each width `## Screen sizes` lists (390 phone, 768
   tablet, 1280 laptop, 1920 by 1080 wide), then at 320 wide and with the text at 200%
   (`document.documentElement.style.fontSize = '200%'`): nothing cut off, overlapping or scrolling
   sideways. Load it twice: nothing may move after it appears (a row, a menu item, an image), and an
   animation plays the same on every load unless `DECISIONS.md` says once.
9. **Slop gate** at the end: `node .designkit/scripts/slop-gate.mjs <the screen's files, relative to the
   app>`; fix every block in place. `slop-checker` runs only when the designer asks.

## Output
The spec at `project/screens/<screen-name>.md` in this repo: grid, hierarchy, type, colour, spacing,
screen sizes, dark mode, data (calls and their states), states, inclusive notes, slop result. The code in the app, with no spec or
note inside it. Update `project/DECISIONS.md` if a decision was made, commit through `/commit` (which shares it),
then `node .designkit/scripts/team-sync.mjs --release <Screen>`, then
`node .designkit/scripts/review-due.mjs` as in `/commit` step 5.
