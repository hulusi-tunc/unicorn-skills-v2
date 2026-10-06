# Responsive by kind, and the dev's playbook: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Projects design only the screen sizes their kind needs and check them at real widths; the
kit follows the dev's playbook: features by business job, exact wrappers, two new gate rules, a dev
list, his formatting, more token files, Node 22, and joins that keep the kit out of a dev's history.

**Architecture:** Mostly words in the kit's rulebook (`AGENTS.md`), its own workflow skills and its
reviewer sources, pinned by a new `dev/tests/rules/run.mjs` suite that reads each agreed rule back.
Code changes: two gate rules in `.designkit/scripts/slop-gate.mjs` (with probes), the update script
adopting a new rule only where the app already passes it, a `project/DEV.md` template placed in
every project, the installer's Node floor, and the join script detecting a repo a dev works in.

**Tech Stack:** Node 22+ ES modules, no dependencies beyond the gate's pinned TypeScript parser;
bash test suites; Markdown skills.

**Spec:** `dev/specs/2026-10-05-any-agent-responsive-peter.md`, sections 2 and 3 (R1 to R5, P1 to
P14). Section 1 is built (plan `dev/plans/2026-10-05-any-agent.md`).

## Global Constraints

- Paths are the new layout: rules in `AGENTS.md`, skills in `.agents/skills/<name>/SKILL.md`,
  machinery in `.designkit/`. Tool folders (`.claude/agents`, `.codex/`, `.cursor/`, `.gemini/`,
  `.github/`, `.opencode/`) are generated: after editing `.designkit/agents/*.md` run `bin/adapters`.
- Shared files (`AGENTS.md`, `.designkit/agents/*`, `.designkit/hooks/*`, the kit's own skills)
  name no AI product (layout test "shared files name no product").
- Shipped files (everything outside `dev/` and `.superpowers/`) name no colleague, client project
  or internal ticket: the dev's reasons stay in the spec.
- No em dash in new kit text; everyday words; one-line rules.
- The 9 borrowed skills (`skills-lock.json`) are never edited. `ui-design` is one of the kit's own.
- "Flexible by design: the agent decides from what it knows of the project, writes the decision
  down with a one-line why, and the designer can overrule it. No new setup question." (R)
- Existing projects keep their Prettier config, their part names and their commits working.
- Every suite green after every task. Nothing is pushed.

## Review Focus

- A project made before this change has no `## Screen sizes`: `/design-screen` decides it as setup
  would, adds it and goes on; it never stalls or designs every size (Task 3 rule check).
- An existing project whose screens already hold a raw hex is moved by `/sync`: its commits must not
  start failing; the new rule waits as a warning until the app passes it (Task 4 update test).
- Copy that contains `#123` or an anchor `href="#add"` in a screen is not a raw colour; a raw
  `<input type="hidden">` is not a control (Task 4 probes).
- A design-system part may use a raw `<button>` or `<input>`; only screens may not (Task 4 probes).
- Joining a repo someone else committed to keeps every kit file and `project/` out of its history,
  while a designer's own repo joins as before (Task 7 install checks).

---

### Task 1: Screen sizes written down (R1)

**Files:**
- Create: `dev/tests/rules/run.mjs`
- Modify: `.agents/skills/setup/SKILL.md` (step 6, Joined step 2), `AGENTS.md` ("Platforms")

**Interfaces:**
- Produces: `dev/tests/rules/run.mjs` with `rule(name, file, ...patterns)`; files are read with all
  whitespace collapsed to one space, so a pattern never depends on where a line wraps. Later tasks
  add sections before the summary line.

- [ ] **Step 1: Write the failing test** `dev/tests/rules/run.mjs`

```js
#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
let passed = 0
let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) passed++
  else failed++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n        missing: ${detail}`}`)
}
const read = (file) => (existsSync(join(KIT, file)) ? readFileSync(join(KIT, file), 'utf8').replace(/\s+/g, ' ') : '')
const rule = (name, file, ...patterns) => {
  const text = read(file)
  const missing = patterns.filter((p) => !p.test(text))
  check(name, missing.length === 0, missing.map(String).join('  '))
}
const AGENTS = 'AGENTS.md'
const SETUP = '.agents/skills/setup/SKILL.md'

console.log('Screen sizes')
rule('setup writes the kind and the sizes into PROJECT.md', SETUP, /`## Screen sizes`, `## Repos`/, /Mobile app: none, only larger text and safe areas are checked/, /Website or landing page: phone, tablet, laptop and wide, always/, /Web app \(a dashboard, a tool\): the sizes the brief names; none named: laptop and wide, logged under `## Assumptions`/, /no new question/)
rule('a joined project reads its sizes from its code', SETUP, /`## Screen sizes` from the code/)
rule('the rules design only the sizes in scope', AGENTS, /`## Screen sizes` in `PROJECT\.md` names the kind of project and the sizes in scope/, /a mobile app gets no responsive work/, /Other widths only have to keep working/)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
```

- [ ] **Step 2: Run it to see it fail**

Run: `node dev/tests/rules/run.mjs`
Expected: `0 passed, 3 failed`.

- [ ] **Step 3: Setup step 6.** In `.agents/skills/setup/SKILL.md` replace

```
- `project/PROJECT.md`: what, who, platform and framework, what ships first, first screen,
  `## Repos` (both folders; dev team clones only the app), `## Assumptions`.
```

with

```
- `project/PROJECT.md`: what, who, platform and framework, what ships first, first screen,
  `## Screen sizes`, `## Repos` (both folders; dev team clones only the app), `## Assumptions`.
  `## Screen sizes`: the kind of project and the sizes designed, each with a one-line why from the
  brief; no new question. Mobile app: none, only larger text and safe areas are checked. Website or
  landing page: phone, tablet, laptop and wide, always. Web app (a dashboard, a tool): the sizes the
  brief names; none named: laptop and wide, logged under `## Assumptions`. Web and mobile: each
  part by its own kind. The designer can overrule it any time.
```

- [ ] **Step 4: Setup Joined step 2.** After the sentence ending `with \`## Repos\`: one repository, the project's own.` insert

```
   `## Screen sizes` from the code: React Native or Expo is a mobile app; on the web, the widths
   its styles already change at (`sm:` to `2xl:`, `@media`) are the sizes in scope.
```

- [ ] **Step 5: AGENTS.md "Platforms".** After the bullet that starts `- Name the target before coding` add

```
- `## Screen sizes` in `PROJECT.md` names the kind of project and the sizes in scope. Design only
  those: a mobile app gets no responsive work, only larger text and safe areas. Other widths only
  have to keep working (320 wide, text at 200%). Layouts change only at the breakpoint tokens.
