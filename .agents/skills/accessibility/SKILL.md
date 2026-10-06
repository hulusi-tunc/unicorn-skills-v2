---
name: accessibility
description: Accessibility for screens, WCAG 2.2 AA: keyboard and focus, touch targets, colour, 200% text, reduced motion, flashing, labels, alt text, errors. Use when building or reviewing UI or motion.
---

# Accessibility

WCAG 2.2 AA is the floor. shadcn parts (Base UI or Radix) carry the keyboard and ARIA behaviour: wrap them in
`DS<Part>`; never build a control from a `div` with `onClick`.

## Keyboard and focus
- Every task works by keyboard alone, in reading order: DOM order matches visual order (no CSS
  `order`, no positive `tabIndex`). Nothing works only on hover.
- Focus always shows: a field by its border colour (`--border-focus`, 3:1 against field and page);
  buttons and links by a ring (`--focus-ring`) on `:focus-visible` only. Never `outline: none`
  without one of these.
- A sticky bar never covers the focused element (2.4.11): `scroll-padding` from the bar's height token.
- A dialog takes focus on open, returns it to the trigger on close, and is the only focus trap. A
  deleted item hands focus to its neighbour.
- "Skip to main content" is the first focusable element, visible when focused.
- Hover popups close with Escape and stay while hovered (1.4.13); nothing essential lives only in
  a tooltip.

| Part | Keys |
|---|---|
| Menu, select, combobox | Arrows move; Enter picks; typing jumps; Escape closes, focus returns |
| Tabs, radio group | One Tab stop; arrows switch |
| Dialog | Tab cycles inside; Escape closes |
| Checkbox, switch, accordion | Space toggles (accordion also Enter, with `aria-expanded`) |
| Form | Enter submits; errors focus the summary, which links to each field |
| Drag and drop, carousel | Visible buttons too (move; previous, next); position announced |

Mobile: every `Pressable` gets `accessibilityRole`, `accessibilityLabel` if it has no visible
text, and `accessibilityState` (selected, checked, disabled, expanded).

## Touch and gestures
- The kit's target: 44 by 44 for every tap target (CSS px; pt and dp on mobile), 8px apart. WCAG
  2.2 AA's floor is 24 by 24 (2.5.8); only a link inside a sentence goes below 44.
- A control drawn smaller (icon button, `--control-sm`) gets a bigger hit area, not a bigger look:
  padding or a pseudo-element; `hitSlop` on mobile. List rows are tappable whole.
- Act on release, not press (2.5.2). Destructive actions sit away from frequent ones, with undo or
  a confirmation.
- Gestures are shortcuts: swipe, drag (2.5.7), pinch, double tap, long press, shake and
  multi-finger gestures each have a visible button.
