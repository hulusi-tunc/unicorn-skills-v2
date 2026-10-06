---
name: emil-design-eng
description: Motion and polish: whether to animate, easing and duration from the motion tokens, press feedback, popovers, tooltips, interruption. Use for any animation or transition work.
---

# Motion and polish

Pair every motion change with the Motion section of `accessibility` (flashing, vestibular triggers,
autoplay). `project/TASTE.md` outranks this guide. Web: CSS transitions on the motion tokens first;
an animation library only by a `DECISIONS.md` line. Mobile: Reanimated, never framer-motion.

## 1. Should it animate at all
Decide by how often a person sees it:

| How often | Motion |
|---|---|
| Hundreds of times a day: shortcuts, command menu, arrow keys through a list | None |
| Tens of times a day: hover, tabs, row selection | Colour change on `--duration-quick`, or none |
| Now and then: dialogs, drawers, menus, toasts | Standard, below |
| Rarely: first run, a long task finishing | May do more, still on the tokens |

- Anything opened or done from the keyboard does not animate.
- Every animation has a job: show where something came from or went, show a state change, answer a
  press, or soften a jump that would otherwise jar. "It looks nice" on something seen often: none.
- Entrance choreography on load (staggered rows, sections fading up) is decoration: none unless
  `TASTE.md` or `DECISIONS.md` asks for it.

## 2. Easing and duration: the tokens only
`/tokenize` writes these into `src/tokens/motion.css` (mobile: the same set in
`src/tokens/motion.ts`). The values are the defaults; `TASTE.md` may change values, never names.

| Token | Default | For |
|---|---|---|
| `--duration-quick` | 120ms | press, hover and colour, toggles, checkboxes, tooltips |
| `--duration-medium` | 200ms | dropdowns, selects, popovers, toasts, small expands |
| `--duration-slow` | 300ms | dialogs, drawers, sheets |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | enter, exit, press, colour: the default |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | something already on screen moving or changing shape |

- Exit is quicker than enter: one token shorter (`slow` leaves on `medium`, `medium` on `quick`),
  same curve. The person is waiting for the system; it should get out of the way.
- Never `ease-in` (the slow start reads as lag), never the browser's `ease` or Tailwind's stock
  curve, `linear` only for spinners and progress bars.
- Never a number: no `duration-200`, no `300ms`, no `cubic-bezier` outside the token file. Nothing in
  UI runs longer than `--duration-slow`; a longer explanatory animation on a marketing page is a
  `DECISIONS.md` line.
- Web: in `globals.css` `@theme`, set `--default-transition-duration: var(--duration-quick)` and
  `--default-transition-timing-function: var(--ease-out)`, so a bare `transition-colors` follows
  the tokens. Elsewhere `duration-(--duration-medium) ease-(--ease-out)`, or `var()` in CSS.
- shadcn parts ship their own `duration-200`, `animate-in` timings and `transition-all`: fixed values
  outside the tokens. The `DS<Part>` wrapper overrides them with token classes; never edit
  `src/components/ui`.

## 3. Reduced motion
- Under `prefers-reduced-motion: reduce` every duration token is `0ms`: things appear, leave and
  change at once. Anything built on the tokens obeys by itself; anything off them (`@keyframes`,
  `animate-*`, a library default) checks the preference itself, or it is a bug. A spinner may keep
  turning: it carries state.
- 0ms means 0ms. Do not add an opacity-only fade back for reduced motion; a gentler substitute is a
  `DECISIONS.md` choice, not the default.
- Never wait for `transitionend` to unmount, move focus or load the next step: at 0ms it never fires.
- Mobile: Reanimated follows the system setting by default (`ReduceMotion.System`); never pass
  `ReduceMotion.Never`. Outside Reanimated, read `useReducedMotion()` and use 0.

## 4. Patterns
- **Press.** Every pressable shrinks slightly while pressed: `active:scale-97` with
  `transition-transform` on `--duration-quick` and `--ease-out`, set once in the `DS<Part>`. Mobile:
  a Reanimated shared value on press in and out, same token.
- **Enter.** Never from `scale(0)` or from nothing: start at `scale(0.95)` with opacity 0. Slide by
  the element's own size (`translateY(100%)`), never a pixel distance.
- **Origin.** Popovers, menus, selects and tooltips grow from their trigger: `transform-origin` from
  the library's variable (Base UI `--transform-origin`, Radix `--radix-<part>-content-transform-origin`;
  shadcn usually sets `origin-(...)`: keep it, add it where missing). Dialogs are not anchored to a
  trigger and stay centred.
- **Tooltips.** A delay before the first one opens, so a passing pointer opens nothing; while one is
  open, its neighbours open at once with no animation. The library does this with one tooltip
  provider around the app and its delay settings; a delay of 0, or a provider per tooltip, breaks it. Touch has no hover: nothing important lives only in a tooltip.
- **Hover** motion only where a pointer can hover. Tailwind's `hover:` already checks; plain CSS
  wraps it in `@media (hover: hover) and (pointer: fine)`.
- **Enter without JavaScript** on web: `@starting-style` with a transition, not a `useEffect` that
  sets `mounted`.
- **Swipe to dismiss** (mobile sheets, toasts): a quick flick counts, not only distance; dragging past
  an edge meets growing resistance, never a hard stop; a visible button does the same thing.

## 5. Smooth and interruptible
- Animate `transform` and `opacity` only. Never `width`, `height`, `top`, `left`, `margin` or
  `padding`, and never `transition-all`: name the properties. A collapsible's height is the one
  exception, through the library's measured height variable (Base UI `--accordion-panel-height`),
  never measured by hand.
- Anything that can be toggled quickly (menus, toasts, switches) uses transitions, which turn around
  mid-way; keyframes restart from the beginning.
- Mobile: `withTiming` and `withSpring` start from the current value, so a new target interrupts
  cleanly. Springs only for motion a gesture drives (drag, swipe release), with little or no bounce.
  Web: no springs.

## Review checklist
- Seen hundreds of times a day, or triggered from the keyboard, and still animates.
- A number where a token belongs: `duration-200`, `300ms`, a `cubic-bezier`, a library default.
- `ease-in`; `ease` or `linear` on UI; anything longer than `--duration-slow`.
- Exit as slow as enter, or slower.
- `transition-all`, or a layout property animating.
- Entry from `scale(0)`; a popover or menu growing from its centre (dialogs excepted).
- A pressable with no press feedback.
- Keyframes on something toggled quickly.
- Hover motion without the hover check.
- Under reduced motion: anything but a spinner still moving, a fade added back, `transitionend` relied on.
- Tooltip delay of 0, or each tooltip waiting again after the first is open.
- Load decoration (stagger, fade-up sections) that `TASTE.md` or `DECISIONS.md` did not ask for.
