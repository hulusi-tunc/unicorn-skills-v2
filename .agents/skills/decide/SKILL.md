---
name: decide
description: Turn a decision into a page people click instead of a wall of questions. Directions side by side, decision cards, a keep/fix/cut grid or an image pick; the team votes and adds ideas, the answers come back into DECISIONS.md.
argument-hint: "[what is being decided]"
---
# /decide

Nineteen questions in a terminal went unanswered; the same nineteen as cards were answered in ten
minutes. A page is for choices people see, not for every question.

## Page or chat
- One or two questions in words: ask in the chat, one yes or no each (`AGENTS.md` "Replies").
- Three or more decisions, or anything visual (directions, versions, layouts): a page.
- Choosing between images (generated art, photos): the pick page.
- Judging built screens: the verdict grid, from real screenshots.

## The four pages
- **Directions**: what exists now, then two or three directions side by side, each with real
  content at phone and desktop size. The designer picks; sharing the page for input is optional.
- **Decision cards**: one card per decision. A picture on top, the question in under 15 words, one
  line on what it decides, two to four choices, one marked Suggested with a one-line why, and an
  "Or say it your way" box. At most seven cards.
- **Verdict grid**: Keep, Fix or Cut and a note per screen or plan item.
- **Pick**: one row per item, options side by side, "None, make more". Nothing generated ships
  until a person picked it.

`templates/decide.html` in this skill is a working decision page: cards from a data array, votes
per person, ideas with +1, comments. Copy it, replace the data, keep the structure.

## Where it lives
- An agent that can publish a shared page with per-person storage: publish it with that storage
  (each person writes only their own vote, everyone reads all) and comments, shared so the team can
  answer, not only view.
- Any other agent: the same file in `project/decisions/<topic>/index.html`, opened in the browser;
  its "Copy answers" output is pasted back into the chat.
- Either way the source is committed in `project/decisions/<topic>/`.

## Rules
- Pictures, not essays: under 500 words on the page; long reasoning goes in a file it links.
- Open with two plain sentences: what this is and what to do. Someone who missed the meeting
  understands it.
- Only big questions. No "accept all suggestions" button: people choose.
- A new round is a new version with "what changed from your notes" at the top, never an edit of
  the page people are answering.
- Check it at phone width before sharing.

## Reading the answers
Read every vote, note, idea and comment. Notes before choices: the words often change the pick.
Copy them into `project/decisions/answers/<topic>.json`, then one `DECISIONS.md` line per decision
with the choice, who chose it and their words. Answer comments in their thread, then resolve them.

## Output
The link, one line on what it asks, and who must answer.
