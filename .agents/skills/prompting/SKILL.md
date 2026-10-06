---
name: prompting
description: Score yesterday's prompts in this project against the team rubric, show the designer their own report with three tips, and send the masked report to the gallery. Runs once a day when the chat start says it is due, or when asked.
argument-hint: "[a date, YYYY-MM-DD; defaults to yesterday]"
---
# /prompting

Coaching, not watching: the designer sees their own report first and every day; the studio owner
sees the team. Full prompts never leave this Mac; only scores and at most two short masked
examples do.

## Before the first report
`"prompting"` missing in `.designkit/workspace.json`: tell the designer in two sentences what is
scored, who sees it and what leaves the Mac, then one yes or no. Yes: set `"prompting": true`. No:
`false`, and never ask again.

On the first yes on this Mac (no `~/.designkit/prompting/history/`), score the whole history first:
`node .designkit/scripts/prompts-history.mjs --run` scores every past day in every project the
agent's history still holds (about the last 30 days), one report per project and day, masked the
same way; it runs in the background and takes about 15 seconds a day. Then `--send`. Tell the
designer in one line how many days were scored. After that, only the daily report below.

## Steps
1. `node .designkit/scripts/prompts.mjs --collect [date]`: the day's prompts in this project,
   already masked, with counted signals (corrections, files and images given, words). None: stop.
2. **Score** every prompt 0 to 5 on each line below, then average each line over the day:
   - `goal`: says what done looks like, not only what to do.
   - `context`: names the screen, file, user or data it is about; points to what exists.
   - `criteria`: says how to tell it worked (a state to see, a size, a behaviour, a check to pass).
   - `scope`: one change a review can judge; not five unrelated asks in one message.
   - `references`: gives a link, screenshot, file or example when the result is visual or exact.
   - `rounds`: few corrections after it ("no", "again", "still broken"); a reply that fixes the
     cause scores higher than one that only says it is wrong.
   A short reply to a question the agent asked ("yes", "the second one") is not scored.
   The six day averages keep one decimal (3.5); `overall` is their sum over 30, as a whole number
   0 to 100.
3. **Examples**: the day's best and worst scored prompt, each cut to 280 characters, each with one
   line on why. Run their text through `prompts.mjs --mask` before writing them down.
4. **Tips**: at most three, each one sentence under 200 characters, each naming the habit and showing the better prompt
   in a few words ("Say how it should look when it works: 'the list shows 20 rows and a count'").
   About the prompting, never about the person.
5. Write the report as `{ "version": 1, "date", "tool", "prompts", "sessions", "scores": {...},
   "signals": {...}, "tips": [...], "examples": { "best": { "text", "why" }, "worst": {...} } }`
   to `.designkit/state/prompting/report.json`, then `prompts.mjs --send <that file>`. One report
   per tool when the day used more than one.

## Output
To the designer, in four lines: the overall score and yesterday's, the strongest line, the weakest
line, and the one tip that would raise it most. Nothing about other people.