```

- [ ] **Step 6: Run it to see it pass, with the layout suite**

Run: `node dev/tests/rules/run.mjs && node dev/tests/layout/run.mjs`
Expected: `3 passed, 0 failed`; layout all passed.

- [ ] **Step 7: Commit**

```bash
git add -- dev/tests/rules/run.mjs .agents/skills/setup/SKILL.md AGENTS.md
git commit -m "feat(rules): each project names its screen sizes, by what kind of project it is" -m "A phone app needs no breakpoints, a website needs all of them, and a web app needs the sizes its brief names. Setup writes the choice and its reason into PROJECT.md without asking a new question, a joined project reads it from its own styles, and the rules say to design only those sizes. A new test suite reads each agreed rule back from the kit's words."
```

### Task 2: Token files and widths (R2, P8, P9)

**Files:**
- Modify: `.agents/skills/tokenize/SKILL.md` (steps 2, 3, 7), `.agents/skills/ui-design/SKILL.md`
  (grid breakpoints line, responsive table, its quality bar)
- Test: `dev/tests/rules/run.mjs`

- [ ] **Step 1: Add the failing checks** before the summary line of `dev/tests/rules/run.mjs`

```js
const TOKENIZE = '.agents/skills/tokenize/SKILL.md'
const UI = '.agents/skills/ui-design/SKILL.md'
console.log('\nTokens')
rule('one set of widths: the breakpoint file', TOKENIZE, /`breakpoint\.css`/, /--breakpoint-sm: 40rem/, /`2xl` 96rem \(1536px\)/)
rule('ui-design names the same widths', UI, /640 \/ 768 \/ 1024 \/ 1280 \/ 1536px/, /\| Phone \| under 640px \|/, /\| Wide \| 1536px\+ \|/)
check('ui-design no longer names 375 or 1440 as breakpoints', !/375|1440/.test(read(UI)))
rule('z-index, motion and height tokens', TOKENIZE, /`z-index\.css`, `motion\.css`, `height\.css`/, /`zIndex\.ts`, `motion\.ts`, `height\.ts`/)
rule('token names: hue and step, alpha suffix, shadows by use', TOKENIZE, /`--accent-600`/, /`--accent-600-a30`/, /`--shadow-card`/, /`color-mix\(\)`/)
rule('fields show focus by border colour, buttons by a keyboard-only ring', TOKENIZE, /border colour for focus/, /3:1 against the field and the page/, /keyboard focus only/)
```

- [ ] **Step 2: Run it to see the six new checks fail**

Run: `node dev/tests/rules/run.mjs`
Expected: `3 passed, 6 failed`.

- [ ] **Step 3: tokenize step 2.** Replace `2. **Token architecture**: tiers, naming and structure with \`design-systems\`.` with

```
2. **Token architecture**: tiers, naming and structure with `design-systems`. Names: primitive
   colours by hue and step (`--accent-600`), alpha as a suffix (`--accent-600-a30`); shadows by
   use (`--shadow-card`), their colour taken from a colour token through `color-mix()`; layers by
   use (`--z-dropdown`, `--z-modal`, `--z-toast`); motion by use (`--duration-quick`, `--ease-out`);
   control heights by size (`--control-sm`, `--control-md`).
```

- [ ] **Step 4: tokenize step 3.** Replace `3. **Colour**: palette and semantic mapping with \`ui-design\`. Check contrast as you go.` with

```
3. **Colour**: palette and semantic mapping with `ui-design`. Check contrast as you go. Focus: a
   field shows it by its border colour for focus (`--border-focus`, 3:1 against the field and the
   page); buttons and links show a ring (`--focus-ring`) for keyboard focus only.
```

- [ ] **Step 5: tokenize step 7.** Replace the two bullets `- Web: ...` and `- Mobile: ...` with

```
   - Web: `src/tokens/colors.css`, `spacing.css`, `radius.css`, `shadow.css`, `type.css`,
     `z-index.css`, `motion.css`, `height.css` and `breakpoint.css`, each imported from
     `src/app/globals.css`. `breakpoint.css` restates the five widths in an `@theme` block:
     `--breakpoint-sm: 40rem` (640px), `md` 48rem (768px), `lg` 64rem (1024px), `xl` 80rem (1280px),
     `2xl` 96rem (1536px); `sm:` to `2xl:` are then the only widths a layout changes at. In
     `motion.css`, every duration drops to `0ms` under `prefers-reduced-motion: reduce`. Each colour
     written once as `light-dark(<light>, <dark>)`, with `color-scheme: light dark` on `:root`.
     Spacing, radius, shadow and heights in px; type sizes in rem, so they follow the reader's
     font-size setting. Then point the library's variables in `globals.css` (`--background`,
     `--primary`, `--radius`...) at the tokens, delete its generated values and its `.dark` block,
     and delete its `@custom-variant dark` line so `dark:` follows the system like `light-dark()`
     does. A manual theme switch is a decision for `DECISIONS.md`, not the default.
   - Mobile: `src/tokens/colors.ts`, `spacing.ts`, `radius.ts`, `shadow.ts`, `type.ts`,
     `zIndex.ts`, `motion.ts`, `height.ts`; colours as `{ light, dark }` pairs read through
     `useColorScheme`. No breakpoints: a phone app has none.
```

- [ ] **Step 6: ui-design.** In `.agents/skills/ui-design/SKILL.md` replace
`Breakpoints: 375 / 768 / 1024 / 1440px — same tiers as responsive below.` with
`Breakpoints: 640 / 768 / 1024 / 1280 / 1536px (Tailwind's \`sm\` to \`2xl\`, the app's breakpoint tokens); the tiers below use them.`
Replace the table under "## Making a design responsive" with

