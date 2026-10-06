# Existing Projects and Lighter Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the kit join a project that already has code, and make deep reviews run only when asked, cover only what changed, and finish in 5 to 10 minutes.

**Architecture:** Three new Node scripts in `.claude/scripts/` (`status.mjs` reads and merges the status file, `review-due.mjs` decides when to suggest a review, `quick-check.mjs` runs the commit-time checks), small changes to `slop-gate.mjs` and `team-sync.mjs`, a new `bin/join-existing.mjs` that `bin/new-project` hands existing code to, and rewritten instructions in `CLAUDE.md`, the commands and the four agents.

**Tech Stack:** Node 20.19+ ESM (`.mjs`, built-ins only), bash, git. Tests: the kit's own runners under `dev/tests/` (plain Node and bash, no test framework).

**Spec:** `dev/specs/2026-10-05-existing-projects-and-lighter-checks.md`. Read it before any task.

## Global Constraints

- No comments in any code file, the kit's scripts and tests included: only a section title of four words or fewer (`/* Status */`), a bare tool directive, or a licence header.
- No em dash anywhere: code, copy, docs, commit messages.
- Script style matches `.claude/scripts/team-sync.mjs`: two spaces, no semicolons, single quotes, a local `readJson(path, fallback)` helper, `spawnSync('git', ...)`.
- New scripts use Node built-ins only; nothing added to `.claude/scripts/package.json`.
- Thresholds, verbatim from the spec: 3 or more screens, 500 or more changed lines of app code, 14 days with at least one change, 20 or more open problems switch the reminder to a fix-up; estimate 3 minutes plus 2 per changed screen, at most 10; a quick-check step slower than 60 seconds stays out of the commit check; a normal review's budget is 8 minutes per agent.
- `STATUS.md` lines are added or deleted, never reworded.
- Stage by name (`git add -- <paths>`); `git add -A`, `--all` and `.` are denied for Claude. Scripts may use `git add -A` only inside a repository they just created (as `bin/new-project` does).
- Commits: `type(scope): what` plus a body with the why; no AI attribution lines.
- Agents never launch themselves: every agent `description` ends with "never launched unasked".

## Review Focus

- A commit made through Claude's Bash tool runs the build inside the commit hook and can pass the tool's default 2-minute limit; `/commit` must commit with a 10-minute timeout (Task 8 pins it with a grep).
- After `team-sync` rebases local commits, the `Reviewed up to:` commit may no longer be in the history; the reminder must still count from the nearest shared ancestor, not crash or go silent (Task 3 test "a rewritten marker").
- In a joined project the app and the design folder are one repository, so edits to `project/` and `.claude/` must not count as app changes (Task 3 test "joined: docs edits do not count").
- `npx tsc` in an app without TypeScript installs an unrelated package called `tsc`; the quick check must only typecheck when `typescript` is a dependency and must never let `npx` install anything (Task 4 test "no TypeScript, no typecheck").
- On a Mac without `gh`, or not signed in, a repository with a GitHub remote must count as public so the kit's files stay out of its history (Task 6 test "public, or unknown").

---

### Task 1: The gate blames only new problems at commit time

**Files:**
- Modify: `.claude/scripts/slop-gate.mjs` (constants block near line 21; `/* Hook */` `split`; `staged`; `cli`)
- Create: `dev/tests/gate/staged.mjs`

**Interfaces:**
- Produces: CLI flag `--staged --new-only`: blocks only hits whose `id|trimmed text` is not in the file's `HEAD` version (same matching as the save hook's `Write` branch). In a workspace with `"joined": true`, `dk-05` and `dk-07` are no longer hard rules, so `skip` in `slop-policy.json` can switch them off.

- [ ] **Step 1: Write the failing test** `dev/tests/gate/staged.mjs`

```js
#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const KIT = resolve(HERE, '../../..')
const tmp = mkdtempSync(join(tmpdir(), 'gate-staged-'))
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' }
let passed = 0
let failed = 0
const check = (name, ok) => {
  if (ok) passed++
  else failed++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`)
}

function project(name, workspace, skip = []) {
  const dir = join(tmp, name)
  mkdirSync(join(dir, '.claude/scripts'), { recursive: true })
  mkdirSync(join(dir, '.claude/skills'), { recursive: true })
  for (const f of ['slop-gate.mjs', 'slop-rules.mjs']) cpSync(join(KIT, '.claude/scripts', f), join(dir, '.claude/scripts', f))
  symlinkSync(join(KIT, '.claude/skills/kill-ai-slop'), join(dir, '.claude/skills/kill-ai-slop'))
  const policy = JSON.parse(readFileSync(join(KIT, '.claude/slop-policy.json'), 'utf8'))
  writeFileSync(join(dir, '.claude/slop-policy.json'), JSON.stringify({ ...policy, skip: [...policy.skip, ...skip] }))
  writeFileSync(join(dir, '.claude/workspace.json'), JSON.stringify(workspace))
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: dir })
  return dir
}
const git = (dir, ...args) => spawnSync('git', args, { cwd: dir, env, encoding: 'utf8' })
const put = (dir, path, text) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true })
  writeFileSync(join(dir, path), text)
  git(dir, 'add', '--', path)
}
const gate = (dir, ...args) => spawnSync(process.execPath, ['.claude/scripts/slop-gate.mjs', '--staged', ...args], { cwd: dir, env, encoding: 'utf8' }).status
const reset = (dir) => git(dir, 'reset', '-q', '--hard')

const old = '// TODO: tidy this up later\nexport const a = 1\n'
const folio = project('Folio', { name: 'Folio', app: '.', joined: true })
put(folio, 'src/a.ts', old)
git(folio, 'commit', '-qm', 'old code')

console.log('Commit check, new problems only')
put(folio, 'src/a.ts', `${old}export const b = 2\n`)
check('an old problem in a touched file does not block with --new-only', gate(folio, '--new-only') === 0)
check('the same change still blocks without --new-only', gate(folio) === 1)
reset(folio)
put(folio, 'src/a.ts', `export const b = 2\n${old}`)
check('a moved old line is not new', gate(folio, '--new-only') === 0)
reset(folio)
put(folio, 'src/a.ts', `${old}// TODO: and another one\n`)
check('a new problem in an old file blocks', gate(folio, '--new-only') === 1)
reset(folio)
put(folio, 'src/b.ts', '// TODO: a brand new file\nexport const c = 3\n')
check('a problem in a new file blocks', gate(folio, '--new-only') === 1)
reset(folio)

console.log('\nRules the designer switched off')
const quiet = project('Quiet', { name: 'Quiet', app: '.', joined: true }, ['dk-07'])
put(quiet, 'src/a.ts', old)
check('joined project: a switched-off dk-07 does not block', gate(quiet) === 0)
const strict = project('Strict', { name: 'Strict', app: '.' }, ['dk-07'])
put(strict, 'src/a.ts', old)
check('project the kit started: dk-07 still has no off switch', gate(strict) === 1)

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
```

- [ ] **Step 2: Run it and see it fail**

Run: `node dev/tests/gate/staged.mjs`
Expected: FAIL on "an old problem in a touched file does not block with --new-only" (the flag is ignored today) and on "joined project: a switched-off dk-07 does not block".

- [ ] **Step 3: Implement**

In `.claude/scripts/slop-gate.mjs`, delete the line `const HARD = new Set(['dk-05', 'dk-07'])` from the constants block, and insert right after `const workspace = readJson(join(DOCS, '.claude/workspace.json'), {})`:

```js
const HARD = new Set(workspace.joined ? [] : ['dk-05', 'dk-07'])
```

Under `/* Hook */`, replace the body of the `if (tool === 'Write') { ... }` branch in `split` so it reuses a new shared function, and add that function just above `split`:

```js
function againstBefore(label, before, abs, hits) {
  if (before === null) return { fresh: hits, older: [] }
  const counts = new Map()
  for (const h of analyze(label, before, abs).hits) counts.set(key(h), (counts.get(key(h)) ?? 0) + 1)
  const fresh = []
  const older = []
  for (const h of hits) {
    const n = counts.get(key(h)) ?? 0
    if (n > 0) {
      counts.set(key(h), n - 1)
      older.push(h)
    } else fresh.push(h)
  }
  return { fresh, older }
}
```

```js
  if (tool === 'Write') return againstBefore(label, git(['show', `HEAD:./${basename(abs)}`], dirname(abs)), abs, hits)
