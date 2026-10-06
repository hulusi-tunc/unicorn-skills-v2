# Design Kit

A starting point for UI projects built by talking to an AI coding agent. Answer a few questions
once, and every later chat already knows the project, the look and the rules. The code reaches the
dev team clean.

## What v2 adds

Built on Jason's design kit, with what the dev team, QA and our own projects taught us:

- **Ready for QA from the first screen**: every control carries a test ID (the gate checks it),
  seven data scenarios including no access and long text, test accounts, and a QA pack a tester
  starts from the same day (`/testable`).
- **Safe by default**: the commit check refuses live keys, a Supabase `service_role` key, secrets
  behind a public prefix, `.env` and AI session files; the push check refuses a public repository.
- **The dev team's commit rules**: a Jira line on every commit when the project has a key,
  protected branches, no AI signature.
- **Decisions on a page**: directions and choices the team clicks and votes on (`/decide`), flows
  studied before a direction (`/study`).
- **The Unicorn gallery**: every screen in its states captured and kept up to date (`/capture`).
- **Tools on demand**: outside skills (a security audit, e2e testing, code review) are pinned and
  offered at the moment they help, never copied in.
- **Housekeeping**: `tidy` reports landed branches, leftovers and unsaved work without touching
  anything. The kit sets no look: each project finds its own.

## Start a project

1. Make a folder named after the project, for example `Streakly`.
2. Open your AI agent in that folder ("Which AI agents" below says what to pick first).
3. Paste the link to this repository and ask the agent to start the project with it. A line about
   the project helps, for example "a habit tracker for busy parents, mobile".

The kit picks one of two modes from what is in the folder. Start: an empty folder, one with only a
brief, or an empty repository you made on GitHub (its link is kept). Join: a folder that already has
code; the kit fits around it, nothing moves, the agent reads the project first and asks only what it
cannot find, and where the kit's rules clash with how the project works, you choose once.

The agent turns the folder into the project and goes straight on to set it up, in the same chat. It
first reports any upstream changes to the kit's skills and asks which to take. Then it asks until
it has the bare minimum (what the product is, web or mobile, looks you like, looks to avoid, the
first screen), writes the answers down, builds the app inside the folder, and installs the checks.
Files already in the folder, such as a brief, move to `project/brief/`, where setup reads them.
Later chats in the folder load the kit by themselves.

The folder afterwards:

```
Streakly/           the kit, the decisions, the specs, the reviews. Open your agent here.
  Streakly-app/     code only, its own repository. The dev team gets this and nothing else.
```

After setup: `/tokenize` for the design system, `/design-screen` for each screen, `/check` before
anything ships, `/sync` when you come back after a while. In Codex the same names start with `$`.

## Which AI agents

| Agent | Reads the rules and skills | Runs the checks by itself | Reviewers side by side | Before the first chat |
|---|---|---|---|---|
| Claude Code | yes | yes | yes | choose auto mode |
| Codex | yes | yes, once you approve them in `/hooks` | yes | trust the folder; commits ask for your approval unless you allow full access |
| Cursor | yes | yes | yes | nothing |
| Gemini CLI | yes | yes | yes | trust the folder |
| GitHub Copilot | yes | yes in its CLI; a preview in VS Code | yes | nothing |
| OpenCode | yes | yes | yes | nothing |
| Any other agent that reads `AGENTS.md` | yes | no: it runs them itself, as the rules tell it | no | nothing |

"The checks" are three: the sync with your team at the start of each chat, the slop check after
every save in the app, and the guard that refuses `git add -A`, a skipped commit check, a forced
push and any write to Figma. Whatever the agent, three more hold in git itself: the commit check in
the app refuses slop, AI signatures are removed from commit messages, and a push that would replace
work already on GitHub is refused.

Tested live: Claude Code. The others are built from each tool's own documentation and have not had
a live run yet.

## Working with someone else on the same project

Say yes when setup asks whether anyone else will work on it, and the agent puts the project on
GitHub. To bring someone in, give them access to both repositories and the link to the project's
design folder; they make an empty folder, open their agent in it and paste that link.

From then on the agent keeps everyone in step without anyone handling git:
- Every chat starts by fetching what the others shared, and the agent tells you what arrived.
- Before a screen, it checks nobody else is on it (`project/WORKING.md` lists who works on what).
- Every save point is shared straight away, so work never sits on one Mac for days.
- If two people still changed the same thing, the version shared first stays and the other is kept
  in `project/reviews/conflicts/`; the agent tells you where.

## Install

No AI agent yet? Open Terminal, paste this line and press Return:

```
git clone https://github.com/hulusi-tunc/unicorn-skills-v2.git ~/design-kit && ~/design-kit/bin/install
```

It installs what is missing: Apple's developer tools, Node.js, and Claude Code when it finds no AI
agent at all. If a window asks to install developer tools, click Install, wait for it to finish,
and paste the line again. The repository is private, so you need access to it on GitHub.