```
| Tier | Range | Devices | Checked at |
|---|---|---|---|
| Phone | under 640px | phones | 390px, and 320px must not break |
| Tablet | 640–1023px | tablets | 768px |
| Laptop | 1024–1535px | laptops | 1280px |
| Wide | 1536px+ | desktop screens | 1920 × 1080 |

Design only the tiers the project's `## Screen sizes` lists; a mobile app has none.
```

and replace its responsive quality bar sentence (`Quality bar: verified on real devices, both
orientations, on a throttled connection, with an accessibility pass at each tier — browser-window
resizing alone does not count.`) with `Quality bar: checked at each tier's width, at 320px and with
the text at 200%, with an accessibility pass at each tier; on real devices in both orientations
before launch.`

- [ ] **Step 7: Run it to see it pass**

Run: `node dev/tests/rules/run.mjs && node dev/tests/layout/run.mjs`
Expected: `9 passed, 0 failed`; layout all passed.

- [ ] **Step 8: Commit**

```bash
git add -- dev/tests/rules/run.mjs .agents/skills/tokenize/SKILL.md .agents/skills/ui-design/SKILL.md
git commit -m "feat(tokens): one set of widths, and tokens for layers, motion, heights and focus" -m "The design guide named 375 and 1440 while the code changed layout at 640 to 1536, so specs and screens disagreed. Now both use the five widths the app's breakpoint file holds. A z-index, a duration or a control height in a component was a magic number with no token to use instead; now each has a file. Names follow one pattern (hue and step, alpha as a suffix, shadows by use), and fields show focus by their border colour instead of a ring that tires the eye in long sessions."
```

### Task 3: Design the sizes in scope, check them at real widths (R3, R4, R5, P1, P2, P9, P10, P11)

**Files:**
- Modify: `.agents/skills/design-screen/SKILL.md` (steps 3, 4, 6, 7, 8, Output),
  `.designkit/agents/design-reviewer.md` (Review 3 and 5), `.designkit/agents/code-reviewer.md`
  (Shape first), then `bin/adapters` regenerates the tool copies
- Test: `dev/tests/rules/run.mjs`

- [ ] **Step 1: Add the failing checks** before the summary line

```js
const SCREEN = '.agents/skills/design-screen/SKILL.md'
const DESIGN_REVIEW = '.designkit/agents/design-reviewer.md'
const CODE_REVIEW = '.designkit/agents/code-reviewer.md'
console.log('\nDesigning a screen')
rule('design only the sizes in scope; a mobile app gets none', SCREEN, /read `## Screen sizes` in `project\/PROJECT\.md` and design only the sizes it lists/, /A mobile app gets no responsive work/, /The section missing \(an older project\): decide it as `\/setup` step 6 does, add it/)
rule('open each width in scope, then 320 and 200% text', SCREEN, /390 phone, 768 tablet, 1280 laptop, 1920 by 1080 wide/, /at 320 wide and with the text at 200%/)
rule('nothing moves after it appears; animations replay', SCREEN, /nothing may move after it appears/, /plays the same on every load unless `DECISIONS\.md` says once/)
rule('long means thousands', SCREEN, /thousands of rows/)
rule('features by business job', SCREEN, /`src\/features\/<job>\/`, the business job it serves/)
rule('wrappers: native props and ref pass through, DS names, one icon set', SCREEN, /`src\/components\/DS<Part>\.tsx`/, /the native element's props and `ref` pass through, the library's options never/, /first a colour of an existing variant/, /Icons from the library's one set/, /never use a raw `<button>`, `<input>`, `<select>` or `<textarea>` \(gate `dk-11`\)/)
rule('fields focus by border, buttons by a keyboard ring', SCREEN, /Fields show focus by their border colour/, /for keyboard focus only/)
rule('the design review checks the same widths, none for a mobile app', DESIGN_REVIEW, /the widths `## Screen sizes` in `PROJECT\.md` lists, plus 320 wide and the text at 200%/, /Mobile app: no widths/, /say the widths were read, not opened/)
rule('the handover review checks the dev list', CODE_REVIEW, /one icon set/, /each part's variants a closed list/, /every top folder in the README's folder map/, /no session files, screenshots, design notes or agent files/)
```

- [ ] **Step 2: Run it to see the nine new checks fail**

Run: `node dev/tests/rules/run.mjs`
Expected: `9 passed, 9 failed`.

- [ ] **Step 3: design-screen.** Replace step 3 with

```
3. **Screen sizes and dark mode**: read `## Screen sizes` in `project/PROJECT.md` and design only
   the sizes it lists, with `ui-design`, changing layout only at the breakpoint tokens. A mobile app
   gets no responsive work: Dynamic Type to 200% and safe areas only. The section missing (an older
   project): decide it as `/setup` step 6 does, add it, and say so in one line. Dark mode with
   `ui-design`.
```

In step 4, after `its sample data to \`mock/\` with \`empty\` and \`long\` versions,` insert
`\`long\` with a total in the thousands and long text, so paging or a count gets designed,`.

Replace step 6 with

```
6. **Inclusive pass** with `inclusive-design`: keyboard, touch targets, contrast, motion, content.
   Fields show focus by their border colour (the focus token, 3:1 against the field and the page);
   buttons and links show a ring for keyboard focus only (`:focus-visible`).
```

Replace step 7 with

```
7. **Parts**, following "App structure" in `AGENTS.md`: the screen lives in
   `src/features/<job>/`, the business job it serves (sign in and reset password are both
   `authentication`); its route file only assembles it. For every UI part, reuse
   `src/components/DS<Part>` (a part made before this rule keeps its name). Missing: web,
   `npx shadcn@latest add <part> -y -s` into `src/components/ui`, then write
   `src/components/DS<Part>.tsx` wrapping it: the native element's props and `ref` pass through, the
   library's options never; only the variants and sizes `TASTE.md` allows; a new look is first a
   colour of an existing variant; tokens only. Mobile: wrap the React Native primitive the same way.
   Icons from the library's one set. Screens import `@/components/...`, never `@/components/ui`
   (gate `dk-08`), and never use a raw `<button>`, `<input>`, `<select>` or `<textarea>` (gate
   `dk-11`). A part only this feature uses stays in its feature folder.
```

Replace step 8 with

```
8. **Build it** in the app with `frontend-design` and the platform skill, following "No comments in
   code" in `AGENTS.md`. Every save goes through the slop gate; fix what it names before moving on.
   Then open the screen in every scenario (web: `?scenario=empty`, `long`, `error`, `slow` with the
   Chrome DevTools tools; mobile: `EXPO_PUBLIC_API_SCENARIO`) and fix what breaks, long text and
   thousands of rows included. Web: open it at each width `## Screen sizes` lists (390 phone, 768
   tablet, 1280 laptop, 1920 by 1080 wide), then at 320 wide and with the text at 200%
   (`document.documentElement.style.fontSize = '200%'`): nothing cut off, overlapping or scrolling
   sideways. Load it twice: nothing may move after it appears (a row, a menu item, an image), and an
   animation plays the same on every load unless `DECISIONS.md` says once.
```

In Output, replace `grid, hierarchy, type, colour, spacing,\nresponsive, dark mode,` so it reads
`grid, hierarchy, type, colour, spacing, screen sizes, dark mode,` (keep the rest).

- [ ] **Step 4: design-reviewer.** Replace review items 3 and 5 with

```
3. Accessibility: WCAG AA contrast, keyboard and screen reader paths, reduced motion, 200% text.
   Mobile: 44pt iOS / 48dp Android targets, safe areas.
   Web: the widths `## Screen sizes` in `PROJECT.md` lists, plus 320 wide and the text at 200%:
   nothing cut off, overlapping or scrolling sideways. Open them with the Chrome DevTools tools when
   you have them; without them, read the layout at each breakpoint and say the widths were read,
   not opened. Mobile app: no widths.
```

```
5. Tokens: no raw hex or magic numbers; layouts change only at the breakpoint tokens.
```

- [ ] **Step 5: code-reviewer.** In "Shape first" add item 6

```
6. What a dev checks at handover: one icon set; each part's variants a closed list (no free
   `className` or `style` from a screen); every top folder in the README's folder map; no session
   files, screenshots, design notes or agent files (rules files, tool folders) in the app that the
   project did not have before the kit.
