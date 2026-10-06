# Any agent, real responsive checks, Peter's playbook

Agreed with the owner on 2026-10-05. Status: built 2026-10-06 (sections 1 to 3) and pushed.

Context from the owner: designers use only Claude Code today, but the kit is meant to go public for
anyone, with any agent. At least one real project already uses the kit, so every change must keep
it working.

Three pieces of work, built in this order so nothing is edited twice:
1. **Any agent**: the kit works with any AI coding agent, not one.
2. **Responsive**: decided by the kind of project. A mobile app gets none; a website gets all of
   it; a web app gets the sizes its brief names. What is designed is also checked at real widths.
3. **Peter's playbook**: 13 changes from what the dev on Osmose and Dirigeo asked for, plus one
   recommended answer to the open decision.

## 1. Any agent

**Today.** Everything is wired for one tool: the rules in `CLAUDE.md`, the workflows as its
commands, the reviewers as its sub-agents, the save check and the start-of-chat sync as its hooks,
the reply style as its output style, the safety rules as its permissions, and the kit's own scripts
in `.claude/`. Another agent finds the rules only by chance and skips the save check and the sync.
One part is already universal: the commit check is a git hook, so it stops slop whatever the agent.

**What each tool reads** (from each tool's docs, 2026-10-05; sources at the end of this section):

| Tool | Rules | Skills | Run a workflow by name | Hooks | Sub-agents | MCP |
|---|---|---|---|---|---|---|
| Claude Code | `CLAUDE.md`; `AGENTS.md` only when no `CLAUDE.md` exists | `.claude/skills` | `/name` | `.claude/settings.json` | `.claude/agents/*.md` | `.mcp.json` |
| Codex | `AGENTS.md` | `.agents/skills` | `$name` | `.codex/hooks.json`, approved once in `/hooks` | `.codex/agents/*.toml` | `.codex/config.toml` |
| Cursor | `AGENTS.md`, `CLAUDE.md` | `.agents/skills`, `.claude/skills` | `/name` | `.cursor/hooks.json`, and runs `.claude/settings.json` hooks too | `.cursor/agents`, `.claude/agents` | `.cursor/mcp.json` |
| Gemini CLI | `AGENTS.md` once named in its settings | `.agents/skills` | only through command files | `.gemini/settings.json` | `.gemini/agents/*.md` | `.gemini/settings.json` |
| GitHub Copilot | `AGENTS.md`, `CLAUDE.md` | `.agents/skills`, `.claude/skills` | `/name` | `.github/hooks/*.json` (VS Code: preview); its CLI also runs `.claude/settings.json` hooks | `.github/agents/*.agent.md` | `.mcp.json` |
| OpenCode | `AGENTS.md` | `.agents/skills`, `.claude/skills` | `/name` | a small plugin in `.opencode/plugins` | `.opencode/agents/*.md` | `opencode.json` |
| About 20 more (Amp, Cline, Warp, Zed, Replit...) | `AGENTS.md` | `.agents/skills` | varies | none: the commit check only | varies | their own |

**Build.**

| # | Change |
|---|---|
| U1 | One rulebook, `AGENTS.md`: today's `CLAUDE.md` rules, written for any agent. `CLAUDE.md` shrinks to one line that loads it, because Claude Code skips `AGENTS.md` whenever a `CLAUDE.md` exists, and joined projects often have one. Gemini is pointed at it in its settings |
| U2 | The kit's own machinery moves out of `.claude/` into a neutral `.designkit/`: scripts, gate policy, workspace file, local state, reply style, reviewer sources. Not `.agents/`: Codex makes that folder read-only. At least one real project uses the kit, so old paths keep working through small forwarders, and `sync` moves each project over, the app's commit hook included |
| U3 | Skills live in `.agents/skills/`, read by Codex, Cursor, Gemini, Copilot, OpenCode and about 20 more. Claude Code gets links to them in `.claude/skills/`. The skills installer the kit already uses works exactly this way |
| U4 | The 7 commands become skills with the same names (`setup`, `design-screen`, `tokenize`, `commit`, `check`, `slop-check`, `sync`), so every agent can run them. Gemini gets one small command file per skill, because it cannot call a skill by name. Steps that name one tool's features are rewritten neutrally ("ask in one message, with the tool's question picker if it has one") |
| U5 | The 4 reviewers are written once and generated into each tool's sub-agent format, the cheaper or stronger model chosen only where the tool allows it. Where a tool has no sub-agents, `check` runs them one after another in the chat |
| U6 | One hook script for every tool, reading each tool's hook format: the save check after each edit, the start-of-chat sync, and a new command guard that refuses `git add -A`, `--no-verify`, force pushes and Figma writes however the command is spelled (today's deny list misses some spellings, and the docs say it is not a hard boundary). Registered for Claude Code, Codex, Cursor, Gemini, Copilot and OpenCode. It runs once even when a tool also reads another tool's hook file |
| U7 | MCP servers (Figma read-only, Chrome DevTools) generated for every tool from one list |
| U8 | Two git backstops that work with any agent, hooks or not: the commit message check removes AI co-author and "generated with" lines; the push check refuses rewriting shared history |
| U9 | The reply style for every agent: a short version in `AGENTS.md`; Claude Code keeps its output style. Agents without hooks are told in `AGENTS.md` to run the sync first and the gate after each edit |
| U10 | A small generator of our own (`bin/adapters`, kit only, no dependencies) writes every tool's files from the neutral sources, and a test fails when they are out of date; tool files are never edited by hand. In a joined project, a tool file the project already has gets the kit's entries added, never replaced. The maintained option, rulesync, was checked and left out: eleven major versions in the last two weeks, no Gemini CLI support any more, and hook matchers it copies untranslated |
| U11 | Neutral words everywhere outside a tool's own files: "the agent", "your AI". The README's "For Claude" becomes "For your AI agent", with a table of supported tools, what runs on its own in each, and which approval mode to pick. `bin/install` installs an agent only when it finds none, and then Claude Code. The 9 borrowed skills stay exactly as upstream wrote them |

