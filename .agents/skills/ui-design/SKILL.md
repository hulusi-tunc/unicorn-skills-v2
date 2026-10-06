---
name: ui-design
description: Visual foundations for tokens and screens: colour roles and contrast, modular type scale, spacing, grid, breakpoints, hierarchy, dark mode. Charts in references/charts.md.
---

# UI design

Foundations for `/tokenize` (colour, type, spacing) and `/design-screen` (grid, hierarchy, screen
sizes, dark mode). `project/TASTE.md` outranks everything here; this fills its gaps. A screen with a
chart: read `references/charts.md` first.

## Colour

- Neutrals: one grey ramp (50 to 950) for text, surfaces and borders, tinted as `TASTE.md` says.
- One accent, from `TASTE.md`, as a ramp (50 to 950). It marks the main action, selection and focus,
  little else. A second hue is a `DECISIONS.md` line.
- Status colours (error, warning, success) only for states the product has, taken from the same
  palette and toned to sit beside it; never the stock green, amber, red and blue set. Most messages
  need no colour. A status never rests on colour alone: a word or an icon carries it.
- Roles over ramps: page, raised and overlay surfaces; text and muted text; border and focus
  border; accent fill, text on accent, accent hover; each status as needed. Screens and parts use
  roles, never a ramp step, so dark mode switches them all.

Contrast floors, checked for every pair actually used, as you go:

| Pair | Minimum |
|---|---|
| Body, muted and placeholder text on its surface | 4.5:1 |
| Large text (1.5rem, or 1.17rem bold, and up) | 3:1 |
| Controls, icons, focus border against what is next to them | 3:1 |

## Type

A modular scale: ratio 1.25 from 1rem, each step rounded to 0.125rem (1.2 for a dense tool, 1.333
for editorial pages, if `TASTE.md` leans that way). Sizes in rem so they follow the reader's text
setting; spacing, radius and shadow stay in px.

| Style | Size | Line height | Tracking |
|---|---|---|---|
| Caption | 0.75rem | 1.5 | 0 |
| Small | 0.875rem | 1.5 | 0 |
| Body | 1rem | 1.5 | 0 |
| Subheading | 1.25rem | 1.5 | 0 |
| H3 | 1.5rem | 1.2 | 0 |
| H2 | 2rem | 1.2 | -0.02em |
| H1 | 2.5rem | 1.2 | -0.02em |
| Display | 3rem to 4rem | 1.1 | -0.02em |

- Four or five sizes carry a screen; needing more means the scale failed. Weights 400, 500, 600, 700.
- Body never below 1rem. Long reading: line height 1.75, 45 to 75 characters a line (`max-w-prose`).
- Headings step down on phones at a breakpoint token, never with vw-based fluid type: vw ignores the
  reader's text size.
- No uppercase letter-spaced labels (`dk-04`): a label stands out by size, weight or colour.
- One family for UI and body, a mono for code; a heading face only if `TASTE.md` names one. Numbers
  that line up in columns use `tabular-nums`.
- Test with the longest real string, from the `long` scenario.

## Spacing

Base unit 4px. Scale: 2xs 2, xs 4, sm 8, md 16, lg 24, xl 32, 2xl 48, 3xl 64. Related items sm to
md; separate sections lg to xl; page margins fixed per tier. Compact density (tables, dashboards) is
one step down, spacious (reading) one step up. No value off the scale.

## Grid and screen sizes

Breakpoints: 640 / 768 / 1024 / 1280 / 1536px (Tailwind `sm` to `2xl`, the app's breakpoint
tokens). Layout changes only there and stays fluid between. Design only the tiers `## Screen sizes`
in `PROJECT.md` lists; a mobile app has none, only larger text and safe areas.

| Tier | Range | Columns | Gutter, margin | Checked at |
|---|---|---|---|---|
| Phone | under 640px | 4 | 16px, 16px | 390px; 320px must not break |
| Tablet | 640–1023px | 8 | 24px, 24px | 768px |
| Laptop | 1024–1535px | 12 | 24px, 32px | 1280px |
| Wide | 1536px+ | 12 | 32px, 48px; content capped (`max-w-7xl`) | 1920 × 1080 |

- Everything sits on a column, or breaks it on purpose.
- When a tier runs out of room: drop a column, stack a row, move secondary content behind a toggle,
  or show the most used items and put the rest under "More".
- Hover only adds; every action works by touch and keyboard (targets and focus: the accessibility
  guide). Images get `srcset` (`next/image` on Next.js) and their own crop where the subject would
  be lost.

## Hierarchy

At most four levels per view: primary (page title, the one main action), secondary (section
headings, key content), tertiary (supporting text, metadata), quaternary (fine print, timestamps).
Exactly one primary action per view.

Reach for size and space first, then weight, then colour: 1.5x size or more between levels; more
space around means more importance; the accent goes to the primary action. Reading starts top left
in left-to-right languages. Squint test: blurred, the reading order still holds.

## Dark mode

A second design of the surfaces, not an inversion.
- Page near-black, never pure black; text off-white, never pure white (it glows).
- Elevation from lighter surfaces (page, raised, overlay), not stronger shadows.
- Accent desaturated 10 to 20%; borders a light grey at low alpha. Re-check every pair's contrast,
  status colours above all.
- Each colour written once with `light-dark()` (mobile: a `{ light, dark }` pair); it follows the
  system. A manual toggle only with a `DECISIONS.md` line.
- No large bright areas: dim photos slightly; a logo needs a light-on-dark version.