```

- [ ] **Step 6: Regenerate and run**

Run: `bin/adapters && node dev/tests/rules/run.mjs && node dev/tests/layout/run.mjs && node dev/tests/adapters/run.mjs`
Expected: `18 passed, 0 failed`; layout and adapters all passed.

- [ ] **Step 7: Commit**

```bash
git add -- dev/tests/rules/run.mjs .agents/skills/design-screen/SKILL.md .designkit/agents/design-reviewer.md .designkit/agents/code-reviewer.md
git add -- $(git ls-files --modified --others --exclude-standard -- .claude/agents .codex .cursor .gemini .github .opencode)
git commit -m "feat(screens): design the sizes in scope, open each at real widths, wrap parts exactly" -m "Every screen used to get a phone layout, even for a desktop tool, and nothing opened it at a real width. Now a screen is designed only at the sizes PROJECT.md lists, then opened at those widths, at 320 and with the text doubled, and loaded twice to catch anything that jumps. Parts keep the native props and ref, so a label or a submit type is never lost; features group a business job, not a screen; the long scenario means thousands of rows. The design review checks the same widths and the handover review checks what a dev looks for."
```

### Task 4: Gate rules for raw values and raw controls (P3, R5)

**Files:**
- Modify: `.designkit/scripts/slop-gate.mjs` (new `rawHits`, called from `own`; self-test cases),
  `.designkit/scripts/slop-rules.mjs` (`gateRules`), `.designkit/slop-policy.json` (`block`),
  `bin/update-project.mjs` (adopt a new rule only where the app passes it), `AGENTS.md` ("Slop"),
  `.agents/skills/setup/SKILL.md` (step 7 replaces the generator's start page)
- Create probes: `dev/tests/gate/probes/src/features/c11-raw/Screen.tsx`,
  `src/components/c12-part.tsx`, `src/tokens/c13-colors.css`, `src/features/c14-styles/screen.css`,
  `src/features/c15-rn/Screen.tsx`, `src/app/globals.css`, `src/lib/c16-chart.ts`
- Modify tests: `dev/tests/gate/expect.json`, `dev/tests/update/run.sh`, `dev/tests/rules/run.mjs`

**Interfaces:**
- Produces: gate ids `dk-10` (raw colour or made-up size in a screen or part) and `dk-11` (raw
  control in a screen); `rawHits(label, ts, ext, src)` returning `{ id, line, text, from: 'gate' }[]`.

- [ ] **Step 1: Probes.** Create

`dev/tests/gate/probes/src/features/c11-raw/Screen.tsx`
```tsx
import { DSButton } from '@/components/DSButton'
export const Screen = ({ order }: { order: number }) => (
  <main className="bg-[#1a2b3c] p-4">
    <p style={{ color: 'rgb(10 20 30)' }}>Order #123 is ready</p>
    <div className="p-[13px] min-[900px]:flex">{order}</div>
    <a href="#add">Add</a>
    <div className="bg-[hsl(var(--primary))] text-accent-600" />
    <button type="button">Raw</button>
    <input type="hidden" name="id" value="1" />
    <DSButton>Save</DSButton>
  </main>
)
```
`dev/tests/gate/probes/src/components/c12-part.tsx`
```tsx
export const DSField = (props: React.ComponentProps<'input'>) => <input {...props} style={{ borderColor: '#cccccc' }} />
```
`dev/tests/gate/probes/src/tokens/c13-colors.css`
```css
:root {
  --accent-600: #1a2b3c;
}
```
`dev/tests/gate/probes/src/features/c14-styles/screen.css`
```css
.row {
  border: 1px solid #ccc;
}
```
`dev/tests/gate/probes/src/features/c15-rn/Screen.tsx`
```tsx
import { StyleSheet, Text } from 'react-native'
const styles = StyleSheet.create({ title: { color: '#fff', zIndex: 10 } })
export const Screen = () => <Text style={styles.title}>Today</Text>
```
`dev/tests/gate/probes/src/app/globals.css`
```css
:root {
  --background: oklch(1 0 0);
}
```
`dev/tests/gate/probes/src/lib/c16-chart.ts`
```ts
export const fallback = '#888888'
```
and add to `dev/tests/gate/expect.json`:
```json
  "src/features/c11-raw/Screen.tsx": ["dk-10@3", "dk-10@4", "dk-10@5", "dk-11@8"],
  "src/components/c12-part.tsx": ["dk-10@1"],
  "src/tokens/c13-colors.css": [],
  "src/features/c14-styles/screen.css": ["dk-10@2"],
  "src/features/c15-rn/Screen.tsx": ["dk-10@2"],
  "src/app/globals.css": [],
  "src/lib/c16-chart.ts": []
```

- [ ] **Step 2: Self-test cases.** In `selfTest()` of `.designkit/scripts/slop-gate.mjs` add after the `api/client.ts` case

```js
    ['dk-10', 'features/Swatch.tsx', `export const S = () => <div className="bg-[#1a2b3c] p-4" />\n`],
    [null, 'tokens/colors.ts', `export const accent = '#1a2b3c'\n`],
    ['dk-11', 'features/Form.tsx', `export const F = () => <button type="submit">Save</button>\n`],
    [null, 'components/DSButton.tsx', `export const DSButton = (props: React.ComponentProps<'button'>) => <button {...props} />\n`],
```

- [ ] **Step 3: Run the gate suite to see it fail**

Run: `node dev/tests/gate/run.mjs 2>&1 | tail -20`
Expected: failures for `c11-raw`, `c12-part`, `c14-styles`, `c15-rn` (no `dk-10`/`dk-11` yet) and
the self-test failing on `Swatch.tsx` and `Form.tsx`.

- [ ] **Step 4: The rules.** Append to `gateRules` in `.designkit/scripts/slop-rules.mjs`

```js
  { id: 'dk-10', name: 'raw colour or made-up size in a screen or part', fix: 'use a token from src/tokens: a colour, spacing, height, z-index, motion or breakpoint' },
  { id: 'dk-11', name: 'raw control in a screen', fix: 'use the design-system part from src/components (DSButton, DSInput...)' },