**Limits, stated in the README table:** Codex keeps `.git` read-only inside its sandbox, so commits
ask the designer for approval unless they pick full access, and it asks once to approve the hooks.
Tools without hooks get the slop check at commit, not at save. Reviewers run side by side only where
the tool has sub-agents. A tool is listed as tested only after a live run passes in it.

**Sources:** Claude Code: code.claude.com/docs/en (memory, skills, hooks, mcp, sub-agents,
permissions, output-styles). Codex: learn.chatgpt.com/docs (agents-md, build-skills, hooks,
subagents, rules, agent-approvals-security). Gemini CLI: geminicli.com/docs (gemini-md, skills,
custom-commands, hooks, subagents, policy-engine). Cursor: cursor.com/docs (rules, skills, hooks,
reference/third-party-hooks, subagents, mcp, cli/reference/permissions). Copilot:
code.visualstudio.com/docs/agent-customization and docs.github.com/en/copilot (instructions,
skills, hooks-configuration, custom agents, mcp). OpenCode: opencode.ai/docs (rules, skills,
commands, plugins, agents, permissions). Skills installer: github.com/vercel-labs/skills
(`src/agents.ts`, 79 agents).

## 2. Responsive

**Today.** `/design-screen` step 3 designs every screen for every size with `ui-design` and writes
it in the spec. Four gaps:
- No project says which sizes are in scope, so every screen gets a phone layout, even when the
  brief says desktop and tablet (Peter: 20 to 30% more work).
- Nothing opens the screen at those widths. Step 8 opens each data scenario at one width; no
  review checks a narrow window, which WCAG AA requires to work (reflow at 320 px).
- The spec and the code use different widths. `ui-design` says 375, 640 or 768, 1024 and 1440 (it
  disagrees with itself on tablets); the code uses Tailwind's 640, 768, 1024, 1280 and 1536.
- Nothing tells a mobile app apart from a website, so a phone app could be handed web widths it
  never needs.

**Build.** Flexible by design: the agent decides from what it knows of the project, writes the
decision down with a one-line why, and the designer can overrule it. No new setup question.

| Kind of project | Responsive work |
|---|---|
| Mobile app (Expo) | None: no breakpoints, no width checks. Only the checks the kit already makes stay: largest text size and safe areas |
| Website or landing page | All of it, always: phone, tablet, laptop and a wide screen |
| Web app (a dashboard, a tool) | The sizes the brief or WBS names; nothing else is designed. Other widths only have to keep working (WCAG AA, which the kit already sets as the floor) |
| Web and mobile | Each part by its own kind |

