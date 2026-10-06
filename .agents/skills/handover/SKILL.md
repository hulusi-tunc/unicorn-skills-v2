---
name: handover
description: Hand the app to the dev team, or open UAT on an A to Z project, with nothing hidden. Full review, security pass, debt list, contract, QA pack and the dev list sent as one message.
argument-hint: "[nothing]"
---
# /handover

What the devs said about past handovers: no structure, only happy paths, invented details, AI
comments, giant files. This is the list that answers each one. Read `.designkit/workspace.json`
`"type"`: front end only hands over to the devs; 90% hands over what is built plus what is left; A to
Z has no handover and runs this before UAT.

## Steps
1. **`/check all`.** Verdict READY, or stop here with its three blockers.
2. **Security**, the rules that decide what counts:
   - A public identifier called a key is not a secret: publishable and anon keys may ship; secret
     and `service_role` keys never reach the browser or the repo.
   - A tenant or owner field is not isolation: every Supabase table has row level security, and no
     server client that skips it serves a request a user controls.
   - What API calls are possible but never made by the client? Each one is checked as if it were.
   - The whole history, not only today's files: `git log -p` through the commit check's patterns.
   - A missing extra layer is a note, not a blocker.
   Then `node .designkit/scripts/tools.mjs --suggest before-handover` and offer the security audit.
   Findings: confirmed (traced), needs checking (naming exactly what to check, for the dev), or
   rejected.
3. **Debt.** Every shortcut taken on purpose carries a `debt:` line in its commit body; list them
   with `git -C <app> log --grep '^debt:' --format='%h %s%n%b'` into `project/DEV.md` under
   `## Debt`. Nothing hidden counts as done.
4. **Contract.** `docs/api/contract.md` names every call in `src/api/client.ts` and, per screen, its
   calls and states. A call missing from it is a defect.
5. **QA pack.** `/testable pack`.
6. **The dev list.** `project/DEV.md` `## To send`, drafted as one numbered message for the designer
   to paste; meeting items marked. Argue in hours or cost, never taste.
7. **Record.** A dated handover line in `DECISIONS.md` (A to Z: "UAT opened"). From then on
   `.designkit/rules/handover.md` applies.

## Output
READY or not, the security findings that need the dev, and the message to send.
