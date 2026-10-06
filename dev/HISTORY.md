# The kit's history: what was decided, why, and the proof

The dated decision log, moved out of `dev/NOTES.md` on 2026-10-06 so a session on the kit reads the
current state first and comes here only for the area it touches. Entries are in the order they were
made; older ones keep the paths of their day (`.claude/scripts` became `.designkit/scripts` on
2026-10-05). Add a new entry at the end, dated, in the same session that settles it.

**Origin.** Trimmed from the company tool `hulusi-tunc/unicorn-skills` (29 skills). Kept 14. Dropped
the Figma write skills (the owner only reads Figma), `design-research`, `designer-toolkit`,
`design-ops`, `accessibility-process` (agency process, no clients or teams here) and the Slack-fed
`taste` system. Its useful output, a written taste profile, became `project/TASTE.md` per project.

**Borrowed skills.** Nine come from maintained repos, installed with the `skills` CLI
(`vercel-labs/skills`) and listed in `skills-lock.json`: Anthropic's `frontend-design`, three
Vercel skills, four from `Leonxlnx/taste-skill`, and `yetone/kill-ai-slop`.

**Two repos per project.** Keeps the dev team's clone free of design prose. A change touching both
is two commits. The app commit body carries the why, because the code carries no comments.
Until 2026-09-29 they were siblings (`<Name>-docs`, `<Name>-app`) and Claude had to be opened in
`<Name>-docs`. The owner's real workflow is a designer making a folder named after the project,
opening Claude in it and pasting this repo's link, so that folder became the docs repo with the app
inside: the designer always opens the folder they made, and no `additionalDirectories` is needed.
Inside the docs folder `git -C <app> rev-parse` finds the docs repo when the app has no `.git` yet,
so "is the app a repo" is tested with `<app>/.git`. No real project used the old layout.

**No comments in code.** A comment may only be a title of four words or fewer, a bare tool
directive, or a license header at the top of a file. Enforced by the gate as `dk-05` and `dk-07`,
with no off switch.

**The slop gate** (`.claude/scripts/slop-gate.mjs`). `kill-ai-slop`'s 35 patterns plus house rules
in `slop-rules.mjs` (`dk-01` em dash in text, `dk-02` placeholder copy, `dk-03` stock placeholder
images, `dk-04` all-caps spaced text, `dk-06` card inside a card) and two checks in the gate itself
(`dk-05` comments, `dk-07` TODO). `slop-policy.json` sets what blocks.
- Comments and page structure are read with TypeScript's parser, pinned to TypeScript 6 in
  `.claude/scripts/package.json`. TypeScript 7 (September 2026) has a different programming
  interface, so the gate never uses an app's own TypeScript unless it is usable. Without a usable
  parser it falls back to simpler checks instead of failing.
- Runs three ways: after every save Claude makes in the app (PostToolUse hook; it can only report,
  so "block" means "fix now"), before every commit in the app (husky, staged files only, reading
  what is staged, not the disk), and on demand (`/check`, `/slop-check`).
- On an edit it blames only lines the edit added; on a rewrite of a tracked file, only new problems.
- If it cannot run, it says so loudly rather than passing silently.
- The commit hook finds the docs repo through local git config `designkit.docs`, never a tracked
  file, so the dev team's clone commits normally.

**Upstream updates** (`.claude/scripts/check-upstream.mjs`, `.claude/upstream.json`). The 9
borrowed skills are watched; nothing else upstream is. `/setup` runs the check first; Claude reports
each change with advice (take it, skip it, your call) and the owner chooses. A taken change
refreshes the skill in the project and the kit with the `skills` CLI. Skipped changes stay quiet
until they change again. An earlier `bin/update-kit` refreshed blindly and was removed for that
reason.

