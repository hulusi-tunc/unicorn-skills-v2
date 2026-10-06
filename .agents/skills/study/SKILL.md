---
name: study
description: Study 10 to 15 real flows from products in the same category before choosing a direction, and turn what wins into measurable taste rules. Runs before /tokenize on a new product or a redesign.
argument-hint: "[the product category or the flow to study, e.g. 'meal planner onboarding']"
---
# /study

A moodboard teaches nothing; a studied flow does. Collect the whole flow, judge it, write what it
teaches and what that means here.

## Steps
1. **Collect** 10 to 15 complete flows (all screens of onboarding, checkout, a lesson), from
   products in the same category, with the Mobbin tools if connected, else screenshots the designer
   gives. Same category first; one or two from outside it only for a specific idea. Download every
   image into `project/study/img/`: Mobbin links expire after 30 days.
2. **Judge** each flow in `project/study/flows.json`:
   `{ "app", "flow", "verdict": "hero" | "keep" | "park" | "kill", "lesson": one sentence on what it
   does well or badly, "forUs": one sentence on what it means for this product, "files": [...] }`.
   Kill and an "against" lesson count as much as a hero: they say what to avoid.
3. **Show** it with `/decide` as a gallery page filtered by verdict, so the designer and anyone they
   share it with can change verdicts and add notes. Under 500 words on the page.
4. **Rules.** Read the heroes and kills together and write the taste rules into `TASTE.md`. Each
   rule is measurable (a value with its unit, a hex, or a concrete Never like "Never a dark
   sidebar"), has at least two flows behind it, and is under nine words. A rule nothing measures is
   not a rule; leave it out.

## Output
The gallery link, the hero count, and the three strongest rules it produced.
