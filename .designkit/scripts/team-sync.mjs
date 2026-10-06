#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeStatus } from './status.mjs'

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const IS_KIT = existsSync(join(HERE, 'bin/new-project'))
const WORKSPACE = join(HERE, '.designkit/workspace.json')
const WORKING_FILE = 'project/WORKING.md'
const STATUS_FILE = 'project/reviews/STATUS.md'
const kept = (file) => (workspace.app === '.' ? `${file}.txt` : file)
const WORKING = join(HERE, WORKING_FILE)
const CONFLICTS_DIR = 'project/reviews/conflicts'
const MAX_ROUNDS = 50

const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
const today = () => new Date().toISOString().slice(0, 10)
const days = (since) => Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 86400000))
const same = (a, b) => a.toLowerCase() === b.toLowerCase()
const say = (text) => console.log(text)

const workspace = readJson(WORKSPACE, {})
const APP = workspace.app ? resolve(HERE, workspace.app) : null
const ONE = APP === HERE
const AUTO = workspace.share ?? !workspace.joined
const DOCS = { label: ONE ? 'project' : 'design folder', dir: HERE }
const REPOS = [APP && !ONE && existsSync(join(APP, '.git')) ? { label: 'app', dir: APP } : null, DOCS].filter(Boolean)

function git(args, cwd, env) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } })
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() }
}
const hasRemote = (dir) => git(['remote', 'get-url', 'origin'], dir).ok
const hasUpstream = (dir) => git(['rev-parse', '--abbrev-ref', '@{u}'], dir).ok
const dirty = (dir) => git(['status', '--porcelain', '--untracked-files=no'], dir).out !== ''
const unmerged = (dir) => git(['diff', '--name-only', '--diff-filter=U'], dir).out.split('\n').filter(Boolean)
const me = () => git(['config', 'user.name'], HERE).out
const gitDir = (dir) => resolve(dir, git(['rev-parse', '--git-dir'], dir).out)
const rebasing = (dir) => existsSync(join(gitDir(dir), 'rebase-merge')) || existsSync(join(gitDir(dir), 'rebase-apply'))
function commitOnly(dir, message, path) {
  git(['add', '--', path], dir)
  return git(['commit', '--quiet', '-m', message, '--', path], dir).ok
}

/* Claims */
const parseClaims = (text) =>
  text
    .split('\n')
    .map((l) => l.match(/^- (.+?): (.+?), since (\d{4}-\d{2}-\d{2})$/))
    .filter(Boolean)
    .map((m) => ({ topic: m[1], name: m[2], since: m[3] }))
const localClaims = () => (existsSync(WORKING) ? parseClaims(readFileSync(WORKING, 'utf8')) : [])
function writeClaims(list) {
  mkdirSync(dirname(WORKING), { recursive: true })
  writeFileSync(WORKING, `# Working now\n\n${list.map((c) => `- ${c.topic}: ${c.name}, since ${c.since}`).join('\n')}${list.length ? '\n' : ''}`)
}
function tellOthers(list) {
  const others = list.filter((c) => c.name !== me())
  if (others.length) say(`Also being worked on:\n${others.map((c) => `  - ${c.topic}: ${c.name}, since ${c.since} (${days(c.since)} day(s) ago)`).join('\n')}`)
}

/* Conflicts */
function keepGithubSide(text) {
  const out = []
  let state = 'keep'
  for (const line of text.split('\n')) {
    if (line.startsWith('<<<<<<< ')) state = 'github'
    else if (state !== 'keep' && line.startsWith('|||||||')) state = 'base'
    else if (state !== 'keep' && line.startsWith('=======')) state = 'local'
    else if (state !== 'keep' && line.startsWith('>>>>>>> ')) state = 'keep'
    else if (state === 'keep' || state === 'github') out.push(line)
  }
  return out.join('\n')
}

function settleClaims(repo) {
  const github = git(['show', `HEAD:${WORKING_FILE}`], repo.dir)
  let list = github.ok ? parseClaims(github.out) : []
  const intent = git(['log', '-1', '--format=%s', 'REBASE_HEAD'], repo.dir).out.match(/^chore: (claim|release) (.+)$/)
  if (intent?.[1] === 'claim' && !list.some((c) => same(c.topic, intent[2]))) {
    const mine = parseClaims(git(['show', `REBASE_HEAD:${WORKING_FILE}`], repo.dir).out).find((c) => same(c.topic, intent[2]))
    if (mine) list = [...list, mine]
  }
  if (intent?.[1] === 'release') list = list.filter((c) => !same(c.topic, intent[2]))
  writeClaims(list)
  git(['add', '--', WORKING_FILE], repo.dir)
}

function settleStatus(repo) {
  const side = (stage) => git(['show', `:${stage}:${STATUS_FILE}`], repo.dir).out
  writeFileSync(join(HERE, STATUS_FILE), mergeStatus(side(1), side(2), side(3)))
  git(['add', '--', STATUS_FILE], repo.dir)
}