- Never disable zoom (no `maximumScale` or `userScalable` in Next's `viewport`) or paste. Sliders get a
  text field; date pickers accept typed dates.

## Colour and contrast
- Text, placeholder included, 4.5:1; large text (1.5rem, or 1.17rem bold) 3:1; field borders,
  icons, focus indicators, chart marks 3:1 against neighbours (1.4.11). Check both halves of every
  `light-dark()` pair.
- Colour never carries meaning alone (1.4.1): status is dot, icon and word; a field error is
  border, icon and message; a chart uses line styles or patterns with direct labels, not a swatch
  legend; links in running text are underlined; badges carry a word ("Overdue").
- Never red against green as the only difference; blue and orange is the safest pair.
- Greyscale test: every status, error and chart still reads.
- `/tokenize` step 6: status colours are made to sit beside an icon and a word.

## Text size and reflow
- Font sizes are the rem tokens, never px; never change the root size (no `62.5%`).
- Floors: body 1rem, smallest text 0.875rem. Unitless line height: body 1.5 or more, headings 1.2
  to 1.3.
- Layout survives user spacing (1.4.12): line height 1.5, paragraph spacing twice the size, letter
  spacing 0.12em, word spacing 0.16em.
- Text sits in `min-height` boxes, never a fixed height; nothing clipped, overlapped, or truncated
  without a way to read all of it.
- At 200% text and 320 wide (`/design-screen` step 8): no sideways scroll except a table, map or
  diagram in its own box; sticky bars stay small; dialogs scroll inside.
- Web: never lock orientation (1.3.4).
- Mobile: Dynamic Type and Android font scale to 200%; never `allowFontScaling={false}`.

## Motion
- Durations and easing come only from the motion tokens (`--duration-*`, `--ease-out`; mobile
  `motion.ts`, Reanimated), all 0ms under `prefers-reduced-motion: reduce`. Anything off the tokens
  (`@keyframes`, Tailwind `animate-*`, a library's timing) checks the preference itself.
- Under reduce: state changes are instant; no parallax, scroll effects, autoplay or shimmer. A
  loading indicator may keep turning (it carries state).
- Never: flashing over 3 times in any second (2.3.1), large-area flashing at any rate, strobing.
- Vestibular triggers, avoided even without the preference: parallax, scroll-jacking, zooming or
  sliding the whole viewport, spinning, large areas moving at once, background video. Prefer
  opacity and colour to movement.
- Nothing with motion autoplays; video opens on a still poster. Anything moving by itself for over
  5 seconds has a visible pause (2.2.2).
- Carousels never auto-advance unless `DECISIONS.md` says so; then they pause on hover and focus.
- Mobile: `AccessibilityInfo.isReduceMotionEnabled()` (Reanimated `useReducedMotion()`) sets every
  `motion.ts` duration to 0.

## Content
- Alt text says what would be lost without the image. Decorative: `alt=""`; an icon beside its
  label: `aria-hidden`. Functional: the action ("Search"). Informative: the information ("3 unread
  messages", not "Red circle"). Chart: its takeaway, plus a table or summary on the page. Never
  "Image of"; no images of text. Mobile: `accessibilityLabel` on informative images only.
- Headings: one `h1`, matching the page title; no skipped level going down; they name the content
  ("Choose a delivery date", not "Step 3"). Landmarks `header`, `nav`, one `main`, `footer`;
  navigation in the same place on every page (3.2.3); more than a few pages: two ways to each
  (navigation plus search, a sitemap or related links, 2.4.5). Mobile: `accessibilityRole="header"`.
- Data tables: `th` with `scope`, and a caption. Video has captions; audio a transcript.
- Links name the destination, never "click here", "read more", "learn more". A file link gives type
  and size ("Annual report (PDF, 3 MB)"); a new tab says so. A link navigates, a button acts.
- Fields: a visible label above, never the placeholder, with the format ("Date of birth
  (DD/MM/YYYY)"). Mark the optional ones; `required` on the rest. Radio groups and checkbox sets in
  `fieldset` with `legend`. Help text by `aria-describedby`. `autocomplete` on personal data
  (1.3.5). Never ask again for what the flow has (3.3.7); paste and password managers always work
  (3.3.8). Icon-only buttons get `aria-label`.
- Errors: check a field when it is left, then live once it shows an error; never clear input;
  accept any reasonable format. The message sits under the field (`aria-describedby`,
  `aria-invalid`), naming the fix: "Enter the date as DD/MM/YYYY, for example 15/03/2026". Never
  blame. Wording: `no-slop`'s UX writing.
- Plain words, one idea a sentence; buttons, labels and errors at a grade 4 to 6 reading level.

## Feedback and status
- Every status is announced, through a live region that exists before its message: `role="status"`
  for progress and confirmations, `role="alert"` only for a blocking error. A moved or added item
  is announced in words. `aria-busy` on a region while it loads.
- Toasts only confirm something with nothing left to do: 5 seconds or more, paused on hover and
  focus. A toast with an action (Undo, Retry) or an error never auto-dismisses; errors go inline
  and stay until fixed.
- Time limits warn first and can be extended (2.2.1); an expired session keeps what was typed.
- Mobile: `AccessibilityInfo.announceForAccessibility()`; `accessibilityLiveRegion` on Android.

## System preferences
Follow the system; never ask for the same setting again in the app.

| Preference | Detect (web; mobile) | Response |
|---|---|---|
| Reduced motion | `prefers-reduced-motion`; `isReduceMotionEnabled()` | Motion section |
| More contrast | `prefers-contrast: more` | Solid borders for shadows and tints; no transparency |
| Forced colours | `forced-colors: active` | Controls keep a border (a transparent one shows here); state never by background alone |
| Reduced transparency | `prefers-reduced-transparency`; `isReduceTransparencyEnabled()` | Opaque surfaces, no blur |
| Dark | `light-dark()` tokens; `useColorScheme` | Follows the system (a manual switch is a `DECISIONS.md` line); images, charts checked in both |
| Font size | rem tokens, zoom; Dynamic Type | Text size section |

Test each alone, then all together.
