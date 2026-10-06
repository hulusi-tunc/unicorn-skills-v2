#!/usr/bin/env node
// tidy: read-only housekeeping report for a git repo and its worktrees.
// Changes nothing. Prints what has landed, what is abandoned, what holds unsaved work,
// and the command it would suggest for each. Usage: node tidy.mjs <repo> [--json]
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const repo = resolve(process.argv[2] || '.')
const asJson = process.argv.includes('--json')
const DAY = 86400

const git = (args, cwd = repo) => {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 }).trim() } catch { return null }
}
const lines = (s) => (s ? s.split('\n').filter(Boolean) : [])
const now = Math.floor(Date.now() / 1000)
const n = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`
const age = (ts) => { const d = Math.floor((now - ts) / DAY); return d === 0 ? 'today' : d === 1 ? '1 day' : `${d} days` }

// base branch: --base wins, then the server's default (asked read-only), then the local origin/HEAD
const flag = process.argv.indexOf('--base')
const head = git(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'])
const localDefault = head ? head.replace('refs/remotes/', '') : null
let serverDefault = null
try {
  const out = execFileSync('git', ['ls-remote', '--symref', 'origin', 'HEAD'], { cwd: repo, encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] })
  const m = out.match(/^ref: refs\/heads\/(\S+)\s+HEAD/m)
  if (m) serverDefault = `origin/${m[1]}`
} catch {}
let base = flag > 0 ? process.argv[flag + 1] : serverDefault || localDefault
for (const c of ['origin/develop', 'origin/main', 'origin/master']) if (!base && git(['rev-parse', '--verify', '--quiet', c])) base = c
if (!base || !git(['rev-parse', '--verify', '--quiet', base])) { console.error(`base branch ${base || ''} not found locally; git fetch first`); process.exit(1) }

const landed = (ref) => git(['merge-base', '--is-ancestor', ref, base]) !== null
// commits not in base by patch content: catches rebase and cherry-pick merges
const unique = (ref) => lines(git(['cherry', base, ref])).filter((l) => l.startsWith('+')).length
const related = (ref) => git(['merge-base', ref, base]) !== null
const ahead = (ref) => Number(git(['rev-list', '--count', `${base}..${ref}`]) || 0)
const behind = (ref) => Number(git(['rev-list', '--count', `${ref}..${base}`]) || 0)
const lastTs = (ref) => Number(git(['log', '-1', '--format=%ct', ref]) || 0)

const report = { repo, base, worktrees: [], local: [], remote: [], stashes: [], oldDefaults: [], tracked: [], big: [], authors: [], actions: [] }
const act = (kind, what, cmd) => report.actions.push({ kind, what, cmd })
if (serverDefault && localDefault && serverDefault !== localDefault) act('safe', `the server's default branch is ${serverDefault}, but this copy still points at ${localDefault} (renamed and never refreshed)`, 'git remote set-head origin -a')
const fetchedAgo = Number(git(['log', '-1', '--format=%ct', base]) || 0)
report.serverDefault = serverDefault; report.localDefault = localDefault