function settleConflicts(repo) {
  const saved = []
  for (let round = 0; round < MAX_ROUNDS && rebasing(repo.dir); round++) {
    for (const file of unmerged(repo.dir)) {
      if (repo === DOCS && file === STATUS_FILE) {
        settleStatus(repo)
        continue
      }
      if (repo === DOCS && file === WORKING_FILE) {
        settleClaims(repo)
        continue
      }
      const local = git(['show', `REBASE_HEAD:${file}`], repo.dir)
      if (local.ok) {
        const keep = join(HERE, CONFLICTS_DIR, today(), repo.label, kept(file))
        mkdirSync(dirname(keep), { recursive: true })
        writeFileSync(keep, `${local.out}\n`)
        saved.push(file)
      }
      const path = join(repo.dir, file)
      if (existsSync(path) && readFileSync(path, 'utf8').includes('<<<<<<< ')) {
        writeFileSync(path, keepGithubSide(readFileSync(path, 'utf8')))
        git(['add', '--', file], repo.dir)
      } else if (git(['checkout', '--ours', '--', file], repo.dir).ok) git(['add', '--', file], repo.dir)
      else {
        git(['rm', '-q', '--cached', '--', file], repo.dir)
        if (existsSync(path)) unlinkSync(path)
      }
    }
    const next = git(['rebase', '--continue'], repo.dir, { GIT_EDITOR: 'true' })
    if (!next.ok && rebasing(repo.dir) && !unmerged(repo.dir).length) git(['rebase', '--skip'], repo.dir, { GIT_EDITOR: 'true' })
  }
  if (rebasing(repo.dir)) {
    git(['rebase', '--abort'], repo.dir)
    throw new Error(`could not bring the ${repo.label} together with GitHub; the attempt was undone, nothing is lost`)
  }
  return saved
}

/* Share */
function pullRebase(repo, autostash) {
  const r = git(['pull', '--rebase', ...(autostash ? ['--autostash'] : []), '--quiet'], repo.dir)
  if (r.ok) return []
  if (!rebasing(repo.dir)) throw new Error(`pull failed for the ${repo.label}: ${r.err.split('\n').pop()}`)
  return settleConflicts(repo)
}

function push(repo) {
  const r = hasUpstream(repo.dir) ? git(['push', '--quiet', 'origin', 'HEAD'], repo.dir) : git(['push', '--quiet', '-u', 'origin', 'HEAD'], repo.dir)
  if (!r.ok) throw new Error(`push failed for the ${repo.label}: ${r.err.split('\n').pop()}`)
}

function share(repo, { autostash = false, upload = AUTO } = {}) {
  if (!hasRemote(repo.dir)) return { skipped: 'no GitHub home' }
  if (!autostash && dirty(repo.dir)) return { skipped: 'unsaved changes' }
  if (!git(['fetch', '--quiet', 'origin'], repo.dir).ok) throw new Error(`could not reach GitHub for the ${repo.label}`)
  const before = git(['rev-parse', 'HEAD'], repo.dir).out
  const saved = hasUpstream(repo.dir) ? pullRebase(repo, autostash) : []
  const log = git(['log', '--format=%an: %s', `${before}..HEAD`], repo.dir).out
  const arrived = log ? log.split('\n').filter((l) => !l.startsWith(`${me()}: `)) : []
  const ahead = hasUpstream(repo.dir) ? Number(git(['rev-list', '--count', '@{u}..HEAD'], repo.dir).out) : Number(git(['rev-list', '--count', 'HEAD'], repo.dir).out)
  if (ahead > 0 && upload) push(repo)
  return { arrived, saved, pushedCount: upload ? ahead : 0, held: upload ? 0 : ahead }
}

function keepConflictNotes(saved) {
  return saved.length > 0 && commitOnly(HERE, `chore: keep ${me() || 'the local'} version of overlapping changes`, CONFLICTS_DIR)
}

function shareDocs() {
  const r = share(DOCS, { autostash: true })
  if (keepConflictNotes(r.saved ?? [])) share(DOCS, { autostash: true })
  return r
}

function rememberAppRemote() {
  if (!APP || ONE || !hasRemote(APP)) return
  const url = git(['remote', 'get-url', 'origin'], APP).out
  if (workspace.appRemote === url) return
  workspace.appRemote = url
  writeJson(WORKSPACE, workspace)
  commitOnly(HERE, "chore: record the app's GitHub home", '.designkit/workspace.json')
}

