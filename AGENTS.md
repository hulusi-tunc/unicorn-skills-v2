# Design Kit

Users are designers, not developers. They want the result, not the process. "The agent" is you,
whichever AI tool this is. `/name` is the workflow skill `.agents/skills/<name>/SKILL.md`: the
designer types it (`$name` in Codex) or just asks; open it and follow it.

## Kit or project
- `./bin/new-project` exists: this is the kit, not a project. Never run `/setup` or write project
  files here. A project starts in the designer's own folder: README "For your AI agent". Here
  `/sync` only checks skills upstream. Working on the kit: read `dev/NOTES.md` first.

## Start of every chat
- Where the tool has hooks the kit's checks run by themselves, and the chat opens with "Design kit:
  checks are on". No such line: run `node .designkit/scripts/hook.mjs session-start` now, and
  `node .designkit/scripts/hook.mjs after-edit <file>` after every save in the app; fix what it names.
- `.designkit/workspace.json` has `"joined": true`: read `.designkit/rules/joined.md` now; it
  overrides parts of this file. `project/DECISIONS.md` has a dated handover line: read
  `.designkit/rules/handover.md` now.

## Replies
- The reader is a designer with no technical background. Sentence one is the result; then what
  changed and what it means for them, never how. End with one next step, or nothing.
- Everyday words. No jargon, no em dashes, no hype. Anything long goes in a file under `project/`;
  the reply names it in one line.
- Make routine decisions and say the choice in one line. Ask only about taste or a choice that is
  costly to undo: one question, as a yes or no, the recommended answer first. Never ask them to run
  a command or choose between technical options.
- Full length only when they ask for detail, or something failed or is unsafe.

