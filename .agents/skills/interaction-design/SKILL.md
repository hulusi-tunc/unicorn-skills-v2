---
name: interaction-design
description: The states every part and screen needs, and how loading, feedback and errors show: pressed, focus, loading, empty, error, success, optimistic updates. Used by /design-screen step 5.
---

# Interaction design

Which states a part or screen has and how each one shows. Durations and easing are not set here:
they come from `emil-design-eng` and the motion tokens (`--duration-*`, `--ease-out`).

## States per part

| Part | States |
|---|---|
| Button, link | default, hover (pointer only), pressed, focus ring (`:focus-visible`), disabled, loading (keeps its width, `aria-busy`) |
| Field | default, focus (`--border-focus`), filled, invalid (message below, `aria-describedby`), disabled, read-only |
| Toggle, checkbox, select | on, off, mixed where it applies, focus, disabled |
| Form | idle, submitting, success, error |
| Screen with data | one state per mock scenario, below |

Mobile: pressed instead of hover; focus is the screen reader's. Hold each state in one value
(`idle | loading | success | error`), never separate flags that let loading and error show at once;
every state has a way out.

## Data states

They come from the mock scenarios (`API_SCENARIO`), never from extra sample data in the screen:

| Scenario | Shows |
|---|---|
| `normal` | the content |
| `empty` | one sentence on what will be here and the one action that adds it; not an error tone |
| `long` | thousands: paging or a count; long text truncated, the full text still reachable |
| `error` | the message in place of the content, with a retry; the rest of the page still works |
| `slow` | the loading treatment below |

## Loading

| Wait | Show |
|---|---|
| Under 100ms | nothing |
| 100ms to 1s | keep the old content, or a skeleton |
| 1 to 10s | skeleton for a known layout; spinner inside the control for an action of unknown length; progress bar when progress is measurable |
| Over 10s | progress with a time estimate, and cancel or carry on in the background |

- A skeleton matches the content's size and shape, so nothing moves when it lands; its shimmer stops
  under reduced motion.
- A spinner is small, from the icon set, and has a text label for screen readers.
- One indicator at a time; never a blank screen. Keep the scroll position on refresh.

## Feedback

Answer every action at the closest place that works: inline next to it, then the part, then a toast
or banner, then a notification outside the app.

- Immediate (pressed, toggled, field checked): during the action.
- Confirmation: a toast. A plain one leaves after 5s or more and pauses on hover and focus; one that
  holds an action (Undo) or an error never auto-dismisses. Announced with `aria-live="polite"`.
- Status (pending, syncing, uploading): while it is true.
- Never colour alone: a word or an icon carries the state.
- A reversible action gets Undo, not "Are you sure?". A confirm dialog only for what cannot be undone.

## Errors

Prevent first: constrained inputs (a date picker over free text), sensible defaults, check a field
when it is left, then as they type once it has an error. Never clear what was typed.

| Where | Treatment |
|---|---|
| Form | message under each field, a summary at the top on submit, focus to the summary |
| Screen fails to load | in place of the content: what happened, what to do, retry |
| An action fails | at the action, or a toast with a retry that stays |
| No results | an empty state with a way forward, not an error |
| No access | say what access is needed and who grants it; how access works is the developer's |

Every message says what happened and what to do next, in plain words: no codes, no blame, never a
bare "Something went wrong".

## Optimistic updates

Only for actions that almost always succeed and are cheap to undo (like, toggle, reorder, rename):
show the result at once, settle it when the answer comes, and on failure roll back visibly and say
so at the action. Never for money, sending, or deleting.
