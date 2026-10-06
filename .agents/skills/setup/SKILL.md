---
name: setup
description: Once per project. Ask until the bare minimum is known, write it down, scaffold the app in its own repo, and install the tooling that refuses slop.
argument-hint: "[one line about the project, e.g. 'habit tracker, mobile, calm and quiet']"
---
# /setup

One pass from rough idea to working two-repo project, so no later session asks again.

`./bin/new-project` exists: this is the kit. Stop. Tell the user: make a folder named after the
project, open their AI agent there and give it this kit's link. (Setup here would copy one project into every
future one.)

`.designkit/workspace.json` has `"joined": true`: the project's code already existed. Read `joined.md`
beside this file and follow it instead of the steps below.

## Bare minimum (all six before finishing; the rest may be marked guesses)
1. What it is, for whom (one or two sentences).
2. Web, mobile or both; if both, which ships first.
3. Two or more products whose look they like, or "pick for me".
4. One or more looks to avoid, or yes to the `no-slop` defaults.
5. The first screen.
6. The kind of project and its Jira key: front end only (devs take over at handover), A to Z (we
   also build the back end and take it to release), or 90% (devs join and finish). Read both from
   the brief or WBS first. Write them to `.designkit/workspace.json` as `"type"` and `"jira"`; no
   Jira project means no key.

## 0. Folders
Read `.designkit/workspace.json` (`name`, `app` = `<Name>-app`, a folder inside this one). Missing:
write `{"name": "<this folder's name>", "app": "<Name>-app"}` and add `/<Name>-app/` to `.gitignore`.
Then ensure:
- App is its own git repo: `<app>/.git` exists, else `mkdir -p <app>` and `git -C <app> init -q -b main`
  (not `rev-parse`: inside this folder it finds this repo and wrongly succeeds).
- `git -C <app> config designkit.docs ..`
- No `.designkit/scripts/node_modules`: `npm ci --prefix .designkit/scripts --no-audit --no-fund` (gate
  parser; without it the gate uses simpler checks).
Code work happens in the app; every file written below goes here.

## 1. Kit current?
Before any question: `node .designkit/scripts/check-upstream.mjs` (watches the 6 borrowed skills).
- "Everything is current" or "Could not check": one line, continue. Never block on the network.
- Changes: read every diff. Report one line per skill in plain words plus advice:
  **Take it** (fix, clearer guidance, fitting new check); **Skip it** (restores something removed on
  purpose: client sign-off, Figma writes, comments in code; or clashes
  with `AGENTS.md`/`TASTE.md`); **Your call** (real trade-off, state the cost). Note that
  `kill-ai-slop` changes alter the gate.
