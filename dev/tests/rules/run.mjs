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
const JOINED = '.designkit/rules/joined.md'
const HANDOVER = '.designkit/rules/handover.md'
const SETUP = '.agents/skills/setup/SKILL.md'
const SETUP_JOINED = '.agents/skills/setup/joined.md'
const SETUP_BUILD = '.agents/skills/setup/build.md'

console.log('Screen sizes')
rule('setup writes the kind and the sizes into PROJECT.md', SETUP, /`## Screen sizes`, `## Repos`/, /Mobile app: none, only larger text and safe areas are checked/, /Website or landing page: phone, tablet, laptop and wide, always/, /Web app \(a dashboard, a tool\): the sizes the brief names; none named: laptop and wide, logged under `## Assumptions`/, /no new question/)
rule('a joined project reads its sizes from its code', SETUP_JOINED, /`## Screen sizes` from the code/)
rule('the rules design only the sizes in scope', AGENTS, /`## Screen sizes` in `PROJECT\.md` names the kind of project and the sizes in scope/, /a mobile app gets no responsive work/, /Other widths only have to keep working/)

const TOKENIZE = '.agents/skills/tokenize/SKILL.md'
const UI = '.agents/skills/ui-design/SKILL.md'
console.log('\nTokens')
rule('one set of widths: the breakpoint file', TOKENIZE, /`breakpoint\.css`/, /--breakpoint-sm: 40rem/, /`2xl` 96rem \(1536px\)/)
rule('ui-design names the same widths', UI, /640 \/ 768 \/ 1024 \/ 1280 \/ 1536px/, /\| Phone \| under 640px \|/, /\| Wide \| 1536px\+ \|/)
check('ui-design no longer names 375 or 1440 as breakpoints', !/375|1440/.test(read(UI)))
rule('z-index, motion and height tokens', TOKENIZE, /`z-index\.css`, `motion\.css`, `height\.css`/, /`zIndex\.ts`, `motion\.ts`, `height\.ts`/)
rule('token names: hue and step, alpha suffix, shadows by use', TOKENIZE, /`--accent-600`/, /`--accent-600-a30`/, /`--shadow-card`/, /`color-mix\(\)`/)
rule('fields show focus by border colour, buttons by a keyboard-only ring', TOKENIZE, /border colour for focus/, /3:1 against the field and the page/, /keyboard focus only/)

const SCREEN = '.agents/skills/design-screen/SKILL.md'
const DESIGN_REVIEW = '.designkit/agents/design-reviewer.md'
const CODE_REVIEW = '.designkit/agents/code-reviewer.md'
console.log('\nDesigning a screen')
rule('design only the sizes in scope; a mobile app gets none', SCREEN, /read `## Screen sizes` in `project\/PROJECT\.md` and design only the sizes it lists/, /A mobile app gets no responsive work/)
rule('open each width in scope, then 320 and 200% text', SCREEN, /390 phone, 768 tablet, 1280 laptop, 1920 by 1080 wide/, /at 320 wide and with the text at 200%/)
rule('nothing moves after it appears; animations replay', SCREEN, /nothing may move after it appears/, /plays the same on every load unless `DECISIONS\.md` says once/)
rule('long means thousands', SCREEN, /thousands of rows/)
rule('features by business job', SCREEN, /`src\/features\/<job>\/`, the business job it serves/)
rule("wrappers: DS names by the rulebook's wrapper rule, no raw controls", SCREEN, /`src\/components\/DS<Part>\.tsx` by the wrapper rule/, /never uses a raw `<button>`, `<input>`, `<select>` or `<textarea>` \(gate `dk-11`\)/)
rule('the wrapper guide agrees with the rulebook', '.agents/skills/shadcn-ui/SKILL.md', /native props and `ref` pass through/, /two or three variants, two sizes/)
rule('fields focus by border, buttons by a keyboard ring', SCREEN, /Fields show focus by their border colour/, /for keyboard focus only/)
rule('the design review checks the same widths, none for a mobile app', DESIGN_REVIEW, /the widths `## Screen sizes` in `PROJECT\.md` lists, plus 320 wide and the text at 200%/, /Mobile app: no widths/, /say the widths were read, not opened/)
rule('the handover review checks the dev list', CODE_REVIEW, /one icon set/, /each part's variants a closed list/, /every top folder in the README's folder map/, /no session files, screenshots, design notes or agent files/)