```

and add `"dk-10"` and `"dk-11"` to `block` in `.designkit/slop-policy.json`.

- [ ] **Step 5: The check.** In `.designkit/scripts/slop-gate.mjs`, after the `CAPS` constant add

```js
const SCREEN_PATH = /(?:^|\/)(?:app|features)\//
const PART_PATH = /(?:^|\/)components\//
const VALUE_EXEMPT = /(?:^|\/)(?:components\/ui|tokens)\/|(?:^|\/)globals\.css$/
const HEX = String.raw`#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])`
const COLOR_FN = String.raw`\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*(?!var\()`
const MADE_UP = [
  String.raw`\b[a-z][\w-]*-\[-?(?:\d*\.)?\d+(?:px|rem|em)\]`,
  String.raw`(?:^|[\s"'\x60:])(?:min|max)-\[[^\]\s]+\]:`,
  String.raw`\bz-\[-?\d+\]`,
  String.raw`\b(?:duration|delay)-\[(?:\d*\.)?\d+m?s\]`,
  String.raw`\bease-\[`,
]
const RAW_IN_STRING = new RegExp([String.raw`^\s*${HEX}\s*$`, String.raw`(?:\[|\(|,|\b(?:solid|dashed|dotted|double|inset)|\d(?:px|rem|em|%)?)\s*${HEX}`, COLOR_FN, ...MADE_UP].join('|'))
const RAW_IN_CSS = new RegExp([String.raw`(?<![\w&/-])${HEX}`, COLOR_FN].join('|'))
const CONTROLS = new Set(['button', 'input', 'select', 'textarea'])
const NOT_STYLE_ATTR = /^(?:href|to|id|htmlFor|name|key|aria-[\w-]+|data-[\w-]+)$/
```

and, after `mockImportHits`, add

```js
function rawHits(label, ts, ext, src) {
  const values = (SCREEN_PATH.test(label) || PART_PATH.test(label)) && !VALUE_EXEMPT.test(label)
  const controls = SCREEN_PATH.test(label) && !PART_PATH.test(label)
  if (!values && !controls) return []
  const lines = src.split(/\r?\n/)
  const hit = (id, line) => ({ id, line, text: (lines[line - 1] ?? '').trim(), from: 'gate' })
  if (STYLE.has(ext)) {
    if (!values) return []
    const blank = (m) => m.replace(/[^\n]/g, ' ')
    return src.replace(/\/\*[\s\S]*?\*\//g, blank).split(/\r?\n/).flatMap((text, i) => (RAW_IN_CSS.test(text) ? [hit('dk-10', i + 1)] : []))
  }
  if (!JS.has(ext)) return []
  if (!ts) {
    return lines.flatMap((text, i) => {
      const out = []
      if (values && [...text.matchAll(/(?:([\w-]+)=)?(['"\x60])((?:(?!\2).)*)\2/g)].some((m) => !(m[1] && NOT_STYLE_ATTR.test(m[1])) && RAW_IN_STRING.test(m[3]))) out.push(hit('dk-10', i + 1))
      if (controls && /<(?:button|select|textarea)\b|<input\b(?![^>]*type=["']hidden["'])/.test(text)) out.push(hit('dk-11', i + 1))
      return out
    })
  }
  const sf = ts.createSourceFile(`x${ext}`, src, ts.ScriptTarget.Latest, true, scriptKind(ts, ext))
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  const out = []
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return
    if (ts.isJsxAttribute(node) && NOT_STYLE_ATTR.test(node.name.getText(sf))) return
    if (values && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && RAW_IN_STRING.test(node.text)) out.push(hit('dk-10', lineOf(node)))
    const open = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null
    if (controls && open && ts.isIdentifier(open.tagName) && CONTROLS.has(open.tagName.text)) {
      const hidden = open.tagName.text === 'input' && open.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'type' && a.initializer && ts.isStringLiteral(a.initializer) && a.initializer.text === 'hidden')
      if (!hidden) out.push(hit('dk-11', lineOf(open)))
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}
```

In `own()`, for code files, add the raw hits to `hits` for every code kind. Replace

```js
  const hits = [...commentHits(list, src), ...(JS.has(ext) ? [...uiImportHits(label, src), ...mockImportHits(label, src)] : [])]
```

with

```js
  const hits = [...commentHits(list, src), ...(JS.has(ext) ? [...uiImportHits(label, src), ...mockImportHits(label, src)] : []), ...rawHits(label, ts, ext, src)]
```

(`ts` is `null` for CSS files; `rawHits` takes the CSS branch before using it.)

- [ ] **Step 6: Run the gate suites to see them pass**

Run: `node dev/tests/gate/run.mjs | tail -6 && node dev/tests/gate/run.mjs --without-typescript | tail -4 && node dev/tests/gate/staged.mjs | tail -2 && node .designkit/scripts/slop-gate.mjs --self-test | tail -1`
Expected: `65/65` probes both ways, staged all passed, `self-test: all passed`.

- [ ] **Step 7: The update adopts a new rule only where the app passes it.** Add to
`dev/tests/update/run.sh`, after the "running it again changes nothing" check:

```bash
hexp="$HOME/Projects/Hexed"
bash "$old/bin/new-project" "$hexp" >/dev/null 2>&1
mkdir -p "$hexp/Hexed-app/src/features/today"
git -C "$hexp/Hexed-app" init -q -b main
printf 'export const Today = () => <p className="text-[#1a2b3c]">Today</p>\n' >"$hexp/Hexed-app/src/features/today/Today.tsx"
commit_all "$hexp/Hexed-app" "feat: today"
(cd "$hexp" && bash "$update" </dev/null >"$sandbox/hexed.log" 2>&1)
check "a new rule the app already breaks waits as a warning, and says so" '! grep -q "\"dk-10\"" "$hexp/.designkit/slop-policy.json" && grep -q "\"dk-11\"" "$hexp/.designkit/slop-policy.json" && grep -q "dk-10" "$sandbox/hexed.log" && grep -q "warns until" "$sandbox/hexed.log"'
check "a new rule the app passes is on at once" 'grep -q "\"dk-10\"" "$p/.designkit/slop-policy.json" && grep -q "\"dk-11\"" "$p/.designkit/slop-policy.json"'
```

Run: `bash dev/tests/update/run.sh 2>&1 | tail -6`
Expected: the first new check FAILS (the update adds `dk-10` regardless).

- [ ] **Step 8: Implement.** In `bin/update-project.mjs`, replace the policy block's
`for (const id of kitPolicy.block ?? []) if (!policy.block?.includes(id) && !policy.skip?.includes(id)) newRules.push(id)`
with

```js
  const candidates = (kitPolicy.block ?? []).filter((id) => !policy.block?.includes(id) && !policy.skip?.includes(id))
  const found = candidates.length ? appHits() : null
  for (const id of candidates) {
    if (found === null) waiting.push([id, null])
    else if (found.get(id)) waiting.push([id, found.get(id)])
    else newRules.push(id)
  }
```

with, above the block, `const waiting = []` and

```js
function appHits() {
  const r = spawnSync(process.execPath, [at('.designkit/scripts/slop-gate.mjs'), '--json', '--no-fail'], { cwd: target, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  try {
    const counts = new Map()
    for (const h of JSON.parse(r.stdout).hits) counts.set(h.id, (counts.get(h.id) ?? 0) + 1)
    return counts
  } catch {
    return null
  }
}
```

(import `spawnSync` from `node:child_process` if the file does not yet), and after the existing
`if (newRules.length) say(...)` line add

```js
for (const [id, n] of waiting) say(n === null ? `  ${id} is new; the app could not be checked, so it warns until /sync finds the app passes it.` : `  ${id} is new and found ${n} place(s) already in the app: it warns until they are fixed, then /sync turns it on.`)
```

Run: `bash dev/tests/update/run.sh 2>&1 | tail -4`
Expected: all passed, including both new checks and "running it again changes nothing".

- [ ] **Step 9: Words.** In `AGENTS.md` "Slop", replace
`a card inside a\n  card (\`dk-06\`), TODOs (\`dk-07\`), or \`kill-ai-slop\`'s patterns.` so the list ends
`a card inside a card (\`dk-06\`), TODOs (\`dk-07\`), a raw colour or made-up size in a screen or part
(\`dk-10\`), a raw \`<button>\`, \`<input>\`, \`<select>\` or \`<textarea>\` in a screen (\`dk-11\`), or
\`kill-ai-slop\`'s patterns.` In `.agents/skills/setup/SKILL.md` step 7, after the sentence that
ends `then \`npm run format\`.` add: `Web: replace the generator's start page
(\`src/app/page.tsx\`) with one heading holding the project's name; it is full of raw colours and
made-up sizes, and the first screen replaces it anyway.` Add to `dev/tests/rules/run.mjs`:

```js
console.log('\nGate')
rule('the rules name the two new gate ids', AGENTS, /\(`dk-10`\)/, /\(`dk-11`\)/)
rule('setup replaces the start page the gate would refuse', SETUP, /replace the generator's start page/)
```

Run: `node dev/tests/rules/run.mjs && node dev/tests/layout/run.mjs && node dev/tests/install/run.sh 2>&1 | tail -2`
Expected: rules `20 passed`; layout and install all passed.

- [ ] **Step 10: Commit**

```bash
git add -- .designkit/scripts/slop-gate.mjs .designkit/scripts/slop-rules.mjs .designkit/slop-policy.json bin/update-project.mjs AGENTS.md .agents/skills/setup/SKILL.md dev/tests/gate dev/tests/update/run.sh dev/tests/rules/run.mjs
git commit -m "feat(gate): refuse raw colours, made-up sizes and raw controls in screens" -m "A hex or a 13px in a component was caught only when someone asked for a review, and a raw button in a screen skipped the design system. The gate now refuses both on save and at commit: a raw colour, an arbitrary size, z-index, duration or breakpoint in a screen or part (dk-10), and a raw button, input, select or textarea in a screen (dk-11). Tokens, the library's own folder, globals.css and helpers are left alone; copy such as 'Order #123' and anchors are not colours. A project moved by /sync gets a new rule at once only when its app already passes it; otherwise it warns until the places are fixed, so no commit starts failing overnight."
```

### Task 5: The rulebook: structure, the dev list, what is not ours to decide (P1, P2, P4, P5, P7, P10, P13)

**Files:**
- Create: `project/DEV.md` (template)
- Modify: `AGENTS.md` ("App structure", "Data", "After handover", new "The dev list", "Quality",
  "Paths"), `bin/update-project.mjs` and `bin/join-existing.mjs` (place `project/DEV.md` when
  missing), `dev/tests/layout/run.mjs` (no colleague names), `dev/tests/rules/run.mjs`,
  `dev/tests/install/run.sh`, `dev/tests/update/run.sh`

- [ ] **Step 1: Add the failing checks.** Rules suite, before the summary line:

```js
console.log('\nThe rulebook')
rule('features by business job', AGENTS, /`src\/features\/<job>`: one business job with all its screens/, /one `authentication` feature, not four/)
rule('the wrapper rule, exact', AGENTS, /`DS<Part>`/, /The native element's props and `ref` pass through/, /the library's own options never do/, /A new look is first tried as a colour of an existing variant/, /Parts made before this rule keep their names/)
rule('one icon set', AGENTS, /Icons from one set, the one the UI library installs/)
rule('sign-in, permissions and payments are the dev\'s', AGENTS, /Sign-in, permissions and payments are the dev's to decide/, /as a meeting/)
rule('long means thousands', AGENTS, /`long` means thousands/)
rule('the dev list', AGENTS, /## The dev list/, /`project\/DEV\.md`/, /one numbered message/, /`## From the dev`: their requests, done before the next new screen/)
rule('a design branch starts from main just pulled; an API spec updates types and mock', AGENTS, /always started from `main` just pulled/, /`types\.ts` and `mock\/` follow it/)
rule('no screenshot suites, no whole-app AI cleanup', AGENTS, /Never build a screenshot or visual test suite, or tooling nobody asked for/, /cleanup is knip, Prettier and the gate/)
rule('the dev list template', 'project/DEV.md', /## To send/, /## Meeting/, /## From the dev/, /## Sent/)
```

Layout suite, in "Rules" before the README checks:

```js
const NAMES = /\b(?:Peter|Osmose|Dirigeo|Hulusi)\b|DIRIGEO-\d/i
const named2 = tracked.filter((f) => !/^(?:dev|\.superpowers)\//.test(f) && isFile(f) && NAMES.test(read(f)))
check('shipped files name no colleague or client project', named2.length === 0, named2.join(', '))
```

Install suite, after "one repository, marked joined":
`check "a joined project gets the dev list" '[ -f "$f/project/DEV.md" ]'`
Update suite, after "the project's own documents are untouched":
`check "an older project gains the dev list, nothing else in project/ changes" '[ -f "$p/project/DEV.md" ]'`

- [ ] **Step 2: Run them to see the new checks fail**

Run: `node dev/tests/rules/run.mjs | tail -3; node dev/tests/layout/run.mjs | tail -2`
Expected: rules `20 passed, 9 failed`; layout passes the names check already (it guards the future).

- [ ] **Step 3: The template** `project/DEV.md`

```markdown
# For the dev

What the developer must answer, and what they asked for, one line each. `## To send` goes out as
one numbered message when the designer says so.

## To send

## Meeting

## From the dev

## Sent
```

- [ ] **Step 4: AGENTS.md "App structure".** Replace the whole section body with

```
- `src/app`: routes only; a page assembles features. `src/features/<job>`: one business job with all
  its screens, parts and hooks (sign in, sign up, forgot and reset password are one `authentication`
  feature, not four). `src/components`: the design system, one small file per part, for parts two
  or more features use. `src/components/ui`: the UI library as installed (shadcn), the engine under
  the design system; only files under `src/components` import it (gate `dk-08`). `src/tokens`:
  values only, one file per kind. `src/lib`: small helpers.
- A part used by one feature stays in that feature; used by two, it moves to `src/components`.
- A design-system part is `DS<Part>` (`DSButton` in `src/components/DSButton.tsx`) and wraps one
  library part. The native element's props and `ref` pass through, so a label, a submit type or
  focus is never lost; the library's own options never do: the part offers only the variants and
  sizes `TASTE.md` allows (two or three variants, two sizes). A new look is first tried as a colour
  of an existing variant; a new variant is a `DECISIONS.md` line. Colour, size, radius and shadow
  from tokens. Parts made before this rule keep their names.
- Icons from one set, the one the UI library installs (web: `lucide-react`); mobile: one family of
  `@expo/vector-icons`, named in `DECISIONS.md`. Never a second set or a hand-drawn icon.
- Never edit a file in `src/components/ui`: the next `shadcn add` overwrites it. Adjust the look in
  the wrapper or through the library's variables in `globals.css`.
- Mobile: same folders; parts wrap React Native primitives; tokens in `src/tokens/*.ts`.
```

- [ ] **Step 5: AGENTS.md "Data".** In the Scenarios bullet, after `A screen that shows data is
built and checked in all five; only such screens get the data states.` add `` `long` means
thousands: a total in the thousands and long text, so paging or a count is designed.`` Add a bullet
before "Handover:":

```
- Sign-in, permissions and payments are the dev's to decide: screens run on the mock, and how they
  work goes to `project/DEV.md` as a meeting. Never choose a sign-in method, a role model or a
  payment flow.
```

- [ ] **Step 6: AGENTS.md "After handover" and "The dev list".** Replace the section with

```
## After handover
- Handover is a dated line in `DECISIONS.md`. From then on: work on a branch `design/<topic>`, never
  `main`, always started from `main` just pulled; before changing a file whose last commit is not
  the designer's (`git log -1 --format=%an -- <file>`), propose the change instead of making it.
- The dev sends an API spec: `types.ts` and `mock/` follow it, and every difference from what the
  screens need goes to `project/DEV.md`.

## The dev list
- `project/DEV.md` holds what the dev must answer, and what the dev asked for, across chats; never
  scattered through replies. One line each.
- Sign-in, permissions, payments and anything that needs a screen to explain go under `## Meeting`.
- `## To send` goes out as one numbered message when the designer says so: draft it for them to
  paste, then move the lines to `## Sent` with the date. Never one question at a time.
- `## From the dev`: their requests, done before the next new screen.
```

- [ ] **Step 7: AGENTS.md "Quality" and "Paths".** Add to "Quality", after the `/check all` bullet:

```
- Never build a screenshot or visual test suite, or tooling nobody asked for. Never launch a
  whole-app AI cleanup: cleanup is knip, Prettier and the gate.
```

In "Paths", in the `project/` line, after `` `DECISIONS.md`, `` insert `` `DEV.md` (the dev list), ``.

- [ ] **Step 8: Every project gets the template.** `bin/new-project` already copies `project/`.
In `bin/update-project.mjs`, before the "Policy" block, add

```js
if (!existsSync(at('project/DEV.md'))) {
  mkdirSync(at('project'), { recursive: true })
  cpSync(join(kit, 'project/DEV.md'), at('project/DEV.md'))
  log.added.push('project/DEV.md')
}
```

(import `cpSync`/`mkdirSync` if missing). In `bin/join-existing.mjs`, after the `for (const dir of
PROJECT)` loop, add

```js
if (!existsSync(join(target, 'project/DEV.md'))) {
  cpSync(join(kit, 'project/DEV.md'), join(target, 'project/DEV.md'))
  log.added.push('project/DEV.md')
}
```

(add `cpSync` to its `node:fs` import).

- [ ] **Step 9: Run them to see them pass**

Run: `node dev/tests/rules/run.mjs | tail -1 && node dev/tests/layout/run.mjs | tail -1 && bash dev/tests/install/run.sh 2>&1 | tail -1 && bash dev/tests/update/run.sh 2>&1 | tail -1`
Expected: rules `29 passed, 0 failed`; every suite `0 failed`.

- [ ] **Step 10: Commit**

```bash
git add -- project/DEV.md AGENTS.md bin/update-project.mjs bin/join-existing.mjs dev/tests/rules/run.mjs dev/tests/layout/run.mjs dev/tests/install/run.sh dev/tests/update/run.sh
git commit -m "feat(rules): features by business job, exact wrappers, and one list for the dev" -m "A feature per screen meant splitting them into modules later; a business job is one folder now. Wrappers name the rule exactly: native props and ref pass through, library options never, one icon set. Questions for the dev now collect in project/DEV.md across chats and go out as one numbered message, the dev's own requests come first, and sign-in, permissions and payments are never decided by the agent. Long data means thousands of rows; no screenshot suites or whole-app AI cleanups. Older and joined projects gain the empty list."
```

### Task 6: New apps: shared formatting, Node 22, exact hook files (P6, P12)

**Files:**
- Modify: `.agents/skills/setup/SKILL.md` (`## Build` → `### Gate`), `bin/install` (Node floor),
  `dev/NOTES.md` (installer line), `dev/tests/rules/run.mjs`

- [ ] **Step 1: Add the failing checks**

```js
console.log('\nNew apps')
rule('the shared Prettier config with the import sorter', SETUP, /prettier-plugin-organize-imports/, /"semi": true, "singleQuote": false, "trailingComma": "all", "printWidth": 100/)
rule('Node 22 as the floor', SETUP, /engines\.node=">=22"/)
rule('hook files hold exactly the kit\'s lines', SETUP, /nothing above them/)
rule('the installer asks for Node 22', 'bin/install', /a >= 22/, /Node\.js 22 or newer is needed/)
```

Run: `node dev/tests/rules/run.mjs | tail -1`
Expected: `29 passed, 4 failed`.

- [ ] **Step 2: setup `### Gate`.** Replace

```
npm install -D prettier knip husky lint-staged
npm pkg set scripts.prepare=husky scripts.format="prettier --write ." scripts.dead=knip
```

with

```
npm install -D prettier prettier-plugin-organize-imports knip husky lint-staged
npm pkg set scripts.prepare=husky scripts.format="prettier --write ." scripts.dead=knip engines.node=">=22"
```

replace the `.prettierrc` bullet with

```
- `.prettierrc` if absent: `{ "semi": true, "singleQuote": false, "trailingComma": "all", "printWidth": 100, "plugins": ["prettier-plugin-organize-imports"] }`
  (Prettier's defaults, a 100 wide line and sorted imports: one format the dev team shares)
```

and before the `.husky/pre-commit` bullet add

```
- Each hook file below holds exactly its lines, nothing above them: husky 9 needs no `#!/bin/sh`
  or `husky.sh` line, and husky 10 refuses them.
```

- [ ] **Step 3: bin/install.** Replace
`process.exit(a > 20 || (a === 20 && b >= 19) ? 0 : 1)` with `process.exit(a >= 22 ? 0 : 1)` (and
`const [a, b]` with `const [a]`), and `Node.js 20.19 or newer is needed.` with
`Node.js 22 or newer is needed.` In `dev/NOTES.md`, replace `Node.js 20.19 or newer (Next and Expo
minimums;` with `Node.js 22 or newer (Node 20 reached end of life on 30 April 2026;`.

- [ ] **Step 4: Run them to see them pass**

Run: `node dev/tests/rules/run.mjs | tail -1 && bash -n bin/install && bash dev/tests/install/run.sh 2>&1 | tail -1`
Expected: `33 passed, 0 failed`; install `0 failed`.

- [ ] **Step 5: Commit**

```bash
git add -- .agents/skills/setup/SKILL.md bin/install dev/NOTES.md dev/tests/rules/run.mjs
git commit -m "feat(setup): new apps share the dev's format and need Node 22" -m "New apps format with Prettier's defaults, a 100 wide line and sorted imports, the format the dev team asked for, so nobody reformats anybody; existing projects keep theirs. Node 20 reached end of life in April 2026, so new apps say Node 22 and the installer asks for it. The commit hook files now hold exactly the kit's lines: an agent added husky's old preamble in a live run and spent a commit taking it out again."
```

### Task 7: Joining a repo a dev works in (P14)

**Files:**
- Modify: `bin/join-existing.mjs`, `bin/update-project.mjs` (exclude for `devRepo`),
  `.agents/skills/setup/SKILL.md` (Joined step 8), `dev/tests/install/run.sh`, `dev/tests/rules/run.mjs`

**Interfaces:**
- Produces: `.designkit/workspace.json` `"devRepo": true` when the history has a commit by anyone
  but the designer (`git config user.email`); with it the join behaves as for a public repo and
  `project/` also stays out of history.

- [ ] **Step 1: The failing checks.** Install suite, after the public-join check:

```bash
dv="$HOME/Projects/Shared"
mkdir -p "$dv/src" && git init -q -b main "$dv"
printf '# Shared\n' >"$dv/README.md" && printf 'export const a = 1\n' >"$dv/src/a.ts"
git -C "$dv" add README.md src/a.ts && git -C "$dv" -c user.name=Dev -c user.email=dev@example.com commit -qm "feat: start"
(cd "$dv" && DESIGNKIT_VISIBILITY=private bash "$new" </dev/null >"$sandbox/devrepo.log" 2>&1)
check "a repo a dev works in: no kit file and no design note in its history" '[ -z "$(git -C "$dv" ls-files .agents .designkit .claude project)" ] && [ -f "$dv/.agents/skills/no-slop/SKILL.md" ] && [ -f "$dv/project/DEV.md" ] && [ -z "$(git -C "$dv" status --porcelain)" ] && grep -q "\"devRepo\": true" "$dv/.designkit/workspace.json" && grep -q "a developer works in" "$sandbox/devrepo.log"'
```

and on the existing private solo join (`$f`, "Folio"), add
`check "a designer's own repo still carries the kit" '[ -n "$(git -C "$f" ls-files .agents)" ] && ! grep -q devRepo "$f/.designkit/workspace.json"'`.
Rules suite:

```js
rule('setup knows a dev\'s repo keeps the design notes local', SETUP, /`"devRepo": true`/)
```

Run: `bash dev/tests/install/run.sh 2>&1 | grep -E "FAIL|passed"`
Expected: the dev-repo check FAILS (the kit is committed into his repo today).

- [ ] **Step 2: Implement** in `bin/join-existing.mjs`, after `const isPublic = visibility === 'public'`:

```js
const me = git('config', 'user.email').out
const devRepo = git('log', '--format=%ae').out.split('\n').some((email) => email && email !== me)
const keepOut = isPublic || devRepo
```

then use `keepOut` in place of `isPublic` for `settingsFile`, `mergeMcp`, `sync(..., { merge })`,
`exclude`, `stage` and `why`; write `devRepo` into the workspace file only when true
(`...(devRepo ? { devRepo: true } : {})`); when `devRepo`, add `'/project/'` to the excluded list
and stage only `['CLAUDE.md', 'AGENTS.md']`; and replace the closing public line with

```js
if (devRepo) say("  A developer works in this repository, so the kit's files and the design notes stay on this Mac and out of its history.")
else if (isPublic) say("  The repository is public, so the kit's files stay on this Mac and out of its history.")
```

In `bin/update-project.mjs`, use `isPublic || workspace.devRepo === true` where it decides what to
hide for a joined project. In setup Joined step 8, replace `Public (\`"visibility": "public"\`):
commit only \`project/\` and the project's own files.` with `Public (\`"visibility": "public"\`):
commit only \`project/\` and the project's own files. A repo a dev works in (\`"devRepo": true\`):
commit only the project's own files; \`project/\` stays on this Mac.`

- [ ] **Step 3: Run them to see them pass**

Run: `bash dev/tests/install/run.sh 2>&1 | tail -1 && bash dev/tests/update/run.sh 2>&1 | tail -1 && node dev/tests/rules/run.mjs | tail -1`
Expected: `0 failed` each; rules `34 passed`.

- [ ] **Step 4: Commit**

```bash
git add -- bin/join-existing.mjs bin/update-project.mjs .agents/skills/setup/SKILL.md dev/tests/install/run.sh dev/tests/rules/run.mjs
git commit -m "feat(join): a repo a developer works in keeps the kit out of its history" -m "Joining a private repo committed the kit's skills, reviewers and scripts into it the first time the designer shared, so the developer's own agent would load them every session. When anyone but the designer has committed there, the join now works as for a public repo: the kit's files and the design notes stay on this Mac, only the project's own rules files carry the one line that loads the kit where it is present. A designer's own repo joins as before."
```

### Task 8: Notes, live check, review

**Files:**
- Modify: `dev/NOTES.md` (decision entries "Responsive by kind" and "The dev's playbook", the test
  list gains `node dev/tests/rules/run.mjs`, "What is next" loses item 00 and gains what is left),
  `dev/specs/2026-10-05-any-agent-responsive-peter.md` (status line)

- [ ] **Step 1: Notes.** Add two dated decision entries before "## How to test", each naming the
  spec, what was settled and any ruling from the ledger; add `node dev/tests/rules/run.mjs  # each
  agreed rule read back from the kit's words` to the test list; replace item 00 in "What is next"
  with what is still open (before public: licences, scrubbing `dev/`, live runs in two other agents).
  Spec status line: `Status: built 2026-10-06 (sections 1 to 3); not pushed.`
- [ ] **Step 2: Every suite** (the list in `dev/NOTES.md` "How to test"), all green.
- [ ] **Step 3: Live.** In the proof project from the any-agent plan (or a fresh one), headless
  `/design-screen` of a second screen: the spec names the sizes from `## Screen sizes`, the part it
  adds is `DS<Part>` with native props, and the gate reports 0 block.
- [ ] **Step 4: Commit** `docs(dev): record responsive by kind and the dev's playbook`.
- [ ] **Step 5: Final review** of this plan's commits by a fresh reviewer, fixes with tests.