## For your AI agent: starting a project from this link

If this README is in a project's design folder rather than `hulusi-tunc/unicorn-skills-v2`, the designer
wants to join that project: do steps 1 and 2, then run `~/design-kit/bin/join-project <this link>`
in their folder (it also downloads the app), read `AGENTS.md`, set their name for the work history
if `git config --global user.name` is empty (ask; first option `id -F`), and carry on from what
they asked. The project is already set up; there is no `/setup`.

The designer opened you in the folder that becomes the project and gave you this link. From that
folder, in order:

1. `git clone https://github.com/hulusi-tunc/unicorn-skills-v2.git ~/design-kit`; if `~/design-kit` exists,
   `git -C ~/design-kit pull --ff-only` instead (if the pull fails, use the copy as it is). Never
   clone into the designer's folder. If git asks for a password, stop: the designer needs access to
   this private repository and to be signed in to GitHub on this Mac (GitHub Desktop does both).
2. `~/design-kit/bin/install`, with a 10 minute timeout: checks git and Node.js, readies the slop
   checker, and installs an AI agent only when it finds none. It may open an installer window; tell
   the designer to click through it.
3. `~/design-kit/bin/new-project`: makes the current folder the project. A folder that already
   holds code joins instead, as it is (one repository, nothing moved). A project made with an older
   kit is moved to the current layout (`bin/update-project` does the same by itself): relay its
   list, commit both folders, and stop there. Tell the designer in one line which mode it printed.
   If it refuses, pass its reason on in plain words.
4. Go straight on to set the project up in this chat; the designer does nothing else. This chat
   started before the kit arrived, so its rules, skills and checks are not loaded. Read `AGENTS.md`
   and follow it from here on, its "Start of every chat" lines included, then read
   `.agents/skills/setup/SKILL.md` and carry it out as if the designer had typed `/setup`, with
   what they said about the project as its request.

## What is in here

- `AGENTS.md`: the rules every agent reads first. `CLAUDE.md` only loads it.
- `.agents/skills/`: 20 skills: seven of the kit's own, six borrowed from maintained projects
  (`skills-lock.json`), and the seven workflows: `/setup`, `/tokenize`, `/design-screen`, `/check`,
  `/slop-check`, `/commit`, `/sync`.
- `.designkit/`: the kit's own machinery.
  - `scripts/slop-gate.mjs`: finds AI patterns in the app, after each save and before each commit
    (on your machine only; the dev team's commits are untouched). `slop-policy.json` says which
    patterns block, which are skipped, which files are left alone.
  - `scripts/hook.mjs`: the one script every tool's hooks call: start-of-chat sync, slop check
    after a save, and `guard.mjs`, which refuses `git add -A`, skipping the commit check,
    force-pushing and Figma writes.
  - `scripts/team-sync.mjs`: keeps teammates in step (pull at the start of each chat, share after
    each commit, who works on what, overlaps settled with nothing lost).
  - `scripts/check-upstream.mjs`: reports what changed upstream in the six borrowed skills, with
    advice on each. You choose what to take.
  - `agents/`: the four reviewers, written once: `slop-checker`, `bug-hunter`, `code-reviewer`,
    `design-reviewer`.
- `.claude/`, `.codex/`, `.cursor/`, `.gemini/`, `.github/`, `.opencode/`, `opencode.json`: what
  each tool reads, generated from the above by `bin/adapters`. Never edited by hand.
- `bin/install`: installs what the kit needs on a Mac. `bin/new-project`: makes the folder it runs
  in a project, or joins the kit to code that is already there. `bin/join-project`: brings a
  teammate's shared project onto this Mac. `bin/update-project`: moves a project made with an older
  kit to the current layout, keeping everything the project wrote. They stay in the kit; projects
  do not get a copy.
- `project/`: where the kit writes: `PROJECT.md`, `TASTE.md`, `DECISIONS.md` and the output folders.
- `dev/`: notes and tests for working on the kit itself. Projects do not get a copy.
- `THIRD-PARTY-NOTICES.md` and `licenses/`: where the borrowed skills come from and their licences.

## Two rules this kit follows closely

**No explanations in code.** A comment is a short section title, a tool directive, or a license
header. Reasons go in the commit message or the project folder. The gate refuses anything else.

**Taste beats skills.** `project/TASTE.md` is the decided look. When a skill's style advice
disagrees with it, the skill loses.

## Where it came from

Trimmed from [unicorn-skills](https://github.com/hulusi-tunc/unicorn-skills), whose repository went
private in September 2026; its fourteen skills are the kit's own since. Borrowed skills come
from [anthropics/skills](https://github.com/anthropics/skills),
[vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills),
[Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) and
[yetone/kill-ai-slop](https://github.com/yetone/kill-ai-slop), installed with
[vercel-labs/skills](https://github.com/vercel-labs/skills). The gate, the reviewers, the
workflows, the hook script, the scripts in `bin/` and the two-repo layout are this kit's own.