console.log('\nGate')
rule('the rules name the two new gate ids', AGENTS, /\(`dk-10`\)/, /\(`dk-11`\)/)
rule('setup replaces the start page the gate would refuse', SETUP, /replace the generator's start page/)

console.log('\nThe rulebook')
rule('the rulebook sends a joined project and a handed-over one to their own rules', AGENTS, /`"joined": true`: read `\.designkit\/rules\/joined\.md` now/, /dated handover line: read `\.designkit\/rules\/handover\.md` now/)
rule('features by business job', AGENTS, /`src\/features\/<job>`: one business job with all its screens/, /one `authentication` feature, not four/)
rule('the wrapper rule, exact', AGENTS, /`DS<Part>`/, /The native element's props and `ref` pass through/, /the library's own options never do/, /A new look is first tried as a colour of an existing variant/, /Parts made before this rule keep their names/)
rule('one icon set', AGENTS, /Icons from one set, the one the UI library installs/)
rule("sign-in, permissions and payments are the dev's", AGENTS, /Sign-in, permissions and payments are the dev's to decide/, /as a meeting/)
rule('long means thousands', AGENTS, /`long` means thousands/)
rule('the dev list', AGENTS, /## The dev list/, /`project\/DEV\.md`/, /one numbered message/, /`## From the dev`: their requests, done before the next new screen/)
rule('a design branch starts from main just pulled; an API spec updates types and mock', HANDOVER, /always started from `main` just pulled/, /`types\.ts` and `mock\/` follow it/)
rule('no screenshot suites, no whole-app AI cleanup', AGENTS, /Never build a screenshot or visual test suite, or tooling nobody asked for/, /cleanup is knip, Prettier and the gate/)
rule('the dev list template', 'project/DEV.md', /## To send/, /## Meeting/, /## From the dev/, /## Sent/)

console.log('\nNew apps')
rule('setup reads the joined steps or the build steps only when it needs them', SETUP, /Read `joined\.md`\s+beside this file/, /Follow `<this folder>\/\.agents\/skills\/setup\/build\.md` exactly/)
rule('the shared Prettier config with the import sorter', SETUP_BUILD, /prettier-plugin-organize-imports/, /"semi": true, "singleQuote": false, "trailingComma": "all", "printWidth": 100/)
rule('Node 22 as the floor', SETUP_BUILD, /engines\.node=">=22"/)
rule("hook files hold exactly the kit's lines", SETUP_BUILD, /nothing above them/)
rule('the installer asks for Node 22', 'bin/install', /a >= 22/, /Node\.js 22 or newer is needed/)

rule("setup knows a dev's repo keeps the design notes local", SETUP_JOINED, /`"devRepo": true`/)

rule('an older project gets its screen sizes before any design work', SCREEN, /0\. \*\*Screen sizes, then claim it\.\*\* `## Screen sizes` missing from `project\/PROJECT\.md`[^#]*write it there now/)

rule("a developer's repo: the rules say project/ never enters it", JOINED, /`"devRepo": true`[^#]*`project\/` never enter this repository/)
rule("a developer's repo: the joined rules say so when asked to share notes", JOINED, /`"devRepo": true`/, /never force-add/)

rule('colour copies where tokens cannot be read are allowed', TOKENIZE, /`themeColor`/, /`manifest`/, /social and icon images/)

rule('the rules say what dk-10 and dk-11 read, and what they cannot see', AGENTS, /`pages\/`, `screens\/`, `views\/`/, /cannot see a bare number in a style object/)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