**The kit's own 14 skills** (2026-09-30). `hulusi-tunc/unicorn-skills` went private or was removed
on 2026-09-29 (its page and API answer "not found"; the owner's account shows no public repos). The
14 skills taken from it are now the kit's own: edit them by hand, in the kit, and they reach
projects through new projects and `/sync`. Until then they were watched and three-way merged with
the kit's edits kept (`dev-conventions`: STATE.md renamed to DECISIONS.md; `figma-implement-design-new`:
its `name` line); that code and the `--resolved` step were removed with the watch, and are in git
history before this date. Their last upstream version was `567ee34` (2026-08-05, "Merge pull
request #5 from hulusi-tunc/feat/dev-conventions").

**`/setup`.** Asks until five things are known (what and for whom, platform, two looks they like,
one look to avoid, first screen), writes `PROJECT.md`, `TASTE.md`, `DECISIONS.md`, scaffolds the
app non-interactively, installs the tooling, proves it green, commits both repos. Stops before
`/tokenize` so the owner can read TASTE.md first. Hard-won details, each tested end to end:
- App generators reject capital letters and prompt for choices, so it scaffolds into a lowercase
  temporary folder with every choice on the command line, then copies it in.
- `--no-agents-md` on both generators and `agentRules: false` in `next.config.ts` keep `AGENTS.md`
  and `CLAUDE.md` out of the code-only app. The docs `CLAUDE.md` points Claude at the app's
  version-matched Next docs instead.
- Expo's blank template has no linter (installed separately), needs `expo-system-ui`, and knip
  must ignore `expo-updates`. No React Native accessibility lint plugin works on ESLint 9 yet.
- `npx husky` (not `husky init`, which overwrites the hook); lint-staged config in its own file.

**Settings** (`.claude/settings.json`). Commit attribution off, Figma write tools denied,
`git add -A`, `--all` and `.` denied. Verified in a live session.

**Reply style** (`.claude/output-styles/designer.md`, set by `outputStyle` in settings, so every
project gets it). AI replies were too long for designers: method, hypotheses, menus of options,
several questions. The style makes Claude lead with the result, end with one next step, make
routine decisions itself, ask at most one question framed as a yes or no, and put long material in
files. It keeps Claude Code's coding instructions (`keep-coding-instructions: true`). Measured on
the same two questions in a test project: 258 and 378 words with the default style, 85 and 54 to
115 with this one, same substance. Styles do not reach subagents; the agents' own report rules
cover them.

**Token diet.** Kit files are for the AI, not people; no human reads the repo. `CLAUDE.md` loads on
every turn, so it was rewritten as terse imperative rules: 3,353 to 1,614 tokens, every rule kept
(checked by keyword), and four live sessions confirmed behaviour (no comments in app code, specs go
to docs not app, Figma writes refused, `/setup` refused inside the kit). The owner asked not to
squeeze too hard: short, not cryptic, and keep a few words of why where a rule is not obvious.
Then `/setup` (2,783 to 2,002 tokens; every command kept verbatim, checked mechanically) and the four
agents (3,772 to 2,784; frontmatter unchanged). Small commands were already lean and left alone. A
live slop-checker run still found the planted card-in-card and hype copy and saved its report.

**Starting from the link** (2026-09-29). The designer makes a folder, opens Claude in it (auto mode)
and pastes this repo's link. That first chat has no kit loaded, so the README's "For Claude" section
carries the steps: clone to `~/design-kit` (or `pull --ff-only` it), `~/design-kit/bin/install`,
`~/design-kit/bin/new-project` from the designer's folder, then straight on into setup in the same
chat, so the designer only answers the setup questions. Tested in a headless chat: once
`new-project` has run, the save hook from `.claude/settings.json` is live (it blocked a TODO), but
the `setup` command and `CLAUDE.md` are not loaded until a new chat. So step 4 has Claude read
`CLAUDE.md`, the Designer output style and `.claude/commands/setup.md`, and carry setup out as if
`/setup` had been typed. Later chats load everything by themselves. `new-project` takes the folder
(default: the current one), names the app after it with unsafe characters turned into dashes, moves
anything already in it (a brief, references) into `project/brief/`, and refuses the kit itself, a
folder inside the kit, the home folder, Desktop, Documents, Downloads and similar, a git repo, a
folder with `package.json`, one with a kit clone inside (it says to move it to `~/design-kit`), or
one with more than 20 entries. Run again in a project, it only says it is set up. Not yet proven
live: a fresh Claude given the link finding the README steps. GitHub holds the old kit until pushed.

**Install** (`bin/install`). Checks git (without Apple's developer tools it opens their installer
and waits), Node.js 22 or newer (Node 20 reached end of life on 30 April 2026; Homebrew if present, otherwise
it downloads the current LTS installer from nodejs.org, opens it and waits) and rsync; installs an
AI agent only when it finds none, and then Claude Code (the official `claude.ai/install.sh`), or
updates an installed Claude Code (`claude update`, or Homebrew for the cask) and says whether it
changed; installs the gate's parser in the kit and runs the gate's
self-test. It changes nothing else in the home folder. The owner asked for a command that installs
or updates Claude Code; `/sync` also runs it. For a designer without Claude Code, the README gives
one Terminal line that clones the kit and runs it. `npm ci --prefix <dir>` fails with "Missing:
scripts@ from lock file" when run from outside `<dir>` (npm 11), so scripts `cd` into the folder.
Still manual for a designer: GitHub access to the private repo, signing in to Claude, and trusting
the folder the first time Claude opens there.

**Permission prompts** (2026-09-29). Designers work in Claude Code's auto mode, where Claude
approves routine commands itself, so the kit carries no allow list. Auto mode cannot be set from a
project's settings (only `~/.claude/settings.json`), so designers turn it on themselves; the README
says so. Proof: a headless `/setup` with `--permission-mode auto` in a new-layout project ran end to
end in 1.5 minutes with an empty `permission_denials` (the array in `claude -p --output-format json`
that lists every blocked call), both repos committed, and the app's commit hook then refused a code
comment. Without auto mode (`acceptEdits`) the same `/setup` stopped at its first command.
In auto mode nothing asks before a routine command, so `settings.json` denies the shortcuts around
kit rules, also through `git -C <dir>`: `git add -A`, `--all` and `.`, and `git commit --no-verify`.
Both were proven blocked in auto mode. `.mcp.json` starts Chrome DevTools through `npx`, pinned at
1.10.1, so a designer's Mac needs no install; raise the pin by hand. If an allow list is ever needed
(designers not in auto mode), from the docs: allow rules are matched against each part of a command
joined by `&&`, `;` or `|`; `*` matches anywhere; allow rules do not match past a leading
`VAR=value`; read-only git is allowed without a rule, but not with `-C`.

**App structure** (2026-09-30). From a developer's handover advice the owner received (Peter, the
dev on Dirigeo), adapted to our stack: `src/app` routes only; `src/features/<name>` per feature;
`src/components` is the design system, one small file per part, each wrapping one library part and
exposing only the options TASTE.md allows; `src/components/ui` is the library as installed (shadcn,
kept, not Mantine as Peter uses); `src/tokens` holds five files (colours once with `light-dark()`,
spacing, radius and shadow in px, type in rem so the reader's font-size setting still works).
Screens never import `components/ui`: gate rule `dk-08`, checked in the gate itself (the scanner
sees a single file without its path) and skipped for anything under a `components/` folder. The
gate also skips `src/components/ui/` (`excludePaths`): the library is the engine, not our code.
shadcn 4 `init -d -y -s` is non-interactive, installs its runtime packages, adds a sample
`button.tsx` and `src/lib/utils.ts`, and rewrites `globals.css`, so it runs in `/setup` before
`/tokenize`; knip then ignores `src/components/ui/**`, `src/lib/utils.ts` and the four runtime
packages, which are used from the first part on (uninstalling them and relying on `shadcn add` to
bring them back does not work: `add` reinstalls only `cn`). `/tokenize` points the library's
variables at the tokens and removes its class-based dark variant so `dark:` follows the system like
`light-dark()`. Handover rules added to `CLAUDE.md` and `/commit`: a dated `DECISIONS.md` line
starts them; then a `design/<topic>` branch, never `main`; files a dev touched last get a proposal;
questions for devs are one numbered list. Parked for next: the data door (`src/api`, mock behind it,
a contract document in the app) and cheap bad cases through mock scenarios; the owner wants the link
between the two explained first.

**Setup builds in the background** (2026-09-30). The owner asked whether the kit should spawn
agents to go faster. It already does where it pays: `/check` runs three review agents at once.
Parallel building of screens was rejected: several agents mean several tastes stitched together,
the slop the kit exists to prevent. One safe use was added: `/setup` step 4 launches one
`general-purpose` helper on `sonnet` in the background right after the designer's answers, and it
follows the `## Build` section at the end of `setup.md` (skeleton, `npm install`, prettier, knip,
husky, shadcn, the a11y lint) while the main chat writes the taste profile and the three documents.
Step 7 waits for its report before the judgment work (comments out, README, the three checks). The
commands are unchanged, checked mechanically against the previous version. The Tailwind choice was
dropped: shadcn needs Tailwind, so it was never a choice, and dropping it is what lets the skeleton
start before `TASTE.md` exists. Measured on the owner's Mac: the build block takes 27 s with a warm
npm cache and 40 s with an empty one, so that is the saving per project on a fast connection; more
on slow wifi. A change of platform after the questions costs a rebuild of the app folder. Not yet
proven live: a headless `/setup` with the helper (the auto-mode guard refuses a nested Claude
session from inside a session, so it must be run by hand in a throwaway project).

**The data door** (2026-09-30). The second half of Peter's advice, and the reason bad cases are
cheap: all data goes through `src/api/` (`client.ts` calls, `types.ts` shapes, `mock/` sample data
and scenarios), screens import from `@/api` only, and the mock answers to `API_SCENARIO`
(`normal`, `empty`, `long`, `error`, `slow`; web also `?scenario=`), so every screen's bad cases are
one switch, not extra sample data. Gate rule `dk-09` blocks a screen importing `api/mock`, like
`dk-08`; inline sample data in a feature is left to `slop-checker` and `code-reviewer` judgment.
The contract, `docs/api/contract.md` in the app, is the one document allowed there besides the
README: the dev builds the back end from it and clones only the app. The door is created by the
first `/design-screen` that shows data, not by `/setup`: an empty door is unused files and knip
would flag them. Handover for the dev: rewrite `client.ts` against the real server, delete `mock/`.
Proven headless in auto mode on a fresh project: `/setup`, `/tokenize`, then `/design-screen` for a
screen with data produced `src/api/` with the five scenarios, `docs/api/contract.md` with calls and
per-screen states, wrapped parts in `src/components`, features importing from `@/api` only, all
checks green. That run also edited library files in `src/components/ui` to match the tokens, which
the next `shadcn add` would overwrite, so `CLAUDE.md` now forbids editing them.

**Working together** (2026-09-30). Prompted by an incident at the owner's company: two designers
with no git knowledge vibe-coded the same project for days on separate branches, then merged at the
end and got two solutions to the same thing. The kit now does all git for them through
`.claude/scripts/team-sync.mjs`: everyone on `main` until handover; a SessionStart hook
(`startup|resume`) runs `--start`, which pulls both repos with rebase, pushes unsent commits and
prints what arrived and who works on what (always exits 0 so the hook output reaches Claude);
`/commit` ends with `--share`; `/design-screen` starts with `--claim <Screen>` and ends with
`--release`. Claims live in `project/WORKING.md` in the design repo, one line each. Overlaps are
settled automatically, first pushed wins: the local side of each clashing file is saved in
`project/reviews/conflicts/<date>/<repo>/<path>` and committed, the rest of the commit still goes
up, a commit left empty is skipped. `WORKING.md` clashes are merged by intent instead (the commit
subject says claim or release), so simultaneous claims both survive. Force pushes are denied in
`settings.json`, `--no-verify` already was. `/setup` asks two more things: whether anyone else will
work on it (yes: `gh repo create` both repos private, or the designer makes two empty repos and
pastes the links) and, if git has none, the designer's name. A teammate joins with
`bin/join-project <design repo link>`, which clones the design repo, then the app from `appRemote`
(recorded in `workspace.json` by the first share). The first version of the script was refused by
auto mode's classifier as changing shared resources; the owner switched to manual mode and approved
the write.

**Existing projects and lighter checks** (2026-10-05). From the owner's portfolio trial: the kit
refused a working site, a session copied parts of it by hand, and the deep reviews ran on every
small change at 20 to 40 minutes each until a day's tokens were gone. Spec:
`dev/specs/2026-10-05-existing-projects-and-lighter-checks.md`. Now `bin/new-project` hands a folder
with code to `bin/join-existing.mjs` (one repository, `"joined": true`, nothing moved, the project's
files kept, a public repository keeps the kit out of its history), and `/setup` has a joined branch
that reads before asking and settles clashes in one message. Checks run in levels: the gate on
save, `quick-check.mjs` on commit, deep reviews only through `/check` when asked or on a yes to
`review-due.mjs`, `/check all` before handover. `project/reviews/STATUS.md` replaces a log: lines
added or deleted, never reworded, merged by meaning when two people change it. The live trial on a
clone of the portfolio found two more: a joined project's first chat pushed to the real repository
through the start hook (reverted as `0d77683`; joined projects now upload only when the owner says
so, `"share": false`), and Tailwind 4 scanned the kit's guides into the site's stylesheet (the join
now adds two `@source not` lines). A trial clone must have its remote removed before any chat.
Measured on a fresh, offline clone of the portfolio (2026-10-05, Sonnet, auto mode, headless):
joining is instant; `/setup` took 4 min 46 s with no blocked commands; the commit check takes 32 s
(typecheck 1, lint 1, taste 0, build 3, Playwright 27); `/check` after a one-line CSS change took
44 s with three reviewers in parallel, against 20 to 40 minutes a review before. Two limits seen:
headless setup cannot get the owner's yes to replace the site's own adapted agents (a real chat
asks), and the portfolio ignores `project/reviews/`, so its `STATUS.md` stays on one Mac. Auto mode
also refuses any edit to `permissions` in a settings file, so setup never makes one.

**Any agent** (2026-10-05). The owner means to make the kit public, for any AI coding agent;
designers at the company use Claude Code. Spec `dev/specs/2026-10-05-any-agent-responsive-peter.md`,
plan `dev/plans/2026-10-05-any-agent.md`. What was settled, each from the tool's own docs or source
on that date:
- `AGENTS.md` is the rulebook. Claude Code reads it natively only when no `CLAUDE.md` exists, and a
  joined project often has one, so `CLAUDE.md` stays as `@AGENTS.md`. Gemini CLI needs
  `context.fileName` in `.gemini/settings.json`.
- Skills live in `.agents/skills` (Codex, Cursor, Gemini CLI, Copilot, OpenCode and the skills
  installer's "universal" group read it). Claude Code does not, so it gets relative links in
  `.claude/skills`; proven live, a linked skill loads. Node's `cpSync` rewrites relative links to
  absolute ones, so links are always made by `linkSkills`, never copied.
- The kit's machinery left `.claude/` for `.designkit/`, not `.agents/`: Codex makes `.agents/` and
  `.codex/` read-only in its sandbox, and the scripts write state.
- Commands became skills: Codex has no project commands, every other tool runs a skill by name.
  Gemini CLI cannot, so it gets a small command file per workflow.
- `hook.mjs` decides the reply format from the input, not from a flag: Cursor and Copilot CLI also
  run the hooks in `.claude/settings.json` and then send their own input shape (Cursor) or a
  near-copy of Claude's (Copilot). Codex rejects unknown output keys; Gemini wants JSON only;
  Copilot CLI refuses every shell command when a pre-tool hook exits with an error, so every hook
  command starts by exiting 0 when the script or Node is missing.
- The same edit can reach the script twice (two hook sources in one tool), so a lock keyed on the
  file's path, time and size silences the second call for ten seconds; a chat start is keyed on the
  session id.
- Ownership without a manifest: a file in a project may be replaced when its content is a blob in
  the kit's git history (`git cat-file -e`) or in the kit's working tree. That is how
  `bin/update-project` and joining tell the kit's files from the project's. The first real project
  (the owner's budget app) wrote its own `CLAUDE.md`; it is kept, only the kit's paths in it change.
- Tool files are generated by `bin/adapters` from `.designkit/agents`, `.mcp.json` and the skills.
  rulesync was weighed and left out (eleven majors in two weeks, Gemini CLI target removed, hook
  matchers copied untranslated). `.claude/settings.json` stays hand-written: auto mode refuses an
  agent editing `permissions`, so nothing generated may touch that file.
- Never proven live outside Claude Code: no other agent is installed on the owner's Mac. The README
  says so. Could not be verified from docs: whether Codex hooks run in its IDE extension, Gemini
  sub-agents' default tools, Cursor's desktop app against its CLI for the hook input.
- Forwarders at `.claude/scripts/*.mjs` exist for chats and commit hooks that started before the
  move; delete them once every project has been updated.
- Proven live in Claude Code on the new layout (2026-10-06, headless, Sonnet, auto mode, a fresh
  project): `/setup` 13 turns, `/tokenize` 12, `/design-screen` 16, each with no blocked command; both
  repos committed, no AI signature in either history, gate 0 block, a commit holding a TODO refused
  (`dk-07`), and `git -C <app> add -A` refused by the guard. Two findings: the agent wrote husky's old
  preamble into the hook files and spent a commit removing it (setup now says the files hold exactly
  the kit's lines); its first `Button` part dropped the native props, which the wrapper rule in the
  next plan answers. Chrome was not installed, so the screen was not opened in a browser.
  Earlier: a linked skill loads in Claude Code; `bin/update-project` on a copy of the first real
  project.
- A fresh review of the whole change (0b6743e..fbbfa91) found nothing that breaks or loses a
  project's work. Fixed after it, each with a test that failed first: the guard missed `bash -lc`,
  git's shortened flags, whole-tree pathspecs, switching hooks off through config, aliases or an
  exported `HUSKY=0`, and `timeout`/`nice`; the hook script crashed on an open, empty input pipe;
  Claude Code's guard only saw `Bash`, so a Figma write under a plugin's server name passed;
  `AGENTS.md` called all of `.github/` generated; hand-written rules kept `.claude/commands` paths.
- Not fixed, a ruling: Cursor's edit event. Its `postToolUse` matcher is `Write`; registering
  `afterFileEdit` as well could let the duplicate lock swallow the message the agent needs, and
  Cursor is untested. Settle it in the first live Cursor run; until then an edit Cursor does not
  call `Write` is checked at commit, not at save.

**Responsive by kind of project** (2026-10-06). Spec section 2, plan
`dev/plans/2026-10-06-responsive-peter.md`. The owner: "be flexible... a landing page, for sure we
will have responsive layout. But for mobile app, we gonna ignore this." So no new setup question:
the agent writes `## Screen sizes` in `PROJECT.md` (the kind, the sizes, a one-line why), a joined
project reads it from its styles, an older project gets it the first time `/design-screen` runs, and
the designer can overrule it. Mobile app: none, only larger text and safe areas. Website: phone,
tablet, laptop, wide. Web app: the sizes the brief names, else laptop and wide as an assumption.
One set of widths everywhere: Tailwind's 640 to 1536, written in rem in `breakpoint.css`;
`ui-design` no longer says 375 or 1440. Each screen is opened at 390, 768, 1280 and 1920 by 1080 as
in scope, then at 320 and with the text at 200%. Reviewers without browser tools say the widths
were read, not opened.

**The dev's playbook** (2026-10-06). Spec section 3 (P1 to P14), same plan. Settled:
- Two gate rules, both blocking in new projects: `dk-10` a raw colour or made-up size (arbitrary
  px/rem, breakpoint, z-index, duration) in a screen or part; `dk-11` a raw button, input, select
  or textarea in a screen. Tokens, `components/ui`, `globals.css`, `src/lib` and `src/api` are left
  alone; only string values are read, never copy, so "Order #123" and `href="#add"` pass. An
  existing project gets a new rule at its next `/sync` only when its app already passes it;
  otherwise the rule warns and `/sync` tries again next time. Setup replaces the generator's start
  page, which breaks both rules.
- `project/DEV.md`, the dev list, in every project (new, joined, moved): one numbered message, a
  `## Meeting` part for sign-in, permissions, payments and anything needing a screen, the dev's own
  requests first. The agent never decides sign-in, permissions or payments.
- Features by business job; parts named `DS<Part>` (older parts keep their names) with native props
  and `ref` passed through; one icon set; `long` means thousands; no screenshot suites or whole-app
  AI cleanup; z-index, motion and height token files; focus by border colour on fields.
- New apps: Prettier's defaults, width 100, `prettier-plugin-organize-imports`; `engines` Node 22;
  the installer asks for Node 22. Existing projects keep their Prettier config.
- A repo someone else has committed to (an author who is not the designer by email, name or GitHub
  login, and not a bot) is joined like a public one, and `project/` stays local too (`"devRepo": true`). Only the two rules-file
  lines that load the kit where present are committed, as for a public repo. Repos joined before
  keep what they have.
- Not taken, with reasons, in the spec's "Left out" table (Mantine, `forwardRef`, pixels only,
  folder per part, `isDisabled` names, fake API routes, Axios, no lint, v1/v2 copies, `colors.ts`,
  a no-permission state everywhere). The developer's name and the client projects stay in `dev/`;
  the layout test keeps them out of every shipped file.

**Lean kit** (2026-10-06). The owner: make the kit less bulky, so the AI reads only what the
moment needs. Plan and findings: `dev/plans/2026-10-06-lean-kit.md`. Measured at about 4 characters
a token, before (`8b14ad7`) and after:

| What is read | Before | After |
|---|---|---|
| Every message in a project (rulebook, skill descriptions, reviewer list, reply style) | 31.2 KB, ~7,800 | 20.6 KB, ~5,100 |
| One `/design-screen` (the workflow and every guide it names) | 93 KB, ~23,300 | 52 KB, ~13,000 |
| Reviewer preloads, all four | 106 KB, ~26,600 | 24 KB, ~5,900 |
| `/setup` itself | 20 KB | 9.5 KB, plus `joined.md` or `build.md` only where needed |
| A session on the kit (`dev/NOTES.md`) | 36 KB | 12.9 KB |

- `AGENTS.md` keeps what every message needs; a joined project reads `.designkit/rules/joined.md`,
  a handed-over one `.designkit/rules/handover.md`. Every rule kept, checked by name.
- Dropped: `brandkit` and both `imagegen` skills (nothing routed to them; most agents cannot make
  images); `design-systems`, `ux-strategy`, `dev-conventions`, `prototyping-testing` (agency tools
  the rulebook overruled; their useful lines moved into `/tokenize`, `/setup`, `/commit`).
- Merged: `inclusive-design`, `accessible-content`, `adaptive-interfaces`, `motion-sensitivity` into
  `accessibility` (one value per rule; they disagreed on targets, toasts, focus). Trimmed:
  `ui-design`, `interaction-design`, `no-slop`, `emil-design-eng`, `figma-implement-design-new`,
  `shadcn-ui`, each fixed where it contradicted the rulebook. Drafts and one-line notes of what
  each lost were reviewed before they went in.
- Reviewers preload only their core guide (`accessibility` or `no-slop`); platform guides open when
  a finding needs them; `slop-checker` no longer reads the 20 KB taxonomy.
- A project keeps only its platform's guides (`skills-for.mjs`, `"skillsOff"`); borrowed skills come
  without their compiled `AGENTS.md` and `README.md` (the Vercel ones are 182 KB and their SKILL.md
  points at them). Retired skills leave existing projects at the next update.
- Kept on purpose: the `.claude/scripts` forwarders (they cost no reading, and removing them on a
  second update would break a chat still open on the old paths); the arrivals line at the start of
  a chat, now capped at ten.
- Proven live (headless, Sonnet, auto mode, a fresh project from the trimmed kit): `/setup` for a
  web app took 14 turns with no blocked command; both repos committed with no AI signature; the
  problem and a success measure (marked as a guess) in `PROJECT.md`; `skillsOff` recorded and the
  React Native guide gone; lint, knip, the gate and the quick checks green. Not yet live:
  `/tokenize`, `/design-screen`, `/check` on the trimmed guides.
- Not done, the next lever: `kill-ai-slop`'s description is 1 KB of the 4.8 KB every message reads,
  and it competes with `/slop-check`. Installing it outside `.agents/skills` (the gate reads its
  scanner by path) takes out ~250 tokens a message; it touches `check-upstream.mjs`, the gate's
  scanner path and about seven tests.
