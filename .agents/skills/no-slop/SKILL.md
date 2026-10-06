---
name: no-slop
description: Judgment rules against the AI-default look, hype copy and boilerplate code. Apply while generating any UI, copy or frontend code; backs /slop-check and the reviewers.
---

# No slop

Slop is output that could belong to any product: not ugly, interchangeable. It is a defect, same
severity as broken; avoid it while writing, not after. `project/TASTE.md` outranks this guide; its
`## Never` holds this project's picks from "The AI-default look".

## Left to the gate
The slop gate checks every save and commit: house rules `dk-01` to `dk-11` (`AGENTS.md` "Slop") and
`kill-ai-slop`'s 35 tells (violet gradients, gradient text, glass, emoji, kickers, invented stat
rows, Inter everywhere, card in card). Write so it never fires; do not hand-check what it checks.
Below is what a pattern cannot see.

## The AI-default look
The `no-slop` defaults `/setup` offers for `TASTE.md`. Each needs a written, project-specific reason
to ship; "it looks clean" is not one.
1. **Generic hero.** Centred headline, subline, two buttons, glow or mock screenshot behind. Lead
   with the product's real content or main task.
2. **Three feature cards with icons in a row.** Rank them: the first gets space and real UI, the
   rest become a list.
3. **One box for everything.** Same size, radius and shadow on every card in a uniform grid. Much
   content sits straight on the page, divided by space or hairlines.
4. **Centred everything.** Left-align body text and sections; centre only one short focal item.
5. **Untouched shadcn.** Stock palette, radius, shadow, focus ring, toasts and dialogs. Retheme
   through the tokens (`/tokenize`) before the first screen; change looks in the `DS<Part>`.
6. **Magic for AI features.** Sparkles, rockets, wands, the icon set's `Sparkles` included. Show
   what it does: a summary, a draft, a search.
7. **Dark with neon.** Black page, cyan or purple glow, dot grid. Dark done right: tonal layers, one
   restrained accent.
8. **Decoration as hierarchy.** Blobs, noise, glow, big radius and shadow everywhere. Remove it; if
   nothing is lost, it was decoration.
9. **Landing-page furniture.** Testimonial row, pricing with "Most popular", FAQ accordion, logo
   wall: any two in sequence the brief did not ask for.
10. **Stat tiles.** Icon top left, big number, grey label, four across. Show the one number that
    matters, in context.
11. **Invented proof.** Testimonials, logos, user counts, ratings. None real: the page works
    without proof.
12. **Stock states.** Illustrated "Nothing here yet!", a lone centred spinner. An empty state says
    what goes here and offers the one action that fills it; loading keeps the content's shape.

## Obligations
- **Direction.** State `TASTE.md`'s direction in one sentence before the first element and hold
  everything to it. Fonts, colours and radii come from the tokens, never a guide's examples.
- **Type.** Two families at most, the token scale, one deliberate display moment per page.
- **One focal point** per screen, made with size, space or position, never decoration.
- **Real content.** Real headlines, labels and empty-state copy for the domain. Data comes from
  `@/api` scenarios with the names, amounts, dates and text lengths the domain really has. Sample
  people vary in name, age and situation, disability included naturally (`accessibility`); never
  "Sarah, 34, marketing manager".
- **Restraint.** Before calling a screen done, name three things left out (a second accent, icons,
  animation, cards). If you cannot, you collected defaults.

## Copy
| Instead of | Write |
|---|---|
| unlock, unleash, elevate, empower, supercharge, revolutionize, transform | what it does: "Export reports as PDF" |
| seamless, effortless, frictionless; simply, just, easily | the fact ("No setup needed"), or nothing |
| delightful, magical, beautiful, said of the product | nothing; show the feature |
| robust, powerful, cutting-edge, best-in-class | the capability: "Handles files up to 5 GB" |
| leverage, utilize, harness | use |
| streamline, optimize | the outcome: "Review an invoice in 2 minutes" |
| journey; dive in, explore | what it is: setup, first week; read, open, see |
| solution, ecosystem, platform, for an app | app, tool, or its name |

Never: "Welcome to the future of X", "Say goodbye to Y", "X, reimagined", "more than just X"; a
heading that asks ("Pricing", not "How much does it cost?"); exclamation marks in confirmations,
errors and empty states; a triad in every sentence; "Get started" on every button; "Learn more" or
"Click here" as link text.

- Sentence case for every heading, button, tab, tooltip and menu item.
- Buttons name the action: "Delete 3 files", not "Confirm". A destructive confirmation repeats the
  object: "Delete project" and "Cancel", never "Yes" and "No".
- Errors: what failed, why if known, what to do: "Couldn't save changes. You're offline: reconnect
  and try again." Offer retry when it can work. Never a bare "Something went wrong".
- Lengths: buttons 1 to 3 words, tooltips one sentence, toasts 10 words or fewer, empty states one
  sentence and one action, onboarding steps two sentences at most.
- Numbers, not adjectives ("Free for 14 days"); second person, active voice ("You can undo this").

## Code
- **Dead abstraction.** A factory, provider or interface around code used once: inline it; abstract
  on the second use.
- **Premature generic part.** A `GenericCard` with a dozen props for one screen. A part stays in its
  feature until a second feature needs it.
- **Copy-pasted variants.** `PrimaryButton`, `DangerButton` as near-identical files: one `DS<Part>`
  with a closed `variant` list (`cva`) of what `TASTE.md` allows.
- **`utils.ts` grab bag.** A helper sits beside its one user; on the second, a named file in
  `src/lib` (`format-currency.ts`).
- **Wrapper-div pyramids.** Every wrapper has a layout or meaning job; prefer `nav`, `section`,
  `main` or a DS part.
- **className soup.** Contradictions (`p-4 p-2`), one long string repeated on siblings, a value where
  a token exists. Resolve, then move the repeat into a part or variant.
- **Redundant state.** `isEmpty` beside `items`: derive it in render.
- **useEffect for everything.** Derived values compute in render, event responses go in handlers, an
  effect only syncs with something outside React. Name that system first, or write no effect.
- **Leftovers.** No `console.log`; no comment or TODO (`dk-05`, `dk-07`): the why goes in the commit
  body.

## Pre-ship check
Before calling a screen, copy block or part done. A yes on 1 to 4 or a no on 5 to 9 blocks until
fixed, or justified in `DECISIONS.md`.
1. Could this screen pass for any other AI-made product, or is anything from "The AI-default look"
   here (shadcn as installed included)?
2. Are testimonials, logos, metrics or people invented?
3. Does any copy use the words or constructions above?
4. Does the code hold a dead abstraction, className soup, redundant state, or an effect with no
   outside system?
5. Can you state the direction in a sentence, and does the screen visibly obey it?
6. Is the content real or true to the domain, in all five scenarios?
7. Can you name three things left out?
8. Do errors and buttons name the action and the remedy, in sentence case?
9. Is the gate clean on these files?

In a review a banned pattern is at least a warning; an AI-default look on a key screen blocks. The
reviewer's own table is the format.
