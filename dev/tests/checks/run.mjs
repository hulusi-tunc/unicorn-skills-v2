#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const KIT = resolve(HERE, '../../..')
const { parseStatus, renderStatus, mergeStatus } = await import(join(KIT, '.designkit/scripts/status.mjs'))
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

/* Reminder */
console.log('\nReview reminder')
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' }
function folder(name, app) {
  const docs = join(tmp, name)
  mkdirSync(join(docs, '.designkit/scripts'), { recursive: true })
  mkdirSync(join(docs, 'project/reviews'), { recursive: true })
  for (const f of ['review-due.mjs', 'status.mjs', 'quick-check.mjs', 'kit-paths.mjs']) if (existsSync(join(KIT, '.designkit/scripts', f))) cpSync(join(KIT, '.designkit/scripts', f), join(docs, '.designkit/scripts', f))
  writeFileSync(join(docs, '.designkit/workspace.json'), JSON.stringify({ name, app, ...(app === '.' ? { joined: true } : {}) }))
  return { docs, app: resolve(docs, app) }
}
const tools = ({ docs, app }) => {
  const git = (args, extra = {}) => (spawnSync('git', args, { cwd: app, encoding: 'utf8', env: { ...env, ...extra } }).stdout ?? '').trim()
  return {
    git,
    due: (...args) => spawnSync(process.execPath, [join(docs, '.designkit/scripts/review-due.mjs'), ...args], { cwd: docs, encoding: 'utf8' }).stdout.trim(),
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
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)
writeFileSync(join(two.docs, 'project/reviews/STATUS.md'), renderStatus({ last: `${twoDaysAgo}, READY, 1 min, report: check-${twoDaysAgo}.md`, marker: 'zzzzzzz', open: [], kept: [] }))
check('a marker lost in a sync: counts from the last review date instead', /^Review due/.test(t.due()))

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
check('in the kit itself: silent', spawnSync(process.execPath, [join(KIT, '.designkit/scripts/review-due.mjs')], { cwd: KIT, encoding: 'utf8' }).stdout.trim() === '')

/* Quick check */
console.log('\nQuick check')
const q = folder('Quick', 'Quick-app')
const qt = tools(q)
mkdirSync(q.app, { recursive: true })
qt.git(['init', '-q', '-b', 'main'])
const pkg = (extra) => writeFileSync(join(q.app, 'package.json'), JSON.stringify({ name: 'quick', private: true, ...extra }))
const quick = (...args) => spawnSync(process.execPath, [join(q.docs, '.designkit/scripts/quick-check.mjs'), ...args], { cwd: q.app, encoding: 'utf8' })
pkg({ scripts: { lint: 'node -e ""', build: 'node -e ""', test: 'echo "Error: no test specified" && exit 1' } })
writeFileSync(join(q.app, 'tsconfig.json'), '{}')
const names = () => JSON.parse(quick('--list').stdout).map((s) => s.name).join(' ')
check('no TypeScript, no typecheck; the npm test placeholder is not a test', names() === 'lint build')
pkg({ scripts: { lint: 'node -e ""', build: 'node -e ""' }, devDependencies: { typescript: '5.9.0' } })
check('TypeScript in the app: typecheck comes first', names() === 'typecheck lint build')
pkg({ scripts: { lint: 'node -e ""', build: 'node -e ""' } })
qt.git(['add', 'package.json'])
const pass = quick()
const state = JSON.parse(readFileSync(join(q.docs, '.designkit/state/last-check.json'), 'utf8'))
check('a pass is recorded with the tree it checked', pass.status === 0 && state.tree === qt.git(['write-tree']) && state.steps.map((s) => s.name).join(' ') === 'lint build')
writeFileSync(join(q.docs, '.designkit/workspace.json'), JSON.stringify({ name: 'Quick', app: 'Quick-app', quickCheck: [{ name: 'lint', run: 'node -e "process.exit(3)"' }] }))
const fail = quick()
check('a failing step stops the commit and is named', fail.status === 1 && /quick check: lint failed/.test(fail.stderr))
const timed = JSON.parse(quick('--time').stdout)
check('--time runs what it finds, not the saved list, and times each', timed.map((s) => s.name).join(' ') === 'lint build' && timed.every((s) => s.ok && Number.isInteger(s.seconds)))

const qj = folder('QuickJoined', '.')
const qjt = tools(qj)
qjt.git(['init', '-q', '-b', 'main'])
writeFileSync(join(qj.docs, '.designkit/workspace.json'), JSON.stringify({ name: 'QuickJoined', app: '.', joined: true, quickCheck: [{ name: 'lint', run: 'node -e "process.exit(3)"' }] }))
const quickHere = () => spawnSync(process.execPath, [join(qj.docs, '.designkit/scripts/quick-check.mjs')], { cwd: qj.docs, encoding: 'utf8' }).status
qjt.write('project/reviews/STATUS.md', 'x\n')
qjt.git(['add', 'project/reviews/STATUS.md'])
check("joined: a commit of only the kit's documents skips the checks", quickHere() === 0)
qjt.write('src/a.ts', 'export const a = 1\n')
qjt.git(['add', 'src/a.ts'])
check('joined: a commit with app code still runs them', quickHere() === 1)

/* Platform skills */
console.log('\nSkills for the platform')
const sp = join(tmp, 'SkillsProject')
mkdirSync(join(sp, '.designkit/scripts'), { recursive: true })
for (const f of ['skills-for.mjs', 'adapters.mjs']) cpSync(join(KIT, '.designkit/scripts', f), join(sp, '.designkit/scripts', f))
cpSync(join(KIT, '.agents/skills'), join(sp, '.agents/skills'), { recursive: true })
writeFileSync(join(sp, '.designkit/workspace.json'), JSON.stringify({ name: 'SkillsProject', app: 'SkillsProject-app', kit: KIT }))
const skillsFor = (platform) => spawnSync(process.execPath, [join(sp, '.designkit/scripts/skills-for.mjs'), platform], { cwd: sp, encoding: 'utf8' })
const has = (name) => existsSync(join(sp, '.agents/skills', name, 'SKILL.md'))
const linked = (name) => existsSync(join(sp, '.claude/skills', name, 'SKILL.md'))
const off = () => JSON.parse(readFileSync(join(sp, '.designkit/workspace.json'), 'utf8')).skillsOff
const web = skillsFor('web')
check('web: the mobile guide leaves, the web ones stay, and it is recorded', web.status === 0 && !has('vercel-react-native-skills') && has('vercel-react-best-practices') && linked('shadcn-ui') && off().join() === 'vercel-react-native-skills')
skillsFor('mobile')
check('mobile: the web guides leave, the mobile one comes back from the kit', !has('shadcn-ui') && !has('web-design-guidelines') && !linked('vercel-react-best-practices') && has('vercel-react-native-skills') && linked('vercel-react-native-skills'))
skillsFor('both')
check('both: every guide is back and nothing is left out', ['shadcn-ui', 'web-design-guidelines', 'vercel-react-best-practices', 'vercel-react-native-skills'].every(has) && off() === undefined)
check('the kit itself keeps every skill', spawnSync(process.execPath, [join(KIT, '.designkit/scripts/skills-for.mjs'), 'web'], { cwd: KIT, encoding: 'utf8' }).status === 2 && existsSync(join(KIT, '.agents/skills/vercel-react-native-skills/SKILL.md')))

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