| # | Change | Where |
|---|---|---|
| R1 | The kind and the sizes written in `PROJECT.md` (`## Screen sizes`), with the why. Taken from the brief and what the project is; a guess goes under Assumptions. A joined project reads them from its code | `setup` steps 6 and Joined 2 |
| R2 | Web only: one set of widths everywhere. `src/tokens/breakpoint.css` holds 640, 768, 1024, 1280, 1536 (Tailwind's, which are also Peter's), and `ui-design` is edited to name the same widths | `tokenize` step 7; `ui-design` |
| R3 | `design-screen` designs only what `## Screen sizes` lists; for a mobile app it skips responsive work entirely | `design-screen` step 3 |
| R4 | Web only: each screen opened at the widths in scope (390 phone, 768 tablet, 1280 laptop, 1920 × 1080 wide, the dev's review screen), plus 320 and 200% zoom so nothing breaks | `design-screen` step 8 |
| R5 | The design review checks the same widths, and skips them for a mobile app. A width in the code that is not a breakpoint token fails the gate (rule P3) | `design-reviewer` |

## 3. Peter's playbook

Source: "Learned from Peter playbook" (compiled 2 Oct 2026 from Osmose and Dirigeo). The kit
already follows 18 of his rules; the table at the end lists them.

| # | Change | Peter's reason | Where |
|---|---|---|---|
| P1 | Features grouped by business job, not by screen: sign in, sign up, forgot and reset password are one `authentication` folder. Today "a page assembles one feature" makes one folder per screen | Half of his 2 to 3 lost days on Osmose was splitting features into modules | `AGENTS.md` App structure; `design-screen` step 7 |
| P2 | The wrapper rule made exact: the native element's props and `ref` pass through, the library's options never. A new look is first tried as a colour of an existing variant. Wrappers named `DS<Part>`. Icons from one set, the one the library installs | Today "nothing passed through" can drop `aria-label`, `type="submit"` or `ref`. "CTA is primary with color gold." AI mixes icon sets | `AGENTS.md` App structure; `design-screen` step 7 |
| P3 | Two gate rules: a raw colour or made-up size in a screen or part (`#1a2b3c`, `rgb(...)`, `p-[13px]`, `min-[900px]:`); a raw `<button>`, `<input>`, `<select>` or `<textarea>` in a screen | Osmose's magic numbers. Today a raw hex is caught only when someone asks for a review | `slop-rules.mjs`, policy, gate tests |
| P4 | A dev list, `project/DEV.md`: questions for the dev collected across chats and sent as one numbered message, one line each; sign-in, permissions, payments and anything needing a screen marked "meeting"; the dev's own requests, done before the next new screen | He bills each ping (DIRIGEO-42). His 18 Sep list waited a week. "how can I suppose to read 50 lines of text." Today the list exists only after handover and has nowhere to live between chats | `AGENTS.md`; a template in `project/` |
| P5 | The agent never decides how sign-in, permissions or payments work: screens run on the mock, the choice goes to the dev list as a meeting | "the back bone of the application, I don't trust AI decision" | `AGENTS.md` Data |
| P6 | His Prettier config in new apps: semicolons, double quotes, trailing commas, width 100, imports sorted (`prettier-plugin-organize-imports`). It is Prettier's defaults plus width 100 and the sorter. Existing projects keep theirs | One shared format, nobody reformats anybody. He asked for it on 18 Sep | `setup` Build |
| P7 | Never build a screenshot or visual test suite, or tooling nobody asked for. Never launch a whole-app AI cleanup; cleanup is knip, Prettier and the gate | The 3 hour, 402 screenshot run. "it cannot clean 100%. It just makes some messes" | `AGENTS.md` Quality |
| P8 | Three more token files: z-index, motion (durations, easing), heights (control sizes); breakpoints come with R2. Naming: hue plus step (`--accent-600`), alpha as suffix (`--accent-600-a30`), shadows by use (`--shadow-card`), shadow colours from colour tokens through `color-mix` | A z-index or a duration in a component is a magic number by the kit's own rule, and today there is no token to use instead | `tokenize` steps 2 and 7 |
| P9 | Fields show focus by changing the border colour, at 3:1 against field and page; buttons and links keep a ring for keyboard focus only | "at the first sight it's nice. but use it for a long time it's really annoying." WCAG AA still met | `tokenize`; `design-screen` step 6 |
| P10 | The `long` scenario means thousands: a total in the thousands, so paging or a count gets designed. Screens checked for anything that shifts after it appears. An animation plays the same on every load unless `DECISIONS.md` says once | "thousands of rows." The dropdown item that dropped 2px. The intro that did not replay | `AGENTS.md` Data; `design-screen` step 8 |
| P11 | The handover review checks his list where no rule does: one icon set, closed variant sets, every top folder in the README, no session files, screenshots or agent files in the app | His handover checklist | `code-reviewer` |
| P12 | Node 22 as the minimum, and an `engines` line in new apps | Node 20 reached end of life on 30 April 2026. His range starts at 22 | `bin/install`; `setup` Build |
| P13 | After handover, a `design/<topic>` branch always starts from freshly pulled main. When the dev sends an API spec, types and mock follow it and the differences go to the dev list | His own slip: a branch from a week-old main. His gap list | `AGENTS.md` After handover |
| P14 | A repo a dev already works in (Dirigeo after his refactor) gets the kit the way a public repo does: nothing of it in his history. Today a private joined repo commits 23 skills, 4 reviewers and the scripts into his repo the first time the designer shares | His checklist: no agent files in the app repo; his own agent would load them every session. Cost: the design notes stay on the designer's Mac until joined projects get a design repo of their own | `bin/join-existing.mjs`; `setup` Joined |

**Left out**, with the reason in his own currency:

| Peter's rule | Why not |
|---|---|
| Mantine and SCSS modules | Decided on 30 Sep (shadcn kept). Switching rebuilds setup, tokens, the gate and every project; the wrapper layer already gives him one library behind DS parts |
| `forwardRef` on every part | React 19, which every new app gets, takes `ref` as a plain prop and is retiring `forwardRef`. His real point, refs reach the part, is in P2 |
| Pixels only | Type stays in rem so a reader's larger font setting still works. Spacing, radius and shadow are already px |
| A folder per part with `index.ts` files | With Tailwind there is no style file to sit beside the part, and re-exporting index files slow builds (the kit's React guide bans them) |
| `isDisabled`-style prop names | The native `disabled` passes through too (P2), so a part would have two names for one switch |
| Fake API routes inside Next.js | His 18 Sep idea, dropped by 29 Sep. The mock behind the client also works on mobile |
| Axios and React Query | His to choose and configure; he rewrites `client.ts` at handover anyway |
| No lint on the design side | The accessibility lint catches defects while designing; he can swap it at handover. He kept his "yes" for shared formatting |
| Versions side by side (v1, v2, v3) | Git keeps every version. Copies make every session read more: the token cost he argues against |
| A `colors.ts` copy of the colours | Needed only when a chart or map wants colours in code; it then reads the CSS variables, and P3 makes a copied hex fail |
| A "no permission" state on every screen | The page's own idea, not his. Only apps with roles need it; added per project when the brief has roles |

**Already in the kit**: wrappers on one library (`dk-08`); closed variant sets; tokens in one file
per concern; colours once with `light-dark()`; a reset first (Tailwind's); one data door (`dk-09`);
the contract with each screen's calls and states, written before the screen's code; five data
scenarios; no AI comments (`dk-05`, `dk-07`); knip, Prettier and husky on every commit; code and
design notes in separate repos; one knowledge file read first; decisions with why and reversal cost;
ask before touching the dev's code; commit messages with the why; every screen opened before it is
called done; the README's folder map.

## Order and proof

**Order.** Small commits, every test suite green after each, `dev/NOTES.md` updated as each part
lands.
1. The move: U2, then U1, U3, U4 (everything after this is written in its new place).
2. The adapters: U10, then U6, U8, U7, U5.
3. The words: U9, U11.
4. Responsive: R1 to R5.
5. Peter: P1 to P14.

**Proof.**
- Every existing suite passes on the new paths: gate 58, commit check 11, checks 31, upstream 14,
  install 56, team 40.
- New tests: probe files for P3's two gate rules; the hook script fed a sample from each tool; the
  guard refusing every spelling of the denied commands; the generated files current and valid; the
  commit message and push checks; an existing project moved by `sync` with its commit check still
  refusing a code comment.
- Live in Claude Code, which is installed here: `setup`, `tokenize` and `design-screen` headless in
  a throwaway project, with no blocked commands.
- Live in the other tools: not in this build. Designers use only Claude Code, and no other tool is
  installed here. The README lists the others as supported, not tested, until each passes the same
  headless run.
- An old project: one made with today's kit (from the commit before this build), moved by `sync`
  to the new layout, with its commit check, start sync and save check still working. If the owner
  points to the real project, the same on a copy of it, before the kit's change is pushed.

## Before the kit goes public (not in this build)

The kit's shipped files (`AGENTS.md`, skills, scripts, README) name no colleague, client project or
internal ticket: Peter's reasons stay in this spec only. Still open before a public release:
1. The licence steps already agreed in `dev/NOTES.md` ("Licences"): the 14 skills taken from the
   company's tool need its written permission or replacements; who owns the kit's own files; an MIT
   licence for them.
2. `dev/` names colleagues, client projects, internal tickets and quotes from private chats. Scrub
   it, or keep `dev/` in a private repository and publish the rest.
3. A live run in at least two other agents, so the README can call them tested.
