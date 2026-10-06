#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const tmp = mkdtempSync(join(tmpdir(), 'tidy-tests-'))
const remote = join(tmp, 'remote.git')
const repo = join(tmp, 'repo')
const g = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' })
spawnSync('git', ['init', '-q', '--bare', '-b', 'main', remote])
mkdirSync(repo)
g('init', '-q', '-b', 'main')
g('config', 'user.name', 'T')
g('config', 'user.email', 't@example.com')
g('remote', 'add', 'origin', remote)
const commit = (file, msg) => {
  writeFileSync(join(repo, file), `${msg}\n`)
  g('add', file)
  g('commit', '-q', '--no-verify', '-m', msg)
}
commit('a.txt', 'chore: start')
g('push', '-q', '-u', 'origin', 'main')
g('switch', '-qc', 'landed')
commit('b.txt', 'feat: landed work')
g('switch', '-q', 'main')
g('merge', '-q', '--no-ff', '-m', 'merge landed', 'landed')
g('push', '-q', 'origin', 'main')
g('switch', '-qc', 'open-work')
commit('c.txt', 'feat: open work')
g('push', '-q', 'origin', 'open-work')
g('switch', '-q', 'main')
writeFileSync(join(repo, 'a.txt'), 'changed\n')
g('stash', 'push', '-q', '-m', 'old wip')
g('fetch', '-q', 'origin')
g('remote', 'set-head', 'origin', 'main')

const r = spawnSync(process.execPath, [join(KIT, '.designkit/scripts/tidy.mjs'), repo, '--json', '--base', 'origin/main'], { encoding: 'utf8' })
let report = null
try {
  report = JSON.parse(r.stdout)
} catch {}
const has = (kind, text) => report?.actions.some((a) => a.kind === kind && a.what.includes(text))
let passed = 0
const failed = []
const check = (name, ok) => (ok ? passed++ : failed.push(name))
check('report is readable JSON', !!report)
check('a landed local branch is safe to delete', has('safe', 'local landed has landed'))
check('an open branch is not marked safe', !report?.actions.some((a) => a.kind === 'safe' && a.what.includes('open-work')))
check('a stash is flagged as unsaved work', has('save', 'stash'))
check('nothing in the repo changed', g('stash', 'list').stdout.includes('old wip') && g('branch', '--list', 'landed').stdout.includes('landed'))
rmSync(tmp, { recursive: true, force: true })

const app = mkdtempSync(join(tmpdir(), 'testids-tests-'))
mkdirSync(join(app, 'src/features'), { recursive: true })
writeFileSync(join(app, 'src/features/Pay.tsx'), 'export const P = () => (\n  <div>\n    <DSButton data-testid="checkout-pay" onClick={pay}>Pay</DSButton>\n    <DSButton onClick={back}>Back</DSButton>\n  </div>\n)\n')
const t = JSON.parse(spawnSync(process.execPath, [join(KIT, '.designkit/scripts/testids.mjs'), app, '--json'], { encoding: 'utf8' }).stdout)
check('testids counts 2 touched elements, 1 with an ID', t.total === 2 && t.withId === 1)
check('testids lists the ID for the QA pack', t.ids.includes('checkout-pay'))
rmSync(app, { recursive: true, force: true })

for (const f of failed) console.log(`FAIL ${f}`)
console.log(`${passed} passed, ${failed.length} failed`)
process.exit(failed.length ? 1 : 0)