```

Replace `staged`:

```js
function staged(json, noFail, newOnly) {
  const top = git(['rev-parse', '--show-toplevel'], process.cwd())
  if (top === null) throw new Error('--staged needs to run inside a git repository')
  const root = top.trim()
  const names = (git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'], root) ?? '').split('\0').filter(Boolean)
  const hits = []
  const errors = []
  for (const f of names) {
    const abs = real(join(root, f))
    const label = labelFor(abs)
    if (excluded(label) || !kindOf(label)) continue
    const src = git(['show', `:${f}`], root)
    if (src === null) continue
    const r = analyze(label, src, abs)
    hits.push(...(newOnly ? againstBefore(label, git(['show', `HEAD:${f}`], root), abs, r.hits).fresh : r.hits))
    errors.push(...r.errors)
  }
  if (!names.length && !json) console.log('slop-gate: nothing staged to scan')
  report(hits, errors, json, noFail)
}
```

In `cli`, change the staged line to:

```js
  if (argv.includes('--staged')) return staged(json, noFail, argv.includes('--new-only'))
```

- [ ] **Step 4: Run all gate tests**

Run: `node dev/tests/gate/staged.mjs && node dev/tests/gate/run.mjs`
Expected: `7 passed, 0 failed`, then `58/58 probes correct` and `self-test: passed`.

- [ ] **Step 5: Commit**

```bash
git add -- .claude/scripts/slop-gate.mjs dev/tests/gate/staged.mjs
git commit -m "feat(gate): at commit, block only the problems a change adds" -m "An existing project has old problems in files a designer will touch; blocking those would make every commit a cleanup. --new-only compares with the file's last committed version, as the save hook already does. In a joined project the owner may switch off any rule, comments included."
```

---

### Task 2: The status file

**Files:**
- Create: `.claude/scripts/status.mjs`
- Create: `dev/tests/checks/run.mjs` (this task writes its first part; Tasks 3 and 4 extend it)

**Interfaces:**
- Produces, from `.claude/scripts/status.mjs`:
  - `parseStatus(text: string) => { last: string|null, lastDate: string|null, marker: string|null, open: string[], kept: string[] }`
  - `renderStatus(status) => string`: the exact file text, `parseStatus` round-trips it
  - `mergeStatus(base: string, github: string, local: string) => string`: header from the side with the later `Last review` date (a tie keeps GitHub's); each list is the newer side's list plus lines the older side added since `base`

File format (spec section 3):

```
# Status

Last review: 2026-10-05, NOT READY, 6 min, report: check-2026-10-05.md
Reviewed up to: a1b2c3d

## Open
- one line per problem

## Left on purpose
- one line per decision
```

- [ ] **Step 1: Write the failing test** `dev/tests/checks/run.mjs`

```js
#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const KIT = resolve(HERE, '../../..')
const { parseStatus, renderStatus, mergeStatus } = await import(join(KIT, '.claude/scripts/status.mjs'))
const tmp = mkdtempSync(join(tmpdir(), 'checks-tests-'))
let passed = 0
let failed = 0
const check = (name, ok) => {
  if (ok) passed++
  else failed++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`)
}

/* Status file */
console.log('Status file')
const sample = '# Status\n\nLast review: 2026-10-05, NOT READY, 6 min, report: check-2026-10-05.md\nReviewed up to: a1b2c3d\n\n## Open\n- one\n- two\n\n## Left on purpose\n- caps: DECISIONS.md 2026-10-04\n'
const s = parseStatus(sample)
check('reads the marker, the date, open and kept lines', s.marker === 'a1b2c3d' && s.lastDate === '2026-10-05' && s.open.join('|') === 'one|two' && s.kept.length === 1)
check('writes back exactly what it read', renderStatus(s) === sample)
const fresh = parseStatus(renderStatus({ last: null, marker: 'abc1234', open: [], kept: [] }))
check('a new file has no review yet and empty lists', fresh.last === 'none yet' && fresh.lastDate === null && fresh.marker === 'abc1234' && !fresh.open.length)
const github = sample.replace('- two\n', '- two\n- three\n')
const local = sample.replace('2026-10-05, NOT', '2026-10-06, NOT').replace('a1b2c3d', 'e4f5a6b').replace('- one\n', '').replace('- two\n', '- two\n- four\n')
const merged = parseStatus(mergeStatus(sample, github, local))
check("a clash keeps the later review's marker and date", merged.marker === 'e4f5a6b' && merged.lastDate === '2026-10-06')
check('a clash keeps lines either side added', merged.open.includes('three') && merged.open.includes('four'))
check('a line the later review deleted stays deleted', !merged.open.includes('one'))

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
```

- [ ] **Step 2: Run it and see it fail**

Run: `node dev/tests/checks/run.mjs`
Expected: crash with `Cannot find module` for `status.mjs`.

- [ ] **Step 3: Implement** `.claude/scripts/status.mjs`

```js
const list = (title, lines) => `## ${title}\n${lines.map((line) => `- ${line}\n`).join('')}`

export function parseStatus(text) {
  const status = { last: null, lastDate: null, marker: null, open: [], kept: [] }
  let section = null
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const last = line.match(/^Last review: (.+)$/)
    const marker = line.match(/^Reviewed up to: (\S+)$/)
    if (last) {
      status.last = last[1]
      status.lastDate = last[1].match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null
    } else if (marker) status.marker = marker[1] === 'none' ? null : marker[1]
    else if (line === '## Open') section = 'open'
    else if (line === '## Left on purpose') section = 'kept'
    else if (line.startsWith('#')) section = null
    else if (section && line.startsWith('- ')) status[section].push(line.slice(2))
  }
  return status
}

export const renderStatus = (s) =>
  `# Status\n\nLast review: ${s.last ?? 'none yet'}\nReviewed up to: ${s.marker ?? 'none'}\n\n${list('Open', s.open)}\n${list('Left on purpose', s.kept)}`

export function mergeStatus(base, github, local) {
  const b = parseStatus(base)
  const g = parseStatus(github)
  const l = parseStatus(local)
  const [newer, older] = (l.lastDate ?? '') > (g.lastDate ?? '') ? [l, g] : [g, l]
  const add = (mine, theirs, was) => [...new Set([...mine, ...theirs.filter((line) => !was.includes(line))])]
  return renderStatus({ ...newer, open: add(newer.open, older.open, b.open), kept: add(newer.kept, older.kept, b.kept) })
}
```

- [ ] **Step 4: Run it**

Run: `node dev/tests/checks/run.mjs`
Expected: `6 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add -- .claude/scripts/status.mjs dev/tests/checks/run.mjs
git commit -m "feat(reviews): one small status file instead of a growing log" -m "Reviews need what is wrong now, what was left on purpose and where the last review stopped, not a history. Lines are added or deleted, never reworded, so the file cannot drift; when two people change it at once, the later review's marker wins and both sides' new lines stay."
```

---

### Task 3: The review reminder

**Files:**
- Create: `.claude/scripts/review-due.mjs`
- Modify: `.claude/settings.json` (`SessionStart` hooks)
- Modify: `.gitignore` (kit root, copied into new projects)
- Modify: `dev/tests/checks/run.mjs` (add a `/* Reminder */` part before the final `rmSync`)

**Interfaces:**
- Consumes: `parseStatus` from Task 2.
- Produces: `node .claude/scripts/review-due.mjs` prints one line starting `Review due` or nothing, and always exits 0. `--decline` writes `{ "declinedAt": "<app HEAD>" }` to `.claude/state/review.json` and prints `Review reminder quiet until more work builds up.`

- [ ] **Step 1: Add the failing tests** to `dev/tests/checks/run.mjs`, just before `rmSync(tmp, ...)`

```js
/* Reminder */
console.log('\nReview reminder')
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' }
function folder(name, app) {
  const docs = join(tmp, name)
  mkdirSync(join(docs, '.claude/scripts'), { recursive: true })
  mkdirSync(join(docs, 'project/reviews'), { recursive: true })
  for (const f of ['review-due.mjs', 'status.mjs', 'quick-check.mjs']) if (existsSync(join(KIT, '.claude/scripts', f))) cpSync(join(KIT, '.claude/scripts', f), join(docs, '.claude/scripts', f))
  writeFileSync(join(docs, '.claude/workspace.json'), JSON.stringify({ name, app, ...(app === '.' ? { joined: true } : {}) }))
  return { docs, app: resolve(docs, app) }
}
const tools = ({ docs, app }) => {
  const git = (args, extra = {}) => (spawnSync('git', args, { cwd: app, encoding: 'utf8', env: { ...env, ...extra } }).stdout ?? '').trim()
  return {
    git,
    due: (...args) => spawnSync(process.execPath, [join(docs, '.claude/scripts/review-due.mjs'), ...args], { cwd: docs, encoding: 'utf8' }).stdout.trim(),
    write: (path, text) => {
      mkdirSync(dirname(join(app, path)), { recursive: true })
      writeFileSync(join(app, path), text)
    },
    commit: (message, extra) => {
      git(['add', '--all'])
      git(['commit', '-qm', message], extra)
    },
    mark: (sha, open = []) => writeFileSync(join(docs, 'project/reviews/STATUS.md'), renderStatus({ last: null, marker: sha, open, kept: [] })),
  }
}
const screen = (name) => [`src/features/${name}/View.tsx`, `export const ${name} = () => null\n`]

const two = folder('Folio', 'Folio-app')
const t = tools(two)
check('silent before the app has a repository', t.due() === '')
mkdirSync(two.app, { recursive: true })
t.git(['init', '-q', '-b', 'main'])
t.write(...screen('home'))
t.commit('feat: home')
check('silent without a status file', t.due() === '')
t.mark(t.git(['rev-parse', 'HEAD']))
check('silent with nothing changed', t.due() === '')
for (const n of ['about', 'archive']) t.write(...screen(n))
t.commit('feat: two screens')
check('two screens changed: not yet', t.due() === '')
t.write(...screen('contact'))
t.commit('feat: a third screen')
const three = t.due()
check('three screens changed: due, with an estimate', /^Review due: 3 screens changed/.test(three) && /About 9 minutes/.test(three))
check('a no is recorded', /quiet until more work/.test(t.due('--decline')))
check('after a no, it is quiet', t.due() === '')
for (const n of ['one', 'two']) t.write(...screen(n))
t.commit('feat: two more')
check('two more screens after the no: still quiet', t.due() === '')
t.write(...screen('three'))
t.commit('feat: one more')
check('three screens past the no: due again', /3 screens changed/.test(t.due()))

t.mark(t.git(['rev-parse', 'HEAD']))
t.write('package-lock.json', 'x\n'.repeat(600))
t.commit('chore: lock')
check('lock files do not count', t.due() === '')
t.write('src/lib/big.ts', 'export const n = 1\n'.repeat(520))
t.commit('feat: big')
check('500 or more changed lines: due', /520 lines of app code changed/.test(t.due()))

t.git(['commit', '-q', '--allow-empty', '-m', 'chore: old'], { GIT_COMMITTER_DATE: new Date(Date.now() - 20 * 86400000).toISOString() })
t.mark(t.git(['rev-parse', 'HEAD']))
t.write('src/lib/small.ts', 'export const s = 1\n')
t.commit('feat: small')
check('14 days with a change: due', /20 days since the last review/.test(t.due()))

t.mark(t.git(['rev-parse', 'HEAD']), Array.from({ length: 20 }, (_, i) => `problem ${i}`))
for (const n of ['p', 'q', 'r']) t.write(...screen(n))
t.commit('feat: three')
check('20 open problems: suggests a fix-up instead', /fix-up session/.test(t.due()))

const head = t.git(['rev-parse', 'HEAD'])
t.write('src/lib/side.ts', 'export const side = 1\n')
t.commit('feat: side')
const gone = t.git(['rev-parse', 'HEAD'])
t.git(['reset', '-q', '--hard', head])
t.mark(gone)
for (const n of ['x', 'y', 'z']) t.write(...screen(n))
t.commit('feat: three after a rewrite')
check('a rewritten marker: counts from the shared ancestor', /3 screens changed/.test(t.due()))
t.mark('zzzzzzz')
check('a marker that is not a commit: silent, no crash', t.due() === '')

const one = folder('Single', '.')
const j = tools(one)
j.git(['init', '-q', '-b', 'main'])
j.write(...screen('home'))
j.commit('feat: home')
j.mark(j.git(['rev-parse', 'HEAD']))
j.git(['add', '--all'])
j.git(['commit', '-qm', 'docs: status'])
for (const n of ['a', 'b', 'c']) writeFileSync(join(one.docs, 'project/reviews', `${n}.md`), 'x\n'.repeat(600))
j.commit('docs: notes')
check('joined: docs edits do not count', j.due() === '')
check('in the kit itself: silent', spawnSync(process.execPath, [join(KIT, '.claude/scripts/review-due.mjs')], { cwd: KIT, encoding: 'utf8' }).stdout.trim() === '')
```

- [ ] **Step 2: Run it and see it fail**

Run: `node dev/tests/checks/run.mjs`
Expected: the six status checks pass, then every reminder check FAILS (`review-due.mjs` does not exist yet, so nothing is printed where a line is expected).

Add `existsSync` to the `node:fs` import at the top of the file.

- [ ] **Step 3: Implement** `.claude/scripts/review-due.mjs`

```js
#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseStatus } from './status.mjs'

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const IS_KIT = existsSync(join(HERE, 'bin/new-project'))
const STATE = join(HERE, '.claude/state/review.json')
const STATUS = join(HERE, 'project/reviews/STATUS.md')
const IGNORED = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|next-env\.d\.ts)$|\.snap$|(^|\/)(node_modules|\.next|\.expo|dist|build|out|coverage)\/|^(project|\.claude)\/|^CLAUDE\.md$/
const SCREENS = 3
const LINES = 500
const DAYS = 14
const OPEN = 20