function report(repo, r) {
  if (r.skipped === 'no GitHub home') return
  if (r.skipped === 'unsaved changes') {
    say(`The ${repo.label} has unsaved work from last time. Commit it, then run: node .designkit/scripts/team-sync.mjs --share`)
    return
  }
  const more = r.arrived.length > 10 ? [`and ${r.arrived.length - 10} more`] : []
  if (r.arrived.length) say(`New in the ${repo.label} from GitHub:\n${[...r.arrived.slice(0, 10), ...more].map((l) => `  - ${l}`).join('\n')}`)
  if (r.saved.length) {
    say(`Overlapping changes in the ${repo.label}: GitHub's version stands (first pushed wins). The version from here is saved for the designer:`)
    for (const file of r.saved) say(`  - ${file}: ${CONFLICTS_DIR}/${today()}/${repo.label}/${kept(file)}`)
    say('  Run lint and the slop gate, fix what broke, and tell the designer which screen and where their version is.')
  }
  if (r.pushedCount > 0) say(`Shared ${r.pushedCount} change(s) to GitHub from the ${repo.label}.`)
  if (r.held > 0) say(`${r.held} saved change(s) in the ${repo.label} are not on GitHub yet: this project uploads only when the designer says so (node .designkit/scripts/team-sync.mjs --share --now).`)
}

function syncAll(kind, now = false) {
  if (IS_KIT) return
  if (!REPOS.some((r) => hasRemote(r.dir))) {
    say(kind === 'start' ? 'This project has no GitHub home yet, so work stays on this Mac until it has one.' : 'This project has no GitHub home yet; the commits stay on this Mac.')
    return
  }
  rememberAppRemote()
  let saved = []
  for (const repo of REPOS) {
    const r = share(repo, { upload: AUTO || now })
    report(repo, r)
    saved = saved.concat(r.saved ?? [])
  }
  if (keepConflictNotes(saved) && hasRemote(HERE) && !dirty(HERE)) report(DOCS, share(DOCS, { upload: AUTO || now }))
  if (kind === 'start') tellOthers(localClaims())
}

/* Claim and release */
function saveClaims(message) {
  if (commitOnly(HERE, message, WORKING_FILE)) return true
  git(['reset', '-q', '--', WORKING_FILE], HERE)
  if (!git(['checkout', '-q', 'HEAD', '--', WORKING_FILE], HERE).ok && existsSync(WORKING)) unlinkSync(WORKING)
  return false
}

function notInKit() {
  if (!IS_KIT) return
  say('team-sync: this is the kit, not a project')
  process.exit(2)
}

function claim(topic) {
  notInKit()
  if (!me()) {
    say('No name set for the work history. Ask the designer for their name and email, then run: git config --global user.name "<name>" and git config --global user.email "<email>".')
    process.exit(2)
  }
  const online = hasRemote(HERE)
  if (online) report(DOCS, { ...shareDocs(), pushedCount: 0 })
  const list = localClaims()
  const taken = (l) => l.find((c) => same(c.topic, topic) && c.name !== me())
  const before = taken(list)
  if (!before && !list.some((c) => same(c.topic, topic))) {
    writeClaims([...list, { topic, name: me(), since: today() }])
    if (!saveClaims(`chore: claim ${topic}`)) {
      say(`Could not save the claim on ${topic}: the commit check refused it. Nothing changed; claim again after the next commit.`)
      process.exit(3)
    }
    if (online) shareDocs()
  }
  const holder = before ?? taken(localClaims())
  if (holder) {
    say(`${holder.topic} is claimed by ${holder.name} since ${holder.since} (${days(holder.since)} day(s) ago). Suggest another screen; go on only if the designer says so.`)
    process.exit(1)
  }
  if (online && AUTO) say(`Claimed ${topic} for ${me()}; the team can see it.`)
  else if (online) say(`Claimed ${topic} for ${me()}, here only until this project uploads (it uploads when the designer says so).`)
  else say(`Claimed ${topic} for ${me()}, here only: this project has no GitHub home yet.`)
  tellOthers(localClaims())
}

function release(topic) {
  notInKit()
  const list = localClaims()
  const rest = list.filter((c) => !same(c.topic, topic))
  if (rest.length === list.length) return
  writeClaims(rest)
  if (!saveClaims(`chore: release ${topic}`)) {
    say(`Could not save the release of ${topic}: the commit check refused it. Nothing changed.`)
    process.exit(3)
  }
  if (hasRemote(HERE)) shareDocs()
  say(`Released ${topic}.`)
}

const [mode, ...rest] = process.argv.slice(2)
try {
  if (mode === '--start') syncAll('start')
  else if (mode === '--share') syncAll('share', rest.includes('--now'))
  else if (mode === '--claim' && rest.length) claim(rest.join(' '))
  else if (mode === '--release' && rest.length) release(rest.join(' '))
  else {
    say('usage: team-sync.mjs --start | --share [--now] | --claim <screen> | --release <screen>')
    process.exit(2)
  }
} catch (error) {
  say(`team-sync: ${error.message}. Work goes on here; it syncs again at the next commit.`)
  process.exit(mode === '--start' ? 0 : 1)
}
