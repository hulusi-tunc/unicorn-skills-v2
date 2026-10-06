#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { SHARED, sync } from '../.designkit/scripts/adapters.mjs'
import { JOINED, LOCAL, exclude, folders, gitIn, hide, kitVersions, mergeMcp, mergeSettings, newLog, placer, readJson, ruleFiles, styleLines, writeJson } from './lib/place.mjs'

const [target, kit] = process.argv.slice(2)
const name = basename(target).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-._]+|[-._]+$/g, '') || 'project'
const PROJECT = ['brief', 'design-system', 'reviews', 'screens']
const TESTS = /\.(test|spec)\.[cm]?[jt]sx?$/
const SAFE = ['node_modules/', '.env', '.env.*', '!.env.example', '.next/', '.expo/', 'dist/', 'build/', 'out/', 'coverage/', '.vercel/', '.DS_Store']
const TOUCHED = ['CLAUDE.md', 'AGENTS.md', '.claude/settings.json', '.claude/settings.local.json', '.mcp.json', '.designkit/workspace.json', ...SHARED]

const say = (text) => console.log(text)
const fail = (text) => {
  console.error(`new-project: ${text}`)
  process.exit(1)
}
const git = gitIn(target)
const log = newLog()

/* History */
function history() {
  if (!existsSync(join(target, '.git'))) git('init', '-q', '-b', 'main')
  if (!git('rev-parse', '-q', '--verify', 'HEAD').ok) {
    exclude(target, SAFE)
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

/* Folders */
function emptied(path) {
  for (let dir = dirname(join(target, path)); dir.startsWith(`${target}/`); dir = dirname(dir)) {
    if (!existsSync(dir) || readdirSync(dir).length) return
    rmdirSync(dir)
  }
}

/* Commit */
function commit(message, body) {
  const r = spawnSync('git', ['commit', '-q', '-m', message, '-m', body], { cwd: target, encoding: 'utf8' })
  return r.status === 0 ? null : (r.stderr || r.stdout || 'git gave no reason').trim()
}

function undo(before) {
  git('reset', '-q')
  for (const path of log.updated) git('checkout', '-q', '--', path)
  for (const path of [...log.added, '.designkit/scripts/node_modules']) rmSync(join(target, path), { recursive: true, force: true })
  for (const [path, data] of before) {
    if (data === null) rmSync(join(target, path), { force: true })
    else writeFileSync(join(target, path), data)
  }
  for (const path of [...log.added, ...before.keys(), '.designkit/scripts/node_modules']) emptied(path)
  git('config', '--unset', 'designkit.docs')
}

/* Join */
say(`Join mode: ${basename(target)} already has code, so the kit fits around it.`)
history()
const before = new Map(TOUCHED.map((path) => [path, existsSync(join(target, path)) ? readFileSync(join(target, path)) : null]))
const had = folders(target)
const visibility = findVisibility()
const isPublic = visibility === 'public'
function someoneElse() {
  const email = git('config', 'user.email').out
  const name = git('config', 'user.name').out
  const gh = spawnSync('gh', ['api', 'user', '--jq', '.login'], { cwd: target, encoding: 'utf8' })
  const login = gh.status === 0 ? gh.stdout.trim().toLowerCase() : ''
  const mine = (e, n) => e === email || n === name || (login && e.toLowerCase().replace(/^\d+\+/, '') === `${login}@users.noreply.github.com`)
  return git('log', '--format=%ae%x09%an').out.split('\n').filter(Boolean).map((line) => line.split('\t')).some(([e, n]) => !/\[bot\]/i.test(`${e} ${n}`) && !mine(e, n))
}
const devRepo = someoneElse()
const keepOut = isPublic || devRepo
const owns = kitVersions(kit)
const { place } = placer(kit, target, owns, log, { filter: (path) => !TESTS.test(path) })
for (const [from, to] of JOINED) place(from, to)
for (const dir of PROJECT) {
  if (existsSync(join(target, 'project', dir))) continue
  mkdirSync(join(target, 'project', dir), { recursive: true })
  writeFileSync(join(target, 'project', dir, '.gitkeep'), '')
  log.added.push(`project/${dir}/.gitkeep`)
}
if (!existsSync(join(target, 'project/DEV.md'))) {
  cpSync(join(kit, 'project/DEV.md'), join(target, 'project/DEV.md'))
  log.added.push('project/DEV.md')
}
const settingsFile = `.claude/${keepOut ? 'settings.local.json' : 'settings.json'}`
writeJson(join(target, settingsFile), mergeSettings(readJson(join(target, settingsFile), {}), readJson(join(kit, '.claude/settings.json'), {})))
const mcpAdded = mergeMcp(target, kit, keepOut)
const made = sync(target, { owns, merge: !keepOut })
log.added.push(...made.added)
log.updated.push(...made.updated)
log.kept.push(...made.kept)
ruleFiles(target)
const home = homedir()
writeJson(join(target, '.designkit/workspace.json'), { name, app: '.', joined: true, share: false, kit: kit.startsWith(`${home}/`) ? `~/${kit.slice(home.length + 1)}` : kit, visibility, ...(devRepo ? { devRepo: true } : {}) })
git('config', 'designkit.docs', '.')
const kitOnly = [...log.added.filter((p) => !p.startsWith('project/')).map(hide(had)), '/.claude/settings.local.json', '/.designkit/workspace.json', ...(mcpAdded ? ['/.mcp.json'] : [])]
exclude(target, keepOut ? [...LOCAL, ...kitOnly, ...(devRepo ? ['/project/'] : [])] : LOCAL)
if (spawnSync('npm', ['ci', '--no-audit', '--no-fund', '--silent'], { cwd: join(target, '.designkit/scripts') }).status !== 0) console.error("new-project: could not install the slop gate's parser (offline?). /setup will retry.")
const projectFiles = log.added.filter((p) => p.startsWith('project/'))
const stage = devRepo ? ['CLAUDE.md', 'AGENTS.md'] : isPublic ? ['CLAUDE.md', 'AGENTS.md', ...projectFiles] : ['CLAUDE.md', 'AGENTS.md', settingsFile, '.designkit/workspace.json', ...log.added, ...log.updated, ...made.updated, ...(mcpAdded ? ['.mcp.json'] : [])]
git('add', '--', ...new Set(stage))
const why = devRepo
  ? 'CLAUDE.md and AGENTS.md now load the design kit when it is present on the machine. A developer works in this repository, so the kit itself and the design notes stay on the designer\'s machine and out of its history.'
  : isPublic
  ? 'CLAUDE.md and AGENTS.md now load the design kit when it is present on the machine. The kit itself stays out of this public repository: some of its skills may not be shared.'
  : "The design kit's skills, reviewers, workflows and checks now sit beside the existing code in .designkit/, .agents/ and each agent tool's folder; CLAUDE.md and AGENTS.md load the kit's rules from .designkit/rules.md. Nothing of the project moved or changed. Where the kit's rules clash with how the project works is settled next, in /setup."
const refused = commit('chore: add the design kit', why)
if (refused) {
  undo(before)
  fail(`the project's own commit check refused the kit's commit, so nothing was saved and the project is as it was. What it said:\n${refused}`)
}
let sheet = styleLines(target)
if (sheet) {
  git('add', '--', sheet)
  const styleRefused = commit('chore(styles): keep the design kit out of the stylesheet', "Tailwind scans every file in the project for class names, and the design kit's guides are full of them. Without these lines the stylesheet grows with styles nothing uses (on the owner's portfolio, 46 KB to 60 KB). Nothing the site uses lives in the kit's folders or in project/.")
  if (styleRefused) {
    git('reset', '-q', '--', sheet)
    git('checkout', '-q', '--', sheet)
    say(`  Could not save the stylesheet lines (the project's commit check said: ${styleRefused.split('\n')[0]}); /setup adds them.`)
    sheet = null
  }
}

say(`\n  ${name} now has the design kit, beside its own code. Nothing of the project moved.`)
if (log.kept.length) say(`  Kept the project's own ${log.kept.join(', ')}; the kit's versions were not copied.`)
if (sheet) say(`  A few lines in ${sheet} keep the kit's guides out of the site's stylesheet, so visitors download nothing extra.`)
if (devRepo) say("  A developer works in this repository, so the kit's files and the design notes stay on this Mac and out of its history.")
else if (isPublic) say("  The repository is public, so the kit's files stay on this Mac and out of its history.")
say('\n  Next: /setup. It reads the project and asks only what it cannot find.\n')