- One question, several answers allowed (the tool's question picker if it has one). Then `--apply <names>` for chosen, `--skip <names>` for the
  rest. Apply updates this project and the kit, ends with the gate self-test; failure: stop, report.
- Log each decision in `DECISIONS.md` once it exists (step 6).

## 2. Read inputs
`project/brief/` and what the designer said with the request. Figma URL: read with `figma-implement-design-new` for structure
and content, not styling. Do not ask what these already answer.

## 3. Ask
One round of up to four questions (the tool's question picker if it has one), only for missing
minimum items; a sensible default as
the first option. Frame the first as the problem, naming no solution: what is broken, for whom, and the evidence
(seen or heard, not guessed). Write the problem and one success measure ("a habit logged in under
ten seconds") into `PROJECT.md`; a measure they did not give is a guess. If only one is asked,
ask for references. Still missing after answers: one short round for those items only. Beyond the
list never ask: guess and log under `## Assumptions`.

In the same call if slots remain, else one more: "Will anyone else work on this project?" (first
option "Just me for now", second "Yes, share it on GitHub"), and, only if `git config --global
user.name` is empty, their name for the work history (first option the Mac's account name,
`id -F`). Set it with `git config --global user.name`. Email empty: the GitHub no-reply address
when `gh api user --jq '"\(.id)+\(.login)@users.noreply.github.com"'` works, else
`<id -un>@<hostname -s>.local`; never ask for it.

## 4. Build in the background (skip if the app has `package.json`)
The platform is known now, so the slow part starts while the taste work goes on. If the tool can run a
helper agent in the background, launch one (general purpose, a fast model) with this prompt:
> Follow `<this folder>/.agents/skills/setup/build.md` exactly, with app
> `<app, absolute>`, name `<Name>`, platform `<web|mobile>`. Write files with the file tools, run
> commands in the app. Never ask a question. Reply with one short list: each step done, and any
> failure with its output.

Both platforms: build the one shipping first; log the other in `DECISIONS.md`. Continue with step 5
at once; do not wait, do not mention the helper unless it fails. No background helpers in this
tool: carry out `build.md` yourself after step 6.

## 5. Taste profile
Not a list of products. Per reference, name what does the work: surfaces, colour use, type
personality, density, how hierarchy is carried, the focal element. Keep what repeats; one-offs are
noise. Each rule must be followable ("near-monochrome surfaces, one accent carries all colour"); never
"clean and modern". Cite sources; mark single-source rules low confidence.

## 6. Write
- `project/PROJECT.md`: what, who, the problem and one success measure, platform and framework, what ships first, first screen,
  `## Screen sizes`, `## Repos` (both folders; dev team clones only the app), `## Assumptions`.
  `## Screen sizes`: the kind of project and the sizes designed, each with a one-line why from the
  brief; no new question. Mobile app: none, only larger text and safe areas are checked. Website or
  landing page: phone, tablet, laptop and wide, always. Web app (a dashboard, a tool): the sizes the
  brief names; none named: laptop and wide, logged under `## Assumptions`. Web and mobile: each
  part by its own kind. The designer can overrule it any time.
- `node .designkit/scripts/skills-for.mjs <web|mobile|both>`: the project keeps only its platform's
  guides.
- `project/TASTE.md`: `## Do` (3 to 6 rules with sources), `## Never` (anti-patterns incl. confirmed
  `no-slop` defaults). Last line: *Edit this by hand any time. It outranks every skill's own style advice.*
- `project/DECISIONS.md`: today's date, one line per decision with reversal cost: platform,
  framework, what ships first, two-repo layout, tooling skipped.

## 7. Finish the app
Wait for the helper's report first; never summarise around it. A failure: fix it in the app (`build.md`
says what each step must leave behind), then continue.

Delete every explanatory comment the generator left, configs included (Expo `index.ts` has three,
Next `eslint.config.mjs` two), then `npm run format`. Web: replace the generator's start page
(`src/app/page.tsx`) with one heading holding the project's name; it is full of raw colours and
made-up sizes, and the first screen replaces it anyway.

`README.md` for the dev team, replacing the generator's: project in one line, stack, install, run,
build, lint, test, folder map (the "App structure" and "Data" folders in `AGENTS.md`, one line each;
`src/api` and `docs/api/contract.md` arrive with the first screen that shows data, and the map says
that the mock behind `src/api/client.ts` is what the real server replaces). No design prose.

All three green, report each: `npm run lint`, `npm run dead`, and from here `node .designkit/scripts/slop-gate.mjs`.
Then `node .designkit/scripts/quick-check.mjs --time`. Write the steps that passed in 60 seconds or
less, each `{ "name", "run" }`, as `quickCheck` in `.designkit/workspace.json`; a slower step gets a
`DECISIONS.md` line (it runs in reviews instead).

## 8. Commit both repos
Per `/commit`. New files: `git ls-files --others --exclude-standard`, read, add by name.
App: `chore: scaffold <stack> with lint, format, knip and the slop gate`. Docs: `docs: set up <Name>`.
After the app commit, write `project/reviews/STATUS.md` exactly so, and include it in the docs commit:
```
# Status

Last review: none yet
Reviewed up to: <app HEAD, short>

## Open

## Left on purpose
```

## 9. Share (only on "Yes, share it on GitHub"; later too, whenever they ask)
Both repos private: this folder as `<Name>`, the app as `<Name>-app`.
This folder already has a GitHub home (`git remote get-url origin` succeeds, as when the project
started in an empty repository): create only the app's repository, and keep the folder's.
- `gh auth status` succeeds: `gh repo create <Name> --private --source . --remote origin` and
  `gh repo create <Name>-app --private --source <app> --remote origin`. A name taken: add `-design`
  or `-app2` and say so.
- Else: ask the designer to make two empty private repositories on github.com with those names (no
  README) and paste both links; `git remote add origin <link>` in each.
Then, if `.designkit/workspace.json` has `"share": false` (the project started in an empty
repository), set it to `true` and commit that. Then `node .designkit/scripts/team-sync.mjs --share`.
Tell them: to bring someone in, give them access
to both repositories and the `<Name>` link; their agent joins with it. "Just me for now": log it in
`DECISIONS.md` (reversal cost: none, share any time).

## 10. Next
Point to `/tokenize` (TASTE.md into tokens), then `/design-screen` for the first screen. Stop; do
not design in this run.

## Output
Chat: a short plain list of what each file says and what the gate refuses. Not the files.