// worktrees
const wtRaw = git(['worktree', 'list', '--porcelain']) || ''
const held = new Set()
for (const block of wtRaw.split('\n\n').filter(Boolean)) {
  const get = (k) => (block.split('\n').find((l) => l.startsWith(k + ' ')) || '').slice(k.length + 1)
  const path = get('worktree'); const branch = get('branch').replace('refs/heads/', '') || null
  if (branch) held.add(branch)
  const w = { path, branch, detached: block.includes('\ndetached'), missing: !existsSync(path) }
  if (!w.missing) {
    const st = lines(git(['status', '--porcelain'], path))
    w.changed = st.filter((l) => !l.startsWith('??')).length
    w.untracked = st.filter((l) => l.startsWith('??')).length
    w.last = lastTs('HEAD') && Number(git(['log', '-1', '--format=%ct'], path) || 0)
    w.behind = Number(git(['rev-list', '--count', `HEAD..${base}`], path) || 0)
  }
  report.worktrees.push(w)
}
report.worktrees.forEach((w, i) => {
  const main = i === 0
  if (w.missing) act('safe', `worktree entry for a folder that no longer exists: ${w.path}`, 'git worktree prune')
  else if (w.detached && !main) act('ask', `worktree with no branch: ${w.path}`, `git -C "${w.path}" status  # save work to a branch, then git worktree remove`)
  else if ((w.changed || w.untracked) && now - w.last > DAY) act('save', `unsaved work in ${main ? 'the main checkout' : w.path} (${w.changed} changed, ${w.untracked} untracked, last commit ${age(w.last)} ago)`, `git -C "${w.path}" add <files you read> && git commit -m "wip: ..." && git push -u origin HEAD:wip/<owner>/<topic>`)
  if (main && w.branch && `origin/${w.branch}` !== base && now - w.last > 7 * DAY) act('ask', `the main checkout sits on ${w.branch}, last commit ${age(w.last)} ago, ${w.behind} commits behind ${base}`, `git -C "${w.path}" switch --detach ${base}  # after its work is saved`)
  if (!main && !w.missing && w.branch && landed(w.branch) && !w.changed && !w.untracked) act('safe', `worktree on ${w.branch} has landed in ${base}`, `git worktree remove "${w.path}"`)
})

// local branches
for (const b of lines(git(['for-each-ref', '--format=%(refname:short)|%(upstream:short)|%(upstream:track)', 'refs/heads']))) {
  const [name, upstream, track] = b.split('|')
  const r = { name, upstream: upstream || null, gone: track === '[gone]', held: held.has(name), last: lastTs(name), landed: landed(name), unique: 0, related: related(name) }
  if (!r.landed) r.unique = unique(name)
  report.local.push(r)
  if (r.held) continue
  if (!r.related) act('ask', `local ${name} shares no history with ${base}`, `git log --oneline -5 ${name}`)
  else if (r.landed || r.unique === 0) act('safe', `local ${name} has landed${r.landed ? '' : ' (same changes, rebased)'}`, `git branch -d ${name}`)
  else if (now - r.last > 14 * DAY) act('ask', `local ${name}: ${n(r.unique, 'commit')} not in ${base}, last ${age(r.last)} ago${r.gone ? ', its remote is gone' : ''}`, `git log --oneline ${base}..${name}`)
}

