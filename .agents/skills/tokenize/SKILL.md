---
name: tokenize
description: Stand up design system foundations from TASTE.md: tokens in the W3C format, type scale, colour, spacing, with adaptive checks, then the platform token file in the app.
argument-hint: "[extra context, e.g. 'brand blue #0044CC, dark mode first']"
---
# /tokenize

## Steps
1. **Direction first**: read `project/TASTE.md` (if missing, stop and run `/setup`) and name the
   visual direction before any token locks it in.
2. **Token architecture**: three tiers. Primitives hold values; semantic tokens name a role
   (`--text-muted`) and point at a primitive; a component token only when one part needs its own.
   Parts and screens read semantic tokens only. Dark mode lives in the semantic tier: each written
   once with `light-dark()` over primitives that never change; a part needing its own dark value
   means a role is missing. Names: primitive colours by hue and step (`--accent-600`), alpha as a
   suffix (`--accent-600-a30`); shadows by use (`--shadow-card`), their colour taken from a colour
   token through `color-mix()`; layers by use (`--z-dropdown`, `--z-modal`, `--z-toast`); motion by
   use (`--duration-quick`, `--duration-medium`, `--duration-slow`, `--ease-out`, `--ease-in-out`, values in
   `emil-design-eng`); control heights by size (`--control-sm`, `--control-md`).
3. **Colour**: palette and semantic mapping with `ui-design`. Check contrast as you go. Focus: a
   field shows it by its border colour for focus (`--border-focus`, 3:1 against the field and the
   page); buttons and links show a ring (`--focus-ring`) for keyboard focus only.
4. **Typography**: the modular scale with `ui-design`.
5. **Spacing**: the base-unit scale with `ui-design`.
6. **Adaptive check**: colour independence and flexible typography with `accessibility`.
7. **Into the app**: read `.designkit/workspace.json`, then write the token files the code imports,
   values only, following "No comments in code" in `AGENTS.md`.
   - Web: `src/tokens/colors.css`, `spacing.css`, `radius.css`, `shadow.css`, `type.css`,
     `z-index.css`, `motion.css`, `height.css` and `breakpoint.css`, each imported from
     `src/app/globals.css`. `breakpoint.css` restates the five widths in an `@theme` block:
     `--breakpoint-sm: 40rem` (640px), `md` 48rem (768px), `lg` 64rem (1024px), `xl` 80rem (1280px),
     `2xl` 96rem (1536px); `sm:` to `2xl:` are then the only widths a layout changes at. In
     `motion.css`, every duration drops to `0ms` under `prefers-reduced-motion: reduce`; the
     `@theme` in `globals.css` sets `--default-transition-duration` and
     `--default-transition-timing-function` to the quick duration and `--ease-out`. Each semantic
     colour written once as `light-dark(<light>, <dark>)`, with `color-scheme: light dark` on `:root`.
     Spacing, radius, shadow and heights in px; type sizes in rem, so they follow the reader's
     font-size setting. Then point the library's variables in `globals.css` (`--background`,
     `--primary`, `--radius`...) at the tokens, delete its generated values and its `.dark` block,
     and delete its `@custom-variant dark` line so `dark:` follows the system like `light-dark()`
     does. A manual theme switch is a decision for `DECISIONS.md`, not the default. Where tokens
     cannot be read, a colour is copied as its value and the gate leaves it alone: Next's
     `themeColor`, the `manifest`, social and icon images.
   - Mobile: `src/tokens/colors.ts`, `spacing.ts`, `radius.ts`, `shadow.ts`, `type.ts`,
     `zIndex.ts`, `motion.ts`, `height.ts`; colours as `{ light, dark }` pairs read through
     `useColorScheme`. No breakpoints: a phone app has none.
   Style Dictionary v5 can generate these files from the token file when the project grows; do not
   add it until then.

## Output
In this repo, `project/design-system/tokens.tokens.json` in the W3C Design Tokens format (`$value`,
`$type`, `$description`, dot-path aliases) so Figma, Tokens Studio and Style Dictionary all read it,
plus `system.md` covering direction, naming, usage rules and accessibility notes. In the app, the
token files. Update `project/DECISIONS.md`.
