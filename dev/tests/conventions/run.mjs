#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const tmp = mkdtempSync(join(tmpdir(), 'conventions-tests-'))
const docs = join(tmp, 'docs')
const repo = join(tmp, 'repo')
const remote = join(tmp, 'remote.git')
mkdirSync(join(docs, '.designkit/scripts'), { recursive: true })
for (const f of ['commit-msg.mjs', 'pre-push.mjs']) cpSync(join(KIT, '.designkit/scripts', f), join(docs, '.designkit/scripts', f))
const workspace = (w) => writeFileSync(join(docs, '.designkit/workspace.json'), JSON.stringify({ name: 'T', app: '../repo', ...w }))
workspace({ jira: 'DS', protected: ['main'] })

const run = (cmd, args, env = {}) => spawnSync(cmd, args, { cwd: repo, encoding: 'utf8', env: { ...process.env, ...env } })
spawnSync('git', ['init', '-q', '--bare', remote])
mkdirSync(repo)
run('git', ['init', '-q', '-b', 'main'])
run('git', ['config', 'user.name', 'Test Designer'])
run('git', ['config', 'user.email', 'designer@example.com'])
run('git', ['remote', 'add', 'origin', remote])
mkdirSync(join(repo, '.hooks'))
for (const [hook, script] of [['commit-msg', 'commit-msg.mjs'], ['pre-push', 'pre-push.mjs']]) {
  writeFileSync(join(repo, '.hooks', hook), `#!/bin/sh\nexec node "${join(docs, '.designkit/scripts', script)}" "$@"\n`)
  chmodSync(join(repo, '.hooks', hook), 0o755)
}
writeFileSync(join(repo, 'a.txt'), 'a\n')
run('git', ['add', 'a.txt'])
run('git', ['commit', '-q', '--no-verify', '-m', 'chore: start'])
run('git', ['push', '-q', 'origin', 'main'])
run('git', ['config', 'core.hooksPath', '.hooks'])
run('git', ['switch', '-qc', 'work'])

let passed = 0
const failed = []
const check = (name, ok) => (ok ? passed++ : failed.push(name))
let n = 0
const commit = (msg) => {
  writeFileSync(join(repo, `f${++n}.txt`), `${n}\n`)
  run('git', ['add', `f${n}.txt`])
  const r = run('git', ['commit', '-q', '-m', msg])
  if (r.status !== 0) run('git', ['reset', '-q'])
  return r.status
}

check('Jira: a commit without the ticket line is refused', commit('feat(home): hero copy') !== 0)
check('Jira: a commit with the ticket line is kept', commit('feat(home): hero copy\n\nJira: DS-12') === 0)
check('Jira: the AI signature is still removed', !run('git', ['log', '-1', '--format=%B']).stdout.includes('Claude') && commit('fix(home): spacing\n\nJira: DS-12\n\nCo-Authored-By: Claude <noreply@anthropic.com>') === 0 && !run('git', ['log', '-1', '--format=%B']).stdout.includes('Claude'))
workspace({ protected: ['main'] })
check('no Jira key: any commit goes through', commit('feat(home): footer') === 0)

const push = (ref, env = {}) => run('git', ['push', '-q', 'origin', ref], env).status
check('protected: a direct push to main is refused', push('HEAD:main') !== 0)
check('a push to a work branch goes through', push('work', { DESIGNKIT_TEST_VISIBILITY: 'private' }) === 0)
check('a public repository is refused', push('HEAD:refs/heads/help-x', { DESIGNKIT_TEST_VISIBILITY: 'public' }) !== 0)
workspace({ protected: ['main'], public: true })
check('a public repository recorded as public goes through', push('HEAD:refs/heads/help-y', { DESIGNKIT_TEST_VISIBILITY: 'public' }) === 0)
run('git', ['config', 'user.email', '@broken'])
commit('feat(x): x')
run('git', ['config', 'user.email', 'designer@example.com'])
check('a broken author email is refused', push('HEAD:refs/heads/help-z', { DESIGNKIT_TEST_VISIBILITY: 'private' }) !== 0)

rmSync(tmp, { recursive: true, force: true })
for (const f of failed) console.log(`FAIL ${f}`)
console.log(`${passed} passed, ${failed.length} failed`)
process.exit(failed.length ? 1 : 0)