// remote branches
for (const ref of lines(git(['for-each-ref', '--format=%(refname:short)', 'refs/remotes']))) {
  if (ref.endsWith('/HEAD') || ref === base || !ref.includes('/') || (['origin/main', 'origin/master'].includes(ref) && ref !== base)) continue
  const r = { name: ref, last: lastTs(ref), landed: landed(ref), related: related(ref), unique: 0, ahead: 0 }
  if (!r.landed && r.related) { r.unique = unique(ref); r.ahead = ahead(ref) }
  report.remote.push(r)
  const short = ref.replace(/^origin\//, '')
  if (!r.related) act('ask', `${ref} shares no history with ${base} (a second, unrelated history)`, `git log --oneline -3 ${ref}`)
  else if (r.landed || r.unique === 0) act('safe', `${ref} has landed in ${base}`, `git push origin --delete ${short}`)
  else if (/^(backup|wip|salvage|preview|session)\//.test(short) || /\/wip$/.test(short)) act('ask', `${ref} is a ${short.split('/')[0]} branch, ${n(r.unique, 'commit')} not in ${base}, last ${age(r.last)} ago`, `git log --oneline ${base}..${ref}`)
  else if (now - r.last > 14 * DAY) act('ask', `${ref}: ${n(r.unique, 'commit')} not in ${base}, untouched ${age(r.last)}`, `git log --oneline ${base}..${ref}`)
}

// an old default branch left behind after a rename
for (const c of ['origin/main', 'origin/master']) {
  if (c === base || !git(['rev-parse', '--verify', '--quiet', c])) continue
  const o = { name: c, behind: behind(c), uniqueAhead: unique(c) }
  report.oldDefaults.push(o)
  act(o.uniqueAhead ? 'ask' : 'safe', `${c} is ${n(o.behind, 'commit')} behind ${base}${o.uniqueAhead ? `, with ${n(o.uniqueAhead, 'commit')} of its own` : ' and has nothing of its own'}`, o.uniqueAhead ? `git log --oneline ${base}..${c}` : `git push origin --delete ${c.replace('origin/', '')}  # after the default branch is ${base}`)
}

// stashes are shared by every worktree of this repo
for (const s of lines(git(['stash', 'list', '--format=%gd|%ct|%gs']))) {
  const [id, ts, msg] = s.split('|')
  report.stashes.push({ id, ts: Number(ts), msg })
  act('save', `stash ${id} from ${age(Number(ts))} ago: ${msg}`, `git stash show -p ${id}  # keep: git stash branch wip/<owner>/<topic> ${id}`)
}

// files in the base that should never be committed
const junk = /(^|\/)(\.env(\.(?!example)[^/]+)?|\.claude\/settings\.local\.json|[^/]+\.jsonl|\.DS_Store|node_modules\/.*|\.cursor\/.*)$/
report.tracked = lines(git(['ls-tree', '-r', '--name-only', base])).filter((f) => junk.test(f))
if (report.tracked.length) act('ask', `${report.tracked.length} files in ${base} that should not be in git (env, session, OS files)`, `git rm --cached <file>  # then add it to .gitignore`)

// large files anywhere in history
const objs = git(['rev-list', '--objects', '--all']) || ''
if (objs) {
  const batch = execFileSync('git', ['cat-file', '--batch-check=%(objecttype) %(objectname) %(objectsize) %(rest)'], { cwd: repo, input: objs, encoding: 'utf8', maxBuffer: 1 << 28 })
  const big = lines(batch).map((l) => l.split(' ')).filter((p) => p[0] === 'blob' && Number(p[2]) > 5e6)
  const byPath = new Map()
  for (const p of big) { const path = p.slice(3).join(' '); byPath.set(path, Math.max(byPath.get(path) || 0, Number(p[2]))) }
  report.big = [...byPath].map(([path, size]) => ({ path, mb: +(size / 1e6).toFixed(1), inBase: git(['cat-file', '-e', `${base}:${path}`]) !== null })).sort((a, b) => b.mb - a.mb)
  const total = report.big.reduce((s, b) => s + b.mb, 0)
  if (report.big.length) act('ask', `${report.big.length} files over 5 MB in history, ${total.toFixed(0)} MB, ${report.big.filter((b) => b.inBase).length} still in ${base}`, 'move masters to LFS or Drive; cleaning history rewrites it, the repo owner decides')
}

// author identities
report.authors = lines(git(['shortlog', '-sne', '--all'])).map((l) => l.trim())
const bad = report.authors.filter((a) => !/<[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>$/.test(a))
if (bad.length) act('ask', `${bad.length} commit identities with a broken email: ${bad.map((a) => a.replace(/^\d+\s+/, '')).join(', ')}`, 'git config user.email in that person\'s repo; a .mailmap file fixes the history view')

if (asJson) { console.log(JSON.stringify(report, null, 2)); process.exit(0) }

const order = { save: 0, ask: 1, safe: 2 }
const title = { save: 'Unsaved work, save first', ask: 'Needs a person to decide', safe: 'Safe to clean, nothing would be lost' }
console.log(`tidy · ${repo}\nbase ${base} · ${report.worktrees.length} worktrees · ${report.local.length} local branches · ${report.remote.length} remote branches · ${report.stashes.length} stashes\nread-only: nothing was changed\n`)
for (const k of ['save', 'ask', 'safe']) {
  const list = report.actions.filter((a) => a.kind === k)
  if (!list.length) continue
  console.log(`${title[k]} (${list.length})`)
  for (const a of list) console.log(`  - ${a.what}\n      ${a.cmd}`)
  console.log('')
}