## Two repos
- This folder (the designer's, named after the project): kit, `project/`, decisions, specs, reviews.
  `<Name>-app` inside it (`app` in `.designkit/workspace.json`): code only, its own repo, ignored by
  this one; the dev team clones only the app, so never put notes, specs or reports in it. Its only
  documents: `README.md` and `docs/api/contract.md`. Run app tools inside it; report app paths
  relative to it.
- A change to both repos is two commits, done only when both land. The app commit body carries the
  why (the dev team sees nothing else); the docs side records the decision in `DECISIONS.md`.

## App structure
- `src/app`: routes only; a page assembles features. `src/features/<job>`: one business job with all
  its screens, parts and hooks (sign in, sign up, forgot and reset password are one `authentication`
  feature, not four). `src/components`: the design system, one small file per part, for parts two
  or more features use; a part one feature uses stays in that feature. `src/components/ui`: the UI
  library as installed (shadcn), the engine under the design system; only files under
  `src/components` import it (gate `dk-08`). `src/tokens`: values only, one file per kind.
  `src/lib`: small helpers.
- A design-system part is `DS<Part>` (`DSButton` in `src/components/DSButton.tsx`) and wraps one
  library part. The native element's props and `ref` pass through, so a label, a submit type or
  focus is never lost; the library's own options never do: the part offers only the variants and
  sizes `TASTE.md` allows (two or three variants, two sizes). A new look is first tried as a colour
  of an existing variant; a new variant is a `DECISIONS.md` line. Colour, size, radius and shadow
  from tokens. Parts made before this rule keep their names.
- Icons from one set, the one the UI library installs (web: `lucide-react`); mobile: one family of
  `@expo/vector-icons`, named in `DECISIONS.md`. Never a second set or a hand-drawn icon.
- Never edit a file in `src/components/ui`: the next `shadcn add` overwrites it. Adjust the look in
  the wrapper or through the library's variables in `globals.css`.
- Mobile: same folders; parts wrap React Native primitives; tokens in `src/tokens/*.ts`.

## Data
- All data goes through `src/api/`: `client.ts` the calls screens make (`getBalances()`), `types.ts`
  what each returns, `mock/` the sample data and scenarios. Screens and features import from
  `@/api` only, never `@/api/mock` (gate `dk-09`), and hold no sample data.
- The mock reads `API_SCENARIO` (`normal`, `empty`, `long`, `error`, `slow`; on web also `?scenario=`).
  A screen that shows data is built and checked in all five; only such screens get the data states.
  `long` means thousands: a total in the thousands and long text, so paging or a count is designed.
- `docs/api/contract.md` in the app, written from `types.ts`: each call, in, out; per screen, its
  calls and states. A call missing from it is a defect.
- Sign-in, permissions and payments are the dev's to decide: screens run on the mock, and how they
  work goes to `project/DEV.md` as a meeting. Never choose a sign-in method, a role model or a
  payment flow.
- Handover: the dev rewrites `client.ts` against the real server and deletes `mock/`; nothing else moves.

## Working together
- Designers never handle git; the agent does, through `.designkit/scripts/team-sync.mjs`, and does
  what it prints. Everyone works on `main` until handover; never create a branch before it.
- Before a screen or feature: `--claim <Screen>`. After every commit: `--share`. Screen done and
  committed: `--release <Screen>`. At the start, tell the designer in one line what others added.
  Mention "no GitHub home" only when they talk about sharing or other people.
- `"share": false` in `.designkit/workspace.json`: commits stay on this Mac until the designer says
  share, push or publish (`--share --now`); `"share": true` only on their yes to uploading after
  every commit.
- Never force-push or rewrite pushed history, never skip the commit check: the command guard and
  the push check refuse both.
- Not on GitHub yet and they want to share: `/setup` step 9. A second designer joins from the
  design folder's link: README "For your AI agent".

## The dev list
- `project/DEV.md` holds, one line each, what the dev must answer and what the dev asked for, across
  chats; never scattered through replies. Sign-in, permissions, payments and anything that needs a
  screen to explain go under `## Meeting`.
- `## To send` goes out as one numbered message when the designer says so: draft it for them to
  paste, then move the lines to `## Sent` with the date. Never one question at a time.
- `## From the dev`: their requests, done before the next new screen.

## No comments in code
- Code files carry no explanatory comment, JSDoc, docstring, TODO, commented-out code or link.
- Allowed only: a section title of four words or fewer (`/* Fees */`); a tool directive with nothing
  after its rule names (`eslint-disable-next-line x`, `@ts-expect-error`, `/** @kept */`,
  `deslop-ignore 04`, `/// <reference />`); a licence header at the top of a file.
- The why goes in the commit body or this repo. The gate enforces it (`dk-05`, `dk-07`); no off switch,
  except in a joined project by the designer's recorded decision.

## Before designing
- Read `project/PROJECT.md`, `project/TASTE.md`, `project/DECISIONS.md`. `PROJECT.md` missing: run `/setup` first.
- `DECISIONS.md` is append-only: reverse a line with a new dated entry naming the reversal cost.
- `TASTE.md` outranks every skill's style advice. Never swap a token, font or asset source because a
  skill names another. Where it is silent: restraint, one accent, quiet surfaces, hierarchy from size
  and space.
- The designer points to a file or folder (a download, the Desktop, a path) as input: move it into
  `project/brief/` and say in one line where it went; read it from there. Read anything new in
  `project/brief/` before designing.

## Slop
- Apply `no-slop` while generating UI, copy or frontend code, not after. Generic AI-default output is
  a defect, same severity as broken.
- Never write: em dash in text (`dk-01`), placeholder copy (`dk-02`), stock placeholder images
  (`dk-03`), explanatory comments (`dk-05`), TODOs (`dk-07`), a raw colour or made-up size in a
  screen or part (`dk-10`), a raw `<button>`, `<input>`, `<select>` or `<textarea>` in a screen
  (`dk-11`), or `kill-ai-slop`'s patterns.
- The kit sets no look. All-caps letter-spaced text (`dk-04`) and a card inside a card (`dk-06`)
  only warn: a project's `TASTE.md` decides, and adds them to `block` in the policy if it wants them.
- The gate (`.designkit/scripts/slop-gate.mjs`) runs after every save in the app (by hook, or by hand
  as above) and before every app commit (staged content only; blocks the commit). A save-time block
  means: fix the named lines in place now, without rewriting the file. Edits are blamed only for
  what they added.
- An intended hit: tell the user, then `deslop-ignore <id>` on the line or an entry in
  `.designkit/slop-policy.json`. Never a quiet workaround. `dk-05`/`dk-07`: delete or cut to a title.
- Gate says it could not run: tell the user, never call the file checked, run `--self-test`.
- Shell writes skip the save check; write app code with the file tools.
- `dk-10` and `dk-11` read screens (files under `app/`, `pages/`, `screens/`, `views/`, `routes/`,
  `features/`, `modules/`) and parts (`components/`). `dk-10` cannot see a bare number in a style
  object (`padding: 13`, `zIndex: 10` in React Native): take those from the token files by hand; the
  design review checks them.

## Platforms
- Name the target before coding; never assume. Web: `vercel-react-best-practices`,
  `web-design-guidelines`, `shadcn-ui`; on Next.js read the app's `node_modules/next/dist/docs/`
  first, it matches the installed version. Mobile (Expo): `vercel-react-native-skills`.
- `## Screen sizes` in `PROJECT.md` names the kind of project and the sizes in scope. Design only
  those: a mobile app gets no responsive work, only larger text and safe areas. Other widths only
  have to keep working (320 wide, text at 200%). Layouts change only at the breakpoint tokens.
- Web fixes do not port to React Native; translate: `box-shadow` to elevation tokens, `100dvh` and
  max-width to SafeArea and flex, GSAP and `scroll-behavior` to Reanimated, hover and focus rings to
  pressed states and accessibility props, Grid and bento to flex. Browser-only rules do not apply.

## Quality
- Levels: the slop gate on every save; quick checks on every app commit (typecheck, lint, tests,
  build); deep reviews only through `/check`, when the designer asks or says yes to the reminder;
  `/check all` once before handover, never skipped.
- Never launch `bug-hunter`, `slop-checker`, `design-reviewer` or `code-reviewer` unasked. After a
  large piece of work: `node .designkit/scripts/review-due.mjs`; relay its line as one yes or no; a no:
  `--decline`. A tool without sub-agents: read `.designkit/agents/<name>.md` and do that review yourself.
- Never build a screenshot or visual test suite, or tooling nobody asked for. Never launch a
  whole-app AI cleanup: cleanup is knip, Prettier and the gate.
- WCAG AA is the floor; keyboard, screen reader and reduced motion from the start. Tokens, not hex;
  no dead code, no `any`.
- `project/reviews/STATUS.md`: one line per item, never wrapped; lines are added or deleted, never reworded.

## Off here
- No Jira or ticket lines. No client approval loop: decide, record in `DECISIONS.md` with reversal
  cost. Keep commits small and single-purpose. Never sign commits as AI. `git add -A`/`--all`/`.`
  are refused: stage by name.
- Figma is read-only: `figma-implement-design-new` reads it into code; never generate, sync or push
  to Figma (the write tools are refused).
- Existing screens: audit with `redesign-existing-projects`, patch in place; never rewrite a working
  screen to satisfy an audit.
- Skills come from the kit; in a project never edit or refresh one by hand (`/sync` does). The
  kit's files in each tool's folder (`.claude/agents`, `.claude/skills`, `.codex/`, `.cursor/`,
  `.gemini/`, `.github/agents`, `.github/hooks`, `.opencode/`) are generated from `.designkit/`:
  never edit them. A project's own files there stay its own.

## Routing
- New project: `/setup`, nothing before `PROJECT.md` exists. Visual direction: `TASTE.md` + `no-slop`.
- New screen: `/design-screen`. Existing screen: see "Off here". Back after time away: `/sync`.
- Motion or polish: `emil-design-eng` with the Motion part of `accessibility`. Accessibility:
  `accessibility`.
- "Does it work", "test", "knip": `bug-hunter`. "Is it clean", "can the devs cope": `code-reviewer`.
- Build then check: colour then colour independence; components then keyboard and touch targets;
  type scale then 200% text scaling.

## Paths
- `project/`: `PROJECT.md`, `TASTE.md`, `DECISIONS.md`, `DEV.md` (the dev list), `design-system/`
  (`/tokenize`), `screens/` (`/design-screen` specs), `reviews/`, `brief/` (inputs).
- `slop-gate.mjs`: no args scans the app; paths relative to the app; `--staged`, `--self-test`.
  Blocking, skipped and excluded ids in `.designkit/slop-policy.json`.