const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}
const workspace = readJson(join(HERE, '.claude/workspace.json'), {})
const APP = workspace.app ? resolve(HERE, workspace.app) : null

function git(...args) {
  const r = spawnSync('git', args, { cwd: APP, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return r.status === 0 ? r.stdout.trim() : null
}

function start(marker) {
  const known = git('merge-base', marker, 'HEAD')
  if (!known) return null
  const declined = readJson(STATE, {}).declinedAt
  const later = declined && git('merge-base', '--is-ancestor', known, declined) !== null && git('merge-base', '--is-ancestor', declined, 'HEAD') !== null
  return later ? declined : known
}

function changes(base) {
  const files = []
  let lines = 0
  for (const row of (git('diff', '--numstat', base) ?? '').split('\n').filter(Boolean)) {
    const [added, removed, file] = row.split('\t')
    if (IGNORED.test(file)) continue
    files.push(file)
    lines += (Number(added) || 0) + (Number(removed) || 0)
  }
  return { files, lines }
}

function screens(files) {
  const root = ['src/features', 'features'].find((dir) => existsSync(join(APP, dir)))
  const names = new Set()
  for (const file of files) {
    if (root) {
      const m = file.startsWith(`${root}/`) && file.slice(root.length + 1).match(/^([^/]+)\//)
      if (m) names.add(m[1])
    } else {
      const m = file.match(/^(?:src\/)?app\/(?:(.+)\/)?[^/]+$/)
      if (m) names.add(m[1] ?? '/')
    }
  }
  return names.size
}

function due() {
  if (IS_KIT || !APP || !existsSync(join(APP, '.git')) || !existsSync(STATUS)) return null
  const status = parseStatus(readFileSync(STATUS, 'utf8'))
  if (!status.marker) return null
  const base = start(status.marker)
  if (!base) return null
  const { files, lines } = changes(base)
  if (!files.length) return null
  const count = screens(files)
  const age = Math.floor((Date.now() / 1000 - Number(git('log', '-1', '--format=%ct', base))) / 86400)
  const reason =
    count >= SCREENS
      ? `${count} screens changed since the last review.`
      : lines >= LINES
        ? `${lines} lines of app code changed since the last review.`
        : age >= DAYS
          ? `${age} days since the last review, with changes since.`
          : null
  if (!reason) return null
  if (status.open.length >= OPEN) return `Review due, but ${status.open.length} problems are still open in project/reviews/STATUS.md. Ask the designer, as one yes or no: a fix-up session on those first, most serious first?`
  return `Review due: ${reason} Ask the designer, as one yes or no: run one now? About ${Math.min(10, 3 + 2 * count)} minutes.`
}

function decline() {
  const head = APP && existsSync(join(APP, '.git')) ? git('rev-parse', 'HEAD') : null
  if (!head) return
  mkdirSync(dirname(STATE), { recursive: true })
  writeFileSync(STATE, `${JSON.stringify({ declinedAt: head }, null, 2)}\n`)
  console.log('Review reminder quiet until more work builds up.')
}

try {
  if (process.argv.includes('--decline')) decline()
  else {
    const line = due()
    if (line) console.log(line)
  }
} catch {}
```

In `.claude/settings.json`, add a second hook to the existing `SessionStart` group's `hooks` array, after the `team-sync` one:

```json
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/scripts/review-due.mjs\"",
            "timeout": 30
          }
```

In the kit's `.gitignore`, add under `# Local Claude settings (not shared)`:

```
.claude/state/
```

- [ ] **Step 4: Run it**

Run: `node dev/tests/checks/run.mjs`
Expected: `23 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add -- .claude/scripts/review-due.mjs .claude/settings.json .gitignore dev/tests/checks/run.mjs
git commit -m "feat(reviews): remember when a review is due, so nobody has to" -m "Deep reviews now run only when asked, and the owner said they would forget to ask. The reminder counts screens, changed lines and days since the last review and prints one yes/no line at the start of a chat or after a commit. A no keeps it quiet until enough new work builds up past that point."
```

---

### Task 4: Quick checks at commit time

**Files:**
- Create: `.claude/scripts/quick-check.mjs`
- Modify: `dev/tests/checks/run.mjs` (add a `/* Quick check */` part before the final `rmSync`)

**Interfaces:**
- Produces: `node .claude/scripts/quick-check.mjs` runs `workspace.quickCheck` (an array of `{ name, run }`), or the steps it finds when that key is absent: `typecheck` (only with `typescript` in the app's dependencies and a `tsconfig.json`), `lint`, `test` (not the npm placeholder), `build`. Stops at the first failure (exit 1, `quick check: <name> failed...` and the last 40 lines). On a pass writes `.claude/state/last-check.json`: `{ date, tree, steps: [{ name, seconds }] }`, where `tree` is `git write-tree` in the app.
- `--list`: prints the steps as JSON without running them.
- `--time [extra npm script names...]`: runs every found step plus the extras, without stopping, and prints `[{ name, run, ok, seconds }]`.

- [ ] **Step 1: Add the failing tests** before the final `rmSync`

```js
/* Quick check */
console.log('\nQuick check')
const q = folder('Quick', 'Quick-app')
const qt = tools(q)
mkdirSync(q.app, { recursive: true })
qt.git(['init', '-q', '-b', 'main'])
const pkg = (extra) => writeFileSync(join(q.app, 'package.json'), JSON.stringify({ name: 'quick', private: true, ...extra }))
const quick = (...args) => spawnSync(process.execPath, [join(q.docs, '.claude/scripts/quick-check.mjs'), ...args], { cwd: q.app, encoding: 'utf8' })
pkg({ scripts: { lint: 'node -e ""', build: 'node -e ""', test: 'echo "Error: no test specified" && exit 1' } })
writeFileSync(join(q.app, 'tsconfig.json'), '{}')
const names = () => JSON.parse(quick('--list').stdout).map((s) => s.name).join(' ')
check('no TypeScript, no typecheck; the npm test placeholder is not a test', names() === 'lint build')
pkg({ scripts: { lint: 'node -e ""', build: 'node -e ""' }, devDependencies: { typescript: '5.9.0' } })
check('TypeScript in the app: typecheck comes first', names() === 'typecheck lint build')
pkg({ scripts: { lint: 'node -e ""', build: 'node -e ""' } })
qt.git(['add', 'package.json'])
const pass = quick()
const state = JSON.parse(readFileSync(join(q.docs, '.claude/state/last-check.json'), 'utf8'))
check('a pass is recorded with the tree it checked', pass.status === 0 && state.tree === qt.git(['write-tree']) && state.steps.map((s) => s.name).join(' ') === 'lint build')
writeFileSync(join(q.docs, '.claude/workspace.json'), JSON.stringify({ name: 'Quick', app: 'Quick-app', quickCheck: [{ name: 'lint', run: 'node -e "process.exit(3)"' }] }))
const fail = quick()
check('a failing step stops the commit and is named', fail.status === 1 && /quick check: lint failed/.test(fail.stderr))
const timed = JSON.parse(quick('--time').stdout)
check('--time runs what it finds, not the saved list, and times each', timed.map((s) => s.name).join(' ') === 'lint build' && timed.every((s) => s.ok && Number.isInteger(s.seconds)))
```

Add `readFileSync` to the `node:fs` import at the top of the file.

- [ ] **Step 2: Run it and see it fail**

Run: `node dev/tests/checks/run.mjs`
Expected: a crash parsing the `--list` output (`quick-check.mjs` does not exist yet, so `folder` copied nothing).

- [ ] **Step 3: Implement** `.claude/scripts/quick-check.mjs`

```js
#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const STATE = join(HERE, '.claude/state/last-check.json')
const PLACEHOLDER = /no test specified/

const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}
const workspace = readJson(join(HERE, '.claude/workspace.json'), {})
const APP = workspace.app ? resolve(HERE, workspace.app) : process.cwd()
const pkg = readJson(join(APP, 'package.json'), {})
const scripts = pkg.scripts ?? {}
const deps = { ...pkg.dependencies, ...pkg.devDependencies }

function found() {
  const steps = []
  if (deps.typescript && existsSync(join(APP, 'tsconfig.json'))) {
    const typegen = deps.next ? '(npx --no-install next typegen >/dev/null 2>&1 || true) && ' : ''
    steps.push({ name: 'typecheck', run: `${typegen}npx --no-install tsc --noEmit` })
  }
  if (scripts.lint) steps.push({ name: 'lint', run: 'npm run lint --silent' })
  if (scripts.test && !PLACEHOLDER.test(scripts.test)) steps.push({ name: 'test', run: 'npm test --silent' })
  if (scripts.build) steps.push({ name: 'build', run: 'npm run build --silent' })
  return steps
}
const steps = () => workspace.quickCheck ?? found()
const tail = (text) => text.trimEnd().split('\n').slice(-40).join('\n')

function run(step) {
  const begin = Date.now()
  const r = spawnSync(step.run, { cwd: APP, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return { ...step, ok: r.status === 0, seconds: Math.round((Date.now() - begin) / 1000), output: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

function tree() {
  const r = spawnSync('git', ['write-tree'], { cwd: APP, encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : null
}

function check() {
  const done = []
  for (const step of steps()) {
    const r = run(step)
    if (!r.ok) {
      console.error(`quick check: ${r.name} failed. Fix it, stage the fix, and commit again.\n${tail(r.output)}`)
      process.exit(1)
    }
    done.push({ name: r.name, seconds: r.seconds })
  }
  mkdirSync(dirname(STATE), { recursive: true })
  writeFileSync(STATE, `${JSON.stringify({ date: new Date().toISOString(), tree: tree(), steps: done }, null, 2)}\n`)
  if (done.length) console.log(`quick check: passed (${done.map((s) => `${s.name} ${s.seconds}s`).join(', ')})`)
}

const args = process.argv.slice(2)
if (args[0] === '--list') console.log(JSON.stringify(steps(), null, 2))
else if (args[0] === '--time') {
  const extra = args.slice(1).map((name) => ({ name, run: `npm run ${name} --silent` }))
  console.log(JSON.stringify([...found(), ...extra].map(run).map(({ output, ...r }) => r), null, 2))
} else check()
```

- [ ] **Step 4: Run it**

Run: `node dev/tests/checks/run.mjs`
Expected: `28 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add -- .claude/scripts/quick-check.mjs dev/tests/checks/run.mjs
git commit -m "feat(checks): typecheck, lint, tests and build on every app commit" -m "The fast, automatic checks belong at the commit, where they take about a minute, so the deep reviews no longer need to repeat them. A pass is noted on this Mac with the exact code it checked, which lets bug-hunter skip work already done. It never lets npx install anything."
```

---

### Task 5: team-sync works with one repository and merges the status file

**Files:**
- Modify: `.claude/scripts/team-sync.mjs` (imports; constants at lines 8 to 31; `settleConflicts`; `rememberAppRemote`)
- Modify: `dev/tests/team/run.sh` (two new sections before the final summary)

**Interfaces:**
- Consumes: `mergeStatus` from Task 2.
- Produces: with `"app": "."` the project is one repository labelled `project` (`Shared 1 change(s) to GitHub from the project.`); a rebase clash on `project/reviews/STATUS.md` is merged, never saved to `conflicts/`.

- [ ] **Step 1: Add the failing tests** to `dev/tests/team/run.sh`, after the "Different parts merge by themselves" section

```bash
echo
echo "Status file changed by two people"
st=project/reviews/STATUS.md
status_file() {
  printf '# Status\n\nLast review: %s, READY, 5 min, report: check-%s.md\nReviewed up to: %s\n\n## Open\n' "$1" "$1" "$2"
  shift 2
  for line in "$@"; do printf -- '- %s\n' "$line"; done
  printf '\n## Left on purpose\n'
}
(cd "$alice" && sync --start >/dev/null)
status_file 2026-10-05 aaaaaaa shared >"$alice/$st"
git -C "$alice" add "$st" && git -C "$alice" commit -qm "docs(reviews): review up to aaaaaaa"
(cd "$alice" && sync --share >/dev/null)
(cd "$bob" && sync --start >/dev/null)
status_file 2026-10-06 bbbbbbb shared alice-found >"$alice/$st"
git -C "$alice" commit -qam "docs(reviews): review up to bbbbbbb"
(cd "$alice" && sync --share >/dev/null)
status_file 2026-10-07 ccccccc bob-found >"$bob/$st"
git -C "$bob" commit -qam "docs(reviews): review up to ccccccc"
out="$(cd "$bob" && sync --share)"
merged="$(git -C "$HOME/github/Tally-docs.git" show "main:$st")"
check "a status clash keeps the later review's marker" "grep -q 'Reviewed up to: ccccccc' <<<\"\$merged\""
check "a status clash keeps what both sides found" "grep -q -- '- alice-found' <<<\"\$merged\" && grep -q -- '- bob-found' <<<\"\$merged\""
check "a line the later review fixed stays gone, and no overlap is reported" "! grep -q -- '- shared' <<<\"\$merged\" && ! grep -q 'Overlapping' <<<\"\$out\""

echo
echo "One repository (a joined project)"
one="$HOME/one/Folio"
mkdir -p "$one/.claude/scripts"
cp "$HOME/design-kit/.claude/scripts/team-sync.mjs" "$HOME/design-kit/.claude/scripts/status.mjs" "$one/.claude/scripts/"
printf '{"name":"Folio","app":".","joined":true}\n' >"$one/.claude/workspace.json"
git init -q --bare -b main "$HOME/github/Folio.git"
git -C "$one" init -q -b main && as "$one" Solo
git -C "$one" add .claude && git -C "$one" commit -qm "chore: start"
git -C "$one" remote add origin "$HOME/github/Folio.git"
out="$(cd "$one" && sync --share)"
check "one repository is shared once, as the project" "[ \"\$(grep -c 'Shared' <<<\"\$out\")\" = 1 ] && grep -q 'from the project' <<<\"\$out\" && git -C '$HOME/github/Folio.git' rev-parse main >/dev/null 2>&1"
check "no app home is recorded for a single repository" "! grep -q appRemote '$one/.claude/workspace.json'"
```

- [ ] **Step 2: Run it and see it fail**

Run: `bash dev/tests/team/run.sh`
Expected: the status clash checks FAIL (Bob's version is saved under `conflicts/`, `Overlapping` reported) and "one repository is shared once" FAILS (it is shared twice, as app and design folder).

- [ ] **Step 3: Implement** in `.claude/scripts/team-sync.mjs`

Add to the imports:

```js
import { mergeStatus } from './status.mjs'
```

Add next to `WORKING_FILE`:

```js
const STATUS_FILE = 'project/reviews/STATUS.md'
```

Replace the three lines that define `APP`, `DOCS` and `REPOS` with:

```js
const APP = workspace.app ? resolve(HERE, workspace.app) : null
const ONE = APP === HERE
const DOCS = { label: ONE ? 'project' : 'design folder', dir: HERE }
const REPOS = [APP && !ONE && existsSync(join(APP, '.git')) ? { label: 'app', dir: APP } : null, DOCS].filter(Boolean)
```

Add after `settleClaims`:

```js
function settleStatus(repo) {
  const side = (stage) => git(['show', `:${stage}:${STATUS_FILE}`], repo.dir).out
  writeFileSync(join(HERE, STATUS_FILE), mergeStatus(side(1), side(2), side(3)))
  git(['add', '--', STATUS_FILE], repo.dir)
}
```

In `settleConflicts`, inside the `for (const file of unmerged(repo.dir))` loop, before the `WORKING_FILE` check:

```js
      if (repo === DOCS && file === STATUS_FILE) {
        settleStatus(repo)
        continue
      }
```

In `rememberAppRemote`, change the first line to:

```js
  if (!APP || ONE || !hasRemote(APP)) return
```

- [ ] **Step 4: Run it**

Run: `bash dev/tests/team/run.sh`
Expected: every check `ok`, last line `33 passed, 0 failed` (28 before, plus 5).

- [ ] **Step 5: Commit**

```bash
git add -- .claude/scripts/team-sync.mjs dev/tests/team/run.sh
git commit -m "feat(team): one repository for joined projects, merged status files" -m "A joined project keeps its own single repository, so the sync must not treat it as two. Two people's reviews can change STATUS.md at once; a clash there is merged by meaning (the later marker, both sides' new lines) instead of filed as a conflict."
```

---

### Task 6: Joining a project that already has code

**Files:**
- Create: `bin/join-existing.mjs`
- Modify: `bin/new-project` (hand existing code to the join; drop the `package.json` refusal)
- Modify: `dev/tests/install/run.sh` (replace the "a folder that already holds code" refusal; add a "Joining" section after "Refusals")
- Modify: `README.md` ("Start a project", "For Claude" step 3, "What is in here")

**Interfaces:**
- Consumes: nothing from earlier tasks at run time; copies `.claude/scripts/` as it is at the time (Tasks 1 to 5 included).
- Produces: two modes, picked by `bin/new-project` from the folder and printed on the first line of its output: `Start mode:` (an empty folder, brief files only, or an empty git repository, which keeps its `origin`) and `Join mode:` (`package.json`, or a `.git` with commits). `node bin/join-existing.mjs <target> <kit>`; a joined project has `.claude/workspace.json` `{ name, app: ".", joined: true, kit, visibility }`, `.claude/design-kit.md`, the line `@.claude/design-kit.md` in `CLAUDE.md`, `git config designkit.docs .`, and one commit `chore: add the design kit`. Prints `now has the design kit`, the kept files, and, when public, `stay on this Mac`. `DESIGNKIT_VISIBILITY` (`public` or `private`) overrides detection.

- [ ] **Step 1: Write the failing tests** in `dev/tests/install/run.sh`

Delete these four lines from the "Refusals" section:

```bash
mkdir -p "$HOME/Projects/Repo" && git -C "$HOME/Projects/Repo" init -q
check "a folder that is already a git repo" 'refused "$HOME/Projects/Repo" && [ ! -e "$HOME/Projects/Repo/CLAUDE.md" ]'
mkdir -p "$HOME/Projects/Code" && printf '{}\n' >"$HOME/Projects/Code/package.json"
check "a folder that already holds code" 'refused "$HOME/Projects/Code" && [ ! -e "$HOME/Projects/Code/CLAUDE.md" ]'
```

In the "New project from the designer's folder" section, after the check "finishes and points to /setup", add:

```bash
check "says it is in start mode" 'head -3 "$sandbox/new.log" | grep -q "Start mode"'
```

Insert after the "Refusals" section:

```bash
echo
echo "Start mode in an empty repository"
e="$HOME/Projects/Empty"
git init -q -b main "$e" && git -C "$e" remote add origin https://example.com/empty.git
bash "$new" "$e" </dev/null >"$sandbox/empty.log" 2>&1
check "an empty repository starts a new project and keeps its GitHub link" '[ -f "$e/CLAUDE.md" ] && [ -d "$e/Empty-app/.git" ] && [ "$(git -C "$e" remote get-url origin)" = https://example.com/empty.git ] && grep -q "Start mode" "$sandbox/empty.log"'

echo
echo "Joining a project that already has code"
git config --global user.name Nobody
git config --global user.email nobody@example.com
f="$HOME/Projects/Folio"
mkdir -p "$f/src" "$f/.claude/agents"
printf '{"name":"folio","scripts":{"lint":"true"}}\n' >"$f/package.json"
printf '# Folio\n\nKeep the deck CSS in one file.\n' >"$f/CLAUDE.md"
printf 'mine\n' >"$f/.claude/agents/bug-hunter.md"
printf 'export const a = 1\n' >"$f/src/a.ts"
git -C "$f" init -q -b main && git -C "$f" add -A && git -C "$f" commit -qm "feat: the site"
(cd "$f" && bash "$new" </dev/null >"$sandbox/join.log" 2>&1)
status=$?
check "joins instead of refusing, and says it is in join mode" '[ $status -eq 0 ] && head -3 "$sandbox/join.log" | grep -q "Join mode" && grep -q "now has the design kit" "$sandbox/join.log"'
check "the project's code is untouched" '[ "$(cat "$f/src/a.ts")" = "export const a = 1" ] && git -C "$f" diff --quiet HEAD~1 HEAD -- src package.json'
check "CLAUDE.md keeps its words and loads the kit" 'grep -q "Keep the deck CSS" "$f/CLAUDE.md" && grep -qx "@.claude/design-kit.md" "$f/CLAUDE.md" && [ -f "$f/.claude/design-kit.md" ]'
check "a file the project already has is kept, and named" '[ "$(cat "$f/.claude/agents/bug-hunter.md")" = mine ] && grep -q ".claude/agents/bug-hunter.md" "$sandbox/join.log" && [ -f "$f/.claude/agents/design-reviewer.md" ]'
check "one repository, marked joined" 'grep -q "\"app\": \".\"" "$f/.claude/workspace.json" && grep -q "\"joined\": true" "$f/.claude/workspace.json" && [ ! -e "$f/Folio-app" ]'
check "one kit commit, nothing left unsaved" '[ "$(git -C "$f" rev-list --count HEAD)" = 2 ] && [ "$(git -C "$f" log -1 --format=%s)" = "chore: add the design kit" ] && [ -z "$(git -C "$f" status --porcelain)" ]'
check "the commit check finds the gate through ." '[ "$(git -C "$f" config designkit.docs)" = . ]'
check "local state stays out of git" 'git -C "$f" check-ignore -q .claude/state/review.json'
(cd "$f" && bash "$new" </dev/null >"$sandbox/join2.log" 2>&1)
check "running again only says it is set up" 'grep -q "already a Design Kit project" "$sandbox/join2.log" && [ "$(git -C "$f" rev-list --count HEAD)" = 2 ]'
u="$HOME/Projects/Unsaved"
mkdir -p "$u" && printf '{}\n' >"$u/package.json"
git -C "$u" init -q -b main && git -C "$u" add -A && git -C "$u" commit -qm first
printf '{"x":1}\n' >"$u/package.json"
check "unsaved changes: refuses and changes nothing" 'refused "$u" && grep -q "unsaved changes" "$sandbox/refused.log" && [ ! -e "$u/.claude" ]'
n="$HOME/Projects/NoHistory"
mkdir -p "$n" && printf '{"name":"nohistory"}\n' >"$n/package.json"
bash "$new" "$n" </dev/null >/dev/null 2>&1
check "code without history gets its first commit, then the kit" '[ "$(git -C "$n" rev-list --count HEAD)" = 2 ] && git -C "$n" log --format=%s | grep -q "as it was before the design kit"'
pub="$HOME/Projects/Public"
mkdir -p "$pub" && printf '{}\n' >"$pub/package.json"
git -C "$pub" init -q -b main && git -C "$pub" add -A && git -C "$pub" commit -qm first
git -C "$pub" remote add origin https://example.com/public.git
printf '#!/usr/bin/env bash\nexit 1\n' >"$HOME/.local/bin/gh" && chmod +x "$HOME/.local/bin/gh"
(cd "$pub" && PATH="$HOME/.local/bin:$PATH" bash "$new" </dev/null >"$sandbox/public.log" 2>&1)
check "public, or unknown: the kit's files stay out of history" '[ -z "$(git -C "$pub" ls-files .claude)" ] && [ -f "$pub/.claude/agents/bug-hunter.md" ] && [ -f "$pub/.claude/settings.local.json" ] && [ -z "$(git -C "$pub" status --porcelain)" ] && grep -q "stay on this Mac" "$sandbox/public.log"'
```

- [ ] **Step 2: Run it and see it fail**

Run: `bash dev/tests/install/run.sh`
Expected: "joins instead of refusing" and the rest of the new section FAIL (`new-project` refuses a git repository).

- [ ] **Step 3: Implement** `bin/join-existing.mjs`

```js
#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'

const [target, kit] = process.argv.slice(2)
const name = basename(target).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-._]+|[-._]+$/g, '') || 'project'
const IMPORT = '@.claude/design-kit.md'
const SKIP = new Set(['node_modules', '.DS_Store'])
const DIRS = ['.claude/agents', '.claude/commands', '.claude/output-styles', '.claude/skills', '.claude/scripts']
const FILES = [
  ['.claude/slop-policy.json', '.claude/slop-policy.json'],
  ['.claude/upstream.json', '.claude/upstream.json'],
  ['CLAUDE.md', '.claude/design-kit.md'],
  ['THIRD-PARTY-NOTICES.md', '.claude/THIRD-PARTY-NOTICES.md'],
  ['licenses', '.claude/licenses'],
]
const PROJECT = ['brief', 'design-system', 'reviews', 'screens']

const say = (text) => console.log(text)
const fail = (text) => {
  console.error(`new-project: ${text}`)
  process.exit(1)
}
const git = (...args) => {
  const r = spawnSync('git', args, { cwd: target, encoding: 'utf8' })
  return { ok: r.status === 0, out: (r.stdout ?? '').trim() }
}
const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}
const same = (a, b) => statSync(a).isFile() && statSync(b).isFile() && readFileSync(a).equals(readFileSync(b))

/* History */
function history() {
  if (!existsSync(join(target, '.git'))) git('init', '-q', '-b', 'main')
  if (!git('rev-parse', '-q', '--verify', 'HEAD').ok) {
    git('add', '-A')
    if (!git('commit', '-q', '-m', 'chore: keep the project as it was before the design kit').ok) fail('could not save the project as it is. Set a name for the work history (git config --global user.name), then run this again.')
  }
  if (git('status', '--porcelain', '--untracked-files=no').out) fail(`${basename(target)} has unsaved changes. Commit them first, then run this again.`)
}

function findVisibility() {
  if (process.env.DESIGNKIT_VISIBILITY) return process.env.DESIGNKIT_VISIBILITY
  if (!git('remote', 'get-url', 'origin').ok) return 'private'
  const r = spawnSync('gh', ['repo', 'view', '--json', 'visibility', '-q', '.visibility'], { cwd: target, encoding: 'utf8' })
  return r.status === 0 && /^(PRIVATE|INTERNAL)$/.test(r.stdout.trim()) ? 'private' : 'public'
}

/* Copy */
const added = []
const kept = []
function place(from, to) {
  const rel = relative(target, to)
  if (existsSync(to)) {
    if (!same(from, to)) kept.push(rel)
    return
  }
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to, { recursive: true, filter: (src) => !SKIP.has(basename(src)) })
  added.push(rel)
}

function copyKit() {
  for (const dir of DIRS) for (const entry of readdirSync(join(kit, dir)).filter((e) => !SKIP.has(e))) place(join(kit, dir, entry), join(target, dir, entry))
  for (const [from, to] of FILES) place(join(kit, from), join(target, to))
  for (const dir of PROJECT) {
    if (existsSync(join(target, 'project', dir))) continue
    mkdirSync(join(target, 'project', dir), { recursive: true })
    writeFileSync(join(target, 'project', dir, '.gitkeep'), '')
    added.push(`project/${dir}/.gitkeep`)
  }
}

/* Settings */
function mergeSettings(mine, kits) {
  const out = { ...mine }
  for (const key of ['outputStyle', 'attribution', 'includeCoAuthoredBy']) if (!(key in out) && key in kits) out[key] = kits[key]
  out.permissions = { ...mine.permissions, deny: [...new Set([...(mine.permissions?.deny ?? []), ...(kits.permissions?.deny ?? [])])] }
  out.hooks = { ...mine.hooks }
  for (const [event, groups] of Object.entries(kits.hooks ?? {})) {
    const have = JSON.stringify(out.hooks[event] ?? [])
    out.hooks[event] = [...(out.hooks[event] ?? []), ...groups.filter((g) => !g.hooks.every((h) => have.includes(JSON.stringify(h.command))))]
  }
  return out
}

function settings(file) {
  const path = join(target, '.claude', file)
  writeJson(path, mergeSettings(readJson(path, {}), readJson(join(kit, '.claude/settings.json'), {})))
}

function mcp(isPublic) {
  const path = join(target, '.mcp.json')
  if (isPublic && existsSync(path)) return false
  const mine = readJson(path, {})
  const servers = { ...readJson(join(kit, '.mcp.json'), {}).mcpServers, ...mine.mcpServers }
  if (Object.keys(servers).length === Object.keys(mine.mcpServers ?? {}).length) return false
  writeJson(path, { ...mine, mcpServers: servers })
  return true
}

function claudeMd() {
  const path = join(target, 'CLAUDE.md')
  const text = existsSync(path) ? readFileSync(path, 'utf8') : ''
  if (text.split(/\r?\n/).includes(IMPORT)) return
  writeFileSync(path, text ? `${text.replace(/\n*$/, '\n')}\n${IMPORT}\n` : `${IMPORT}\n`)
}

function exclude(paths) {
  const file = resolve(target, git('rev-parse', '--git-path', 'info/exclude').out)
  mkdirSync(dirname(file), { recursive: true })
  const have = existsSync(file) ? readFileSync(file, 'utf8').split('\n') : []
  const lines = paths.filter((p) => !have.includes(p))
  if (lines.length) appendFileSync(file, `${have.length && have.at(-1) !== '' ? '\n' : ''}${lines.join('\n')}\n`)
}

/* Join */
say(`Join mode: ${basename(target)} already has code, so the kit fits around it.`)
history()
const visibility = findVisibility()
const isPublic = visibility === 'public'
copyKit()
settings(isPublic ? 'settings.local.json' : 'settings.json')
const mcpAdded = mcp(isPublic)
claudeMd()
const home = homedir()
writeJson(join(target, '.claude/workspace.json'), { name, app: '.', joined: true, kit: kit.startsWith(`${home}/`) ? `~/${kit.slice(home.length + 1)}` : kit, visibility })
git('config', 'designkit.docs', '.')
const local = ['/.claude/state/', '/.claude/scripts/node_modules/']
const kitOnly = [...added.filter((p) => !p.startsWith('project/')), '.claude/settings.local.json', '.claude/workspace.json', ...(mcpAdded ? ['.mcp.json'] : [])]
exclude(isPublic ? [...local, ...kitOnly.map((p) => `/${p}`)] : local)
if (spawnSync('npm', ['ci', '--no-audit', '--no-fund', '--silent'], { cwd: join(target, '.claude/scripts') }).status !== 0) console.error("new-project: could not install the slop gate's parser (offline?). /setup will retry.")
const projectFiles = added.filter((p) => p.startsWith('project/'))
const stage = isPublic ? ['CLAUDE.md', ...projectFiles] : ['CLAUDE.md', '.claude/settings.json', '.claude/workspace.json', ...added, ...(mcpAdded ? ['.mcp.json'] : [])]
git('add', '--', ...stage)
const why = isPublic
  ? 'CLAUDE.md now loads the design kit when it is present on the machine. The kit itself stays out of this public repository: some of its skills may not be shared.'
  : "The design kit's skills, review agents, commands and checks now sit beside the existing code in .claude/, and CLAUDE.md loads the kit's rules from .claude/design-kit.md. Nothing of the project moved or changed. Where the kit's rules clash with how the project works is settled next, in /setup."
git('commit', '-q', '-m', 'chore: add the design kit', '-m', why)

say(`\n  ${name} now has the design kit, beside its own code. Nothing of the project moved.`)
if (kept.length) say(`  Kept the project's own ${kept.join(', ')}; the kit's versions were not copied.`)
if (isPublic) say("  The repository is public, so the kit's files stay on this Mac and out of its history.")
say('\n  Next: /setup. It reads the project and asks only what it cannot find.\n')
```

In `bin/new-project`, replace these two lines:

```bash
[ ! -e "$target/.git" ] || fail "$target is already a git repository. Start from a new folder."
[ ! -e "$target/package.json" ] || fail "$target already holds code. Start from a new folder."
```

with:

```bash
if [ -e "$target/package.json" ] || { [ -e "$target/.git" ] && git -C "$target" rev-parse -q --verify HEAD >/dev/null 2>&1; }; then
  exec node "$kit/bin/join-existing.mjs" "$target" "$kit"
fi
```

Just before the `rsync -a --exclude .git ...` line (after every refusal has had its chance), add:

```bash
echo "Start mode: $(basename "$target") has no code yet, so a new project starts here."
```

Further down, replace `git -C "$target" init -q -b main` with:

```bash
[ -e "$target/.git" ] || git -C "$target" init -q -b main
```

so an empty repository keeps its own history settings and its `origin`.

In `README.md`:
- Under "Start a project", after the numbered list, add: `The kit picks one of two modes from what is in the folder. Start: an empty folder, one with only a brief, or an empty repository you made on GitHub (its link is kept). Join: a folder that already has code; the kit fits around it, nothing moves, Claude reads the project first and asks only what it cannot find, and where the kit's rules clash with how the project works, you choose once.`
- "For Claude" step 3 becomes: ``3. `~/design-kit/bin/new-project`: makes the current folder the project. A folder that already holds code joins instead, as it is (one repository, nothing moved). If it refuses, pass its reason on in plain words.``
- "What is in here", the `bin/new-project` line: append ``; for a folder that already holds code it runs `bin/join-existing.mjs`, which adds the kit beside the code.``

- [ ] **Step 4: Run it**

Run: `bash dev/tests/install/run.sh`
Expected: every check `ok`; the last line reads `<N> passed, 0 failed`. Write N into `dev/NOTES.md` in Task 9.

- [ ] **Step 5: Commit**

```bash
git add -- bin/join-existing.mjs bin/new-project dev/tests/install/run.sh README.md
git commit -m "feat(join): add the kit to a project that already has code" -m "The kit refused the owner's portfolio because it only knew how to start from an empty folder, and a session then copied parts of it by hand over two days. A folder with code now joins: one repository, nothing moved, files the project already has kept, and a public repository keeps the kit out of its history."
```

---

### Task 7: Reviewers start lighter, stay in scope and stop on time

**Files:**
- Modify: `.claude/agents/bug-hunter.md`, `.claude/agents/design-reviewer.md`, `.claude/agents/slop-checker.md`, `.claude/agents/code-reviewer.md`

**Interfaces:**
- Consumes: `.claude/state/last-check.json` (Task 4), `project/reviews/STATUS.md` (Task 2).
- Produces: each agent accepts from `/check` a scope (a commit, `all`, or paths) and a budget in minutes.

- [ ] **Step 1: Write the failing check** (run from the kit root)

```bash
cat > "$TMPDIR/agents-check.sh" <<'SH'
a=.claude/agents
fail=0
t() { if eval "$2"; then echo "  ok    $1"; else echo "  FAIL  $1"; fail=1; fi; }
for f in $a/*.md; do t "$f says never launched unasked" "sed -n 3p $f | grep -q 'never launched unasked'"; t "$f has no 'Use after/before'" "! sed -n 3p $f | grep -q 'Use after\|Use before'"; done
t "slop-checker on sonnet" "grep -qx 'model: sonnet' $a/slop-checker.md"
t "design-reviewer loads three skills" "[ \$(awk '/^skills:/{f=1;next} /^---/{f=0} f' $a/design-reviewer.md | wc -l) -eq 3 ]"
t "slop-checker loads two skills" "[ \$(awk '/^skills:/{f=1;next} /^---/{f=0} f' $a/slop-checker.md | wc -l) -eq 2 ]"
t "bug-hunter no longer loads dev-conventions" "! grep -q dev-conventions $a/bug-hunter.md"
t "design-reviewer can read the clock and git" "grep -q '^tools:.*Bash' $a/design-reviewer.md"
for f in bug-hunter design-reviewer slop-checker; do t "$f has Scope and time" "grep -q '^## Scope and time' $a/$f.md"; done
t "bug-hunter reuses the commit check" "grep -q 'last-check.json' $a/bug-hunter.md"
exit $fail
SH
bash "$TMPDIR/agents-check.sh"
```

- [ ] **Step 2: Run it and see it fail**

Expected: most lines `FAIL`.

- [ ] **Step 3: Implement**

`bug-hunter.md` frontmatter becomes:

```
---
name: bug-hunter
description: Runs every automated check the app has (typecheck, lint, format, knip dead code, a build, tests) and sorts what they find. Only when the designer asks (test, bugs, broken, does it work, knip), under /check, or at handover; never launched unasked. Sets knip up if the app lacks it.
tools: Bash, Read, Glob, Grep, Edit, Write
model: sonnet
skills:
  - vercel-react-best-practices
  - vercel-react-native-skills
---
```

Insert after the paragraph that ends "never into the app.":

```
## Scope and time
- Under `/check` you get a scope (a commit, `all`, or paths) and a budget in minutes. With a commit,
  the changed files are `git diff --name-only <commit>` in the app plus uncommitted work: read those
  and the files that import them, nothing else.
- First read `project/reviews/STATUS.md` and `project/IDEAS.md` if present; never report what they hold.
- `date +%s` at the start; check it before each new file or page. At the budget, stop and report
  what you covered and what you did not.
- `.claude/state/last-check.json`: if its `tree` equals `git -C <app> rev-parse HEAD^{tree}` and the
  app has no uncommitted changes, the steps it lists by name already passed on this exact code. Skip
  them (typecheck is step 1, lint 2, build 5, test 6) and list them under **Not run** as "passed at
  commit".
```

Replace step 7 of "Run all" with:

```
7. Web only, dev server already running, Chrome DevTools tools available, and a `.tsx`, `.jsx`,
   `.css` or `.scss` file in scope: open only the pages whose files changed. All five scenarios
   (`?scenario=normal`, `empty`, `long`, `error`, `slow`) only for a page that imports from
   `@/api`; otherwise `normal` only. Report console errors, failed requests and a page or scenario
   that shows nothing
```

In "Report", replace `Alone: save \`project/reviews/bugs-<YYYY-MM-DD>.md\`.` with `Alone: save \`project/reviews/bugs-<YYYY-MM-DD>.md\` and delete older \`bugs-*.md\` there (git keeps them).`

`design-reviewer.md` frontmatter becomes:

```
---
name: design-reviewer
description: Reviews finished design work against usability heuristics and accessibility. Only when the designer asks for a design review, an evaluation or a quality check, or under /check when a visual file changed; never launched unasked.
tools: Bash, Read, Glob, Grep, Write
model: sonnet
skills:
  - inclusive-design
  - motion-sensitivity
  - web-design-guidelines
---
```

Insert after the paragraph that ends "never into the app.":

```
## Scope and time
- Under `/check` you get a scope (a commit, `all`, or paths) and a budget in minutes. With a commit,
  review only the screens whose files `git diff --name-only <commit>` in the app lists, plus
  uncommitted work.
- First read `project/reviews/STATUS.md` and `project/IDEAS.md` if present; never report what they hold.
- `date +%s` at the start; check it before each new screen. At the budget, stop and report what you
  covered and what you did not.
- Open a skill only when a finding needs it, from `.claude/skills/<name>/SKILL.md`: `no-slop`
  (generic look), `redesign-existing-projects` (patching a screen), `prototyping-testing` (severity),
  `accessible-content` (copy, alt text, labels), `adaptive-interfaces` (text scaling, colour
  independence, density), `emil-design-eng` (motion and polish).
```

In "Report", replace `Alone: save \`project/reviews/design-<YYYY-MM-DD>-<screen>.md\`.` with `Alone: save \`project/reviews/design-<YYYY-MM-DD>-<screen>.md\` and delete older \`design-*-<screen>.md\` there.`

`slop-checker.md` frontmatter becomes:

```
---
name: slop-checker
description: Finds AI slop in the app's code and copy, by pattern and by judgment. Only when the designer asks (slop, generic, looks AI-made, check a screen), under /check, or at handover; never launched unasked.
tools: Bash, Read, Glob, Grep, Edit, Write
model: sonnet
skills:
  - no-slop
  - kill-ai-slop
---
```

Insert after the paragraph that ends "never into the app.":

```
## Scope and time
- Under `/check` you get a scope (a commit, `all`, or paths) and a budget in minutes. With a commit,
  run the gate and the judgment pass only on `git diff --name-only <commit>` in the app plus
  uncommitted work: `node .claude/scripts/slop-gate.mjs <those paths> --json`.
- First read `project/reviews/STATUS.md` and `project/IDEAS.md` if present; never report what they hold.
- `date +%s` at the start; check it before each new file. At the budget, stop and report what you
  covered and what you did not.
- Open a skill only when a finding needs it, from `.claude/skills/<name>/SKILL.md`:
  `redesign-existing-projects` (fixing a screen), `web-design-guidelines` (web UI rules),
  `emil-design-eng` (motion and polish).
```

In "4. Report", replace `Alone: save \`project/reviews/slop-<YYYY-MM-DD>-<target>.md\`.` with `Alone: save \`project/reviews/slop-<YYYY-MM-DD>-<target>.md\` and delete older \`slop-*-<target>.md\` there.`

`code-reviewer.md`: replace the `description:` line with:

```
description: Judges whether the app is clean enough to hand to a development team who did not write it. Only at handover (/check all), or when the designer asks whether the devs will be able to work with it; never launched unasked.
```

In its "Report", replace `Alone: save \`project/reviews/handoff-<YYYY-MM-DD>.md\`.` with `Alone: save \`project/reviews/handoff-<YYYY-MM-DD>.md\` and delete older \`handoff-*.md\` there.`

- [ ] **Step 4: Run the check**

Run: `bash "$TMPDIR/agents-check.sh"`
Expected: every line `ok`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add -- .claude/agents/bug-hunter.md .claude/agents/design-reviewer.md .claude/agents/slop-checker.md .claude/agents/code-reviewer.md
git commit -m "feat(reviews): reviewers stay in scope, skip done work, stop on time" -m "On the portfolio a review took 20 to 40 minutes: it read the whole app, re-ran checks that had just passed and loaded up to 21,000 tokens of skills before starting. Reviewers now read only what changed, skip steps the commit check passed on the same code, open most skills only when a finding needs one, and stop at a time budget. Their descriptions no longer invite Claude to launch them unasked."
```

---

### Task 8: Commands and rules: checks in levels

**Files:**
- Modify: `.claude/commands/check.md` (rewrite)
- Modify: `.claude/commands/commit.md`, `.claude/commands/design-screen.md`, `.claude/commands/sync.md`
- Modify: `CLAUDE.md` ("No comments in code", "Existing screens", "Quality", "Routing", "Paths")

**Interfaces:**
- Consumes: `review-due.mjs` (Task 3), `quick-check.mjs` (Task 4), `STATUS.md` format (Task 2), agents' scope and budget (Task 7).

- [ ] **Step 1: Write the failing check**

```bash
cat > "$TMPDIR/commands-check.sh" <<'SH'
fail=0
t() { if eval "$2"; then echo "  ok    $1"; else echo "  FAIL  $1"; fail=1; fi; }
t "check: scope from the marker" "grep -q 'Reviewed up to:' .claude/commands/check.md"
t "check: all for handover" "grep -q '/check all' .claude/commands/check.md"
t "check: budgets" "grep -q '8 minutes' .claude/commands/check.md"
t "check: updates STATUS" "grep -q 'docs(reviews): review up to' .claude/commands/check.md"
t "commit: 10 minute timeout" "grep -q '10-minute timeout' .claude/commands/commit.md"
t "commit: reminder" "grep -q 'review-due.mjs' .claude/commands/commit.md"
t "design-screen: no slop-checker at the end" "! grep -q 'slop-checker. agent on the new files' .claude/commands/design-screen.md && grep -q 'review-due.mjs' .claude/commands/design-screen.md"
t "sync: joined skips upstream" "grep -q 'joined' .claude/commands/sync.md"
t "CLAUDE.md: never unasked" "grep -q 'never launch' CLAUDE.md"
t "CLAUDE.md: quick check named" "grep -q 'quick-check.mjs' CLAUDE.md"
t "CLAUDE.md: no em dash" "! grep -q \"\$(printf '\\342\\200\\224')\" CLAUDE.md .claude/commands/*.md"
exit $fail
SH
bash "$TMPDIR/commands-check.sh"
```

- [ ] **Step 2: Run it and see it fail**

Expected: most lines `FAIL`.

- [ ] **Step 3: Implement**

Replace `.claude/commands/check.md` entirely with:

````
---
description: Review what changed since the last review (bugs, slop, design) and save one report. /check all reviews the whole app, as before handover.
argument-hint: "[all, or paths inside the app relative to it; defaults to what changed since the last review]"
---
# /check

Runs only when the designer asks, says yes to a review reminder, or before handover. Read
`.claude/workspace.json` for the app folder and `project/reviews/STATUS.md` for the marker.

## Steps

1. **Scope.** No argument: the commit after `Reviewed up to:` in `STATUS.md`. Nothing changed since
   (`git -C <app> diff --quiet <marker>` and `git -C <app> rev-list --count <marker>..HEAD` is 0):
   say so in one line and stop. `all`, and always before handover: the whole app. Paths: those.
2. **Reviewers.** Always `bug-hunter` and `slop-checker`. `design-reviewer` when a `.tsx`, `.jsx`,
   `.css`, `.scss` or token file is in scope. `code-reviewer` only for `/check all`, or when the
   designer asked whether the devs will be able to work with it.
3. **Launch them at once**, one Agent call each, in one message. Tell each: it runs under `/check`
   and returns findings without saving; the scope (the marker commit, `all`, or the paths); its
   budget, 8 minutes, or none for `/check all`. For `/check all`, pass `model: opus` to
   `slop-checker` and `code-reviewer`. Note the time (`date +%s`).
4. **Wait for all.** Do not summarise partial results.
5. **Merge** into one report. The same `file:line` from two agents is one row. Order: broken, blocks
   handoff, slop blocks, should fix, slop warnings, nice to have. Drop anything already under
   `## Open` or `## Left on purpose` in `STATUS.md`.
6. **Verdict**, one line: `READY` if nothing is broken, nothing blocks handoff and the gate has no
   blocks. Otherwise `NOT READY`, and the three things that would change that.
7. **Status.** Save the report as `project/reviews/check-<YYYY-MM-DD>.md` in this repo, never in the
   app, and delete older `check-*.md` there (git keeps them). In `STATUS.md`: set
   `Last review: <YYYY-MM-DD>, <verdict>, <minutes> min, report: check-<YYYY-MM-DD>.md` and
   `Reviewed up to: <app HEAD, short>`; delete `## Open` lines this review found fixed; add each new
   broken, blocks-handoff, slop-block and should-fix finding as one line,
   `<file:line>  <what> (<agent>, <YYYY-MM-DD>)`. Never reword a line. Then commit `project/reviews/`
   per `/commit`, as `docs(reviews): review up to <short commit>`.

## Output

In the chat: the verdict, the minutes it took, and at most the top five findings in plain language.
The file has the rest.
````

`commit.md`:
- In "Rules", replace the sentence beginning "The app's commit hook runs the slop gate on exactly what is staged" through "commit again." with: `The app's commit hook runs the slop gate on exactly what is staged, then the quick checks (typecheck, lint, tests, build; \`.claude/scripts/quick-check.mjs\`), and refuses the commit if either fails. When it refuses: fix what it names, \`git add\` the fixed files again, and commit again.`
- Step 5 becomes: `5. **Commit**, with a 10-minute timeout on the Bash call: the app's commit check builds the app. \`main\` is fine. Then \`node .claude/scripts/team-sync.mjs --share\`: it pulls what others pushed, settles overlaps, and pushes both repos (without a GitHub home it only says so). Relay what arrived in one line; an overlap: follow "Working together" in \`CLAUDE.md\`. Then \`node .claude/scripts/review-due.mjs\`: a line printed, ask it as one yes or no; a no: \`node .claude/scripts/review-due.mjs --decline\`; a yes: \`/check\`.`

`design-screen.md`:
- Step 9 becomes: `9. **Slop gate** at the end: \`node .claude/scripts/slop-gate.mjs <the screen's files, relative to the app>\`; fix every block in place. \`slop-checker\` runs only when the designer asks.`
- In "Output", after `then \`node .claude/scripts/team-sync.mjs --release <Screen>\``, add: `, then \`node .claude/scripts/review-due.mjs\` as in \`/commit\` step 5.`

`sync.md`, step 2 gets a first sentence: `Joined project (\`"joined": true\` in \`.claude/workspace.json\`): skip this step; skill updates come from the kit.`

`CLAUDE.md`:
- "No comments in code" last bullet becomes: ``- The why goes in the commit body or this repo. The gate enforces it (`dk-05`, `dk-07`); no off switch, except in a joined project by the designer's recorded decision.``
- "Existing screens" becomes: ``- Audit with `redesign-existing-projects`, patch in place; the save gate checks each change. Never rewrite a working screen to satisfy an audit.``
- Replace the whole "Quality" section with:

```
## Quality
- Levels: the slop gate on every save; quick checks on every app commit
  (`.claude/scripts/quick-check.mjs`: typecheck, lint, tests, build); deep reviews only through
  `/check`, when the designer asks or says yes to the reminder; `/check all` once before handover,
  never skipped.
- Never launch `bug-hunter`, `slop-checker`, `design-reviewer` or `code-reviewer` unasked. After a
  large piece of work: `node .claude/scripts/review-due.mjs`; relay its line as one yes or no; a no:
  `--decline`.
- `project/reviews/STATUS.md`: last review, where it stopped, open problems, things left on purpose.
  Lines are added or deleted, never reworded. Old reports are deleted when a new one of the same
  kind is saved; git keeps them.
- Handover bar (`code-reviewer`): a README a stranger can run from, tokens not hex, no dead code, no
  comments, no `any`, a commit history that reads as a story.
- WCAG AA is the floor; keyboard, screen reader and reduced motion from the start. Tokens over raw
  values: a hex or magic number in a component is a defect.
- Agents run alone save their own report to `project/reviews/`; under `/check` they return findings
  and `/check` saves one.
```

- "Routing": ``- New screen: `frontend-design` + `no-slop`, then `slop-checker`. Existing screen: see above.`` becomes ``- New screen: `frontend-design` + `no-slop`; the save gate checks as you go. Existing screen: see above.``
- "Paths": add ``- `.claude/scripts/quick-check.mjs` (commit-time checks; `--time` to choose them), `review-due.mjs` (the reminder), `status.mjs`; `.claude/state/` is local to this Mac.``

- [ ] **Step 4: Run the check**

Run: `bash "$TMPDIR/commands-check.sh"`
Expected: every line `ok`.

- [ ] **Step 5: Commit**

```bash
git add -- .claude/commands/check.md .claude/commands/commit.md .claude/commands/design-screen.md .claude/commands/sync.md CLAUDE.md
git commit -m "feat(reviews): checks in levels; deep reviews only when asked" -m "Deep reviews ran on small, uncommitted changes and cost the owner most of a day's tokens. Now the gate runs on save, quick checks on commit, and /check reviews only what changed since the last review, when the designer asks or says yes to the reminder. /check all stays mandatory before handover."
```

---

### Task 9: Setup for joined projects, and for new ones

**Files:**
- Modify: `.claude/commands/setup.md` (top note, step 7, step 8, `### Gate` hook lines, new `## Joined project` before `## Build`)
- Modify: `CLAUDE.md` (new "Joined projects" section after "Kit or project")
- Modify: `dev/NOTES.md` ("Decisions and why" entry, "How to test", "What is next" item 0 removed)

- [ ] **Step 1: Write the failing check**

```bash
cat > "$TMPDIR/setup-check.sh" <<'SH'
fail=0
t() { if eval "$2"; then echo "  ok    $1"; else echo "  FAIL  $1"; fail=1; fi; }
t "setup routes joined projects" "grep -q '^## Joined project' .claude/commands/setup.md && grep -q '\"joined\": true' .claude/commands/setup.md"
t "setup: commit hook runs quick checks" "grep -q 'quick-check.mjs\"' .claude/commands/setup.md"
t "setup: STATUS written" "grep -q 'Reviewed up to:' .claude/commands/setup.md"
t "setup: joined hook uses --new-only" "grep -q -- '--staged --new-only' .claude/commands/setup.md"
t "setup: Prettier never offered" "grep -q 'Never Prettier' .claude/commands/setup.md"
t "setup: keeps an existing GitHub home" "grep -q 'already has a GitHub home' .claude/commands/setup.md"
t "CLAUDE.md: joined precedence" "grep -q '^## Joined projects' CLAUDE.md && grep -q 'then the project' CLAUDE.md"
t "notes: decision recorded" "grep -q 'Existing projects and lighter checks' dev/NOTES.md"
t "CLAUDE.md: inputs go to the brief folder" "grep -q 'move it into' CLAUDE.md"
exit $fail
SH
bash "$TMPDIR/setup-check.sh"
```

- [ ] **Step 2: Run it and see it fail**

Expected: every line `FAIL`.

- [ ] **Step 3: Implement**

`setup.md`, after the paragraph about `./bin/new-project` existing, add:

```
`.claude/workspace.json` has `"joined": true`: the project's code already existed. Skip steps 0 to
10 and follow `## Joined project` below.
```

`setup.md` `### Gate`: change "append these four lines" to "append these five lines" and add as the fifth line inside the code block:

```
  node "$d/.claude/scripts/quick-check.mjs"
```

`setup.md` step 7, after "All three green, report each: ...", add:

```
Then `node .claude/scripts/quick-check.mjs --time`. Write the steps that passed in 60 seconds or
less, each `{ "name", "run" }`, as `quickCheck` in `.claude/workspace.json`; a slower step gets a
`DECISIONS.md` line (it runs in reviews instead).
```

`setup.md` step 9, add after its first line: `This folder already has a GitHub home (\`git remote get-url origin\` succeeds, as when the project started in an empty repository): create only the app's repository, and keep the folder's.`

`setup.md` step 8, add at the end:

````
After the app commit, write `project/reviews/STATUS.md` exactly so, and include it in the docs commit:
```
# Status

Last review: none yet
Reviewed up to: <app HEAD, short>

## Open

## Left on purpose
```
````

`setup.md`, insert before `## Build`:

````
## Joined project
For `"joined": true`: the code already existed and stays as it is. The app is this folder; there is
one repository. Never move, rename or reformat its files. Skip the upstream skill check.

1. **Read first.** `package.json`, `README.md`, the project's own `CLAUDE.md` and `AGENTS.md`, the
   folder tree (three levels, no `node_modules`), the colour, type and spacing values in its styles,
   and `git log --format='%ad %s' --date=short`. `new-project` named any files it kept instead of the
   kit's; else compare `.claude/agents` with the kit's (`kit` in `.claude/workspace.json`).
2. **Write.** `project/PROJECT.md` as in step 6, with `## Repos`: one repository, the project's own.
   `project/TASTE.md` from what the code already does: each `## Do` rule cites the file it comes
   from; `## Never` from what the code avoids. `project/DECISIONS.md`: keep an existing one; else
   start it from the history, one line per real choice with its reversal cost. Then today's line:
   the design kit joined the existing code, nothing moved (reversal: low, remove the kit's files in
   `.claude/` and the import line in `CLAUDE.md`). The project's `CLAUDE.md` has no code map: add
   `## Code map`, one line per top folder.
3. **Ask** only what step 1 could not answer, in one `AskUserQuestion`, as in step 3.
4. **Clashes, in one message**, then one `AskUserQuestion` (multi-select: the rules to keep on;
   the recommendations preselected as the first option's wording). Skip anything `DECISIONS.md`
   already settles.
   - `node .claude/scripts/slop-gate.mjs --json --no-fail`; count hits per id. For each id with hits:
     what it means in plain words, the count, and the advice: "switch off here" when the hits look
     deliberate (across the site's look, or a `DECISIONS.md` line), else "keep". Off: add the id to
     `skip` in `.claude/slop-policy.json`. Kept with old hits: one `## Open` line in step 8.
   - No `src/components/ui`: add `dk-08` to `skip`. No `src/api`: add `dk-09`. Say so in one line;
     no question. The kit's folder layout, data door and two repositories do not apply; say so once.
   - The kit's blocks in the settings file (`git add -A`, `--no-verify`, force-push): recommend
     keeping them, "they stop a slip from erasing shared work". Declined, now or in `DECISIONS.md`:
     remove those entries from `permissions.deny`.
   - Branches other than `main` on the remote (`git branch -r`), or a pull request template: the kit
     follows the project's branches; say so once.
   Record each answer as a dated line in `DECISIONS.md`.
5. **Kept files.** An agent or skill the project adapted (step 1): if it holds project notes (a
   browser, a test setup, a page that renders twice), propose moving those notes into the project's
   `CLAUDE.md` and replacing the file with the kit's; do it on a yes.
6. **Commit check.** `node .claude/scripts/quick-check.mjs --time <the project's own check scripts,
   such as check:taste; never one that needs the network>`. Steps that passed in 60 seconds or less
   become `quickCheck` in `.claude/workspace.json`. Slower: a `DECISIONS.md` line (runs in reviews).
   Failing on existing code: left out, one `## Open` line ("lint fails on existing code"). Then the
   hook: `.husky/` exists, append to `.husky/pre-commit`; else write `.git/hooks/pre-commit` starting
   `#!/bin/sh` and `chmod +x` it. The lines:
   ```
   d=$(git config --get designkit.docs) || exit 0
   [ -f "$d/.claude/scripts/slop-gate.mjs" ] || { echo "slop gate: not found at $d" >&2; exit 1; }
   node "$d/.claude/scripts/slop-gate.mjs" --staged --new-only || exit 1
   node "$d/.claude/scripts/quick-check.mjs"
   ```
   One offer, one yes or no for both: knip (as in `bug-hunter` "No knip") and, on web without it,
   `eslint-plugin-jsx-a11y` (as in `### Lint`). Never Prettier: it would rewrite every file.
7. **Status.** `project/reviews/STATUS.md` as in step 8, marker at the current `HEAD`, with the
   `## Open` lines from steps 4 and 6.
8. **Commit and share**, per `/commit`, by name: `docs: write down <Name> for the design kit`
   (`project/`, the project's `CLAUDE.md`, `.claude/slop-policy.json`, `.claude/settings.json`,
   `.claude/workspace.json`); if the hook went into `.husky/`, `chore: run the design kit's checks
   before each commit`, with the why. Public (`"visibility": "public"`): commit only `project/` and
   the project's own files. Then `node .claude/scripts/team-sync.mjs --share`.
9. **Next**, in a few lines: what the kit now knows, what it switched off, that reviews run when
   asked and the reminder suggests them. A first whole-site review only if the designer wants a
   starting point.
````

`CLAUDE.md`, insert after the "Kit or project" section:

```
## Joined projects
- `.claude/workspace.json` `"joined": true`: the kit joined code that already existed. One repo;
  `app` is `.`.
- Precedence: dated lines in `project/DECISIONS.md`, then the project's own `CLAUDE.md`, then this
  file, then any skill.
- "Two repos", "App structure", "Data" and the main-only rule in "Working together" apply only where
  the project already has that shape. Build new work to fit the project's code map.
- Never move, rename or reformat existing code to match the kit. A kit rule or skill that clashes
  mid-work: stop, say it in one line, ask yes or no, record the answer in `DECISIONS.md`, never ask
  again.
```

`CLAUDE.md`, "Before designing", add a bullet:

```
- The designer points to a file or folder (a download, the Desktop, a path) as input: move it into
  `project/brief/` and say in one line where it went; read it from there. Read anything new in
  `project/brief/` before designing.
```

`dev/NOTES.md`:
- Add to "Decisions and why", after "Working together":

```
**Existing projects and lighter checks** (2026-10-05). From the owner's portfolio trial: the kit
refused a working site, a session copied parts of it by hand, and the deep reviews ran on every
small change at 20 to 40 minutes each until a day's tokens were gone. Spec:
`dev/specs/2026-10-05-existing-projects-and-lighter-checks.md`. Now `bin/new-project` hands a folder
with code to `bin/join-existing.mjs` (one repository, `"joined": true`, nothing moved, the project's
files kept, a public repository keeps the kit out of its history), and `/setup` has a joined branch
that reads before asking and settles clashes in one message. Checks run in levels: the gate on
save, `quick-check.mjs` on commit, deep reviews only through `/check` when asked or on a yes to
`review-due.mjs`, `/check all` before handover. `project/reviews/STATUS.md` replaces a log: lines
added or deleted, never reworded, merged by meaning when two people change it.
```

- "How to test": add `node dev/tests/gate/staged.mjs` (`7 passed`) and `node dev/tests/checks/run.mjs` (`28 passed`), and update the install and team counts to what Tasks 5 and 6 printed.
- "What is next": delete item 0.

- [ ] **Step 4: Run every suite**

```bash
bash "$TMPDIR/setup-check.sh" && bash "$TMPDIR/commands-check.sh" && bash "$TMPDIR/agents-check.sh"
node dev/tests/gate/run.mjs
node dev/tests/gate/staged.mjs
node dev/tests/checks/run.mjs
bash dev/tests/upstream/run.sh
bash dev/tests/install/run.sh
bash dev/tests/team/run.sh
node .claude/scripts/slop-gate.mjs --self-test
grep -rn "$(printf '\342\200\224')" CLAUDE.md README.md .claude/commands .claude/agents .claude/scripts dev/NOTES.md bin || echo "no em dashes"
```

Expected: every suite green with the counts above; `58/58` gate probes; upstream `14/14`; `no em dashes`.

- [ ] **Step 5: Commit**

```bash
git add -- .claude/commands/setup.md CLAUDE.md dev/NOTES.md
git commit -m "feat(join): set up a joined project by reading it first" -m "A joined project already has a look, a history and its own ways of working. Setup now writes the taste and decisions from the code and the history, asks only what it cannot find, and puts every clash with the kit's rules in one message where the project's way wins on the owner's word. New projects also get the commit-time checks and a status file from the start."
```

---

### Task 10: Live trial on the portfolio

**Files:** none in the kit unless the trial finds a defect (then fix it in the task that owns the file, re-run that task's tests, commit as `fix(<scope>): ...`).

- [ ] **Step 1:** Fresh clone into the scratchpad: `gh repo clone nlanhson/portfolio <scratchpad>/folio-trial`. Never touch the owner's own copy.
- [ ] **Step 2:** `~/design-kit/bin/new-project` from inside it. Expect: "now has the design kit", the kept files listed (its two adapted agents, its skills), one new commit, `git status` clean.
- [ ] **Step 3:** Headless setup, timed, in auto mode, from inside the clone: `time claude -p "/setup" --permission-mode auto --output-format json </dev/null > setup.json`. Read `.result` and `permission_denials`. Expect: no question about the no-comments rule, the spaced capitals or the safety blocks (its `DECISIONS.md` settles them); `quickCheck` holds `lint`, `check:taste`, `build`, and the Playwright suite only if under 60 seconds; `STATUS.md` exists with the marker at `HEAD`.
- [ ] **Step 4:** Confirm the import line is harmless without the kit: in a second clone without `.claude/design-kit.md`, `claude -p "Say OK" </dev/null` answers without an error.
- [ ] **Step 5:** A one-file visual change (a spacing value in `features/home/home.css`), committed through `claude -p "/commit"`, then `time claude -p "/check" --permission-mode auto --output-format json </dev/null`. Expect: 10 minutes or less, nothing reported that `project/IDEAS.md` holds, `STATUS.md` marker moved, one `check-*.md` report.
- [ ] **Step 6:** Write the measured times and anything found into `dev/NOTES.md` under the new entry, and commit as `docs(dev): record the portfolio trial of joining and lighter checks`.
