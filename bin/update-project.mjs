#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { sync } from '../.designkit/scripts/adapters.mjs'
import { IMPORT, JOINED, LOCAL, STANDARD, exclude, folders, gitIn, hide, kitVersions, mergeMcp, mergeSettings, newLog, placer, readJson, ruleFiles, styleLines, writeJson } from './lib/place.mjs'

const [target, kit] = process.argv.slice(2)
const OLD_SCRIPTS = ['check-upstream.mjs', 'slop-gate.mjs', 'slop-rules.mjs', 'team-sync.mjs', 'quick-check.mjs', 'review-due.mjs', 'status.mjs', 'package.json', 'package-lock.json', 'node_modules']
const OLD_COMMANDS = ['setup', 'tokenize', 'design-screen', 'commit', 'check', 'slop-check', 'sync']
const FORWARDERS = ['check-upstream.mjs', 'quick-check.mjs', 'review-due.mjs', 'slop-gate.mjs', 'team-sync.mjs']
const PATHS = [
  [/\.claude\/scripts/g, '.designkit/scripts'],
  [/\.claude\/slop-policy\.json/g, '.designkit/slop-policy.json'],
  [/\.claude\/workspace\.json/g, '.designkit/workspace.json'],
  [/\.claude\/upstream\.json/g, '.designkit/upstream.json'],
  [/\.claude\/state\b/g, '.designkit/state'],
  [/\.claude\/commands\/([\w-]+)\.md/g, '.agents/skills/$1/SKILL.md'],
  [/\.claude\/commands\b/g, '.agents/skills'],
  [/\.claude\/skills\//g, '.agents/skills/'],
]
const HOOK_FILES = ['.husky/pre-commit', '.git/hooks/pre-commit', 'lefthook.yml', '.pre-commit-config.yaml']
const APP_HOOKS = {
  'commit-msg': 'd=$(git config --get designkit.docs) || exit 0\n[ -f "$d/.designkit/scripts/commit-msg.mjs" ] || exit 0\nnode "$d/.designkit/scripts/commit-msg.mjs" "$1"\n',
  'pre-push': 'd=$(git config --get designkit.docs) || exit 0\n[ -f "$d/.designkit/scripts/pre-push.mjs" ] || exit 0\nnode "$d/.designkit/scripts/pre-push.mjs" "$@"\n',
}

const say = (text) => console.log(text)
const fail = (text) => {
  console.error(`update-project: ${text}`)
  process.exit(1)
}
const at = (path) => join(target, path)
const fixed = (text) => PATHS.reduce((out, [from, to]) => out.replace(from, to), text)

/* Guards */
const oldHome = at('.claude/workspace.json')
const newHome = at('.designkit/workspace.json')
if (existsSync(at('bin/new-project'))) fail('this is the kit itself, not a project.')
if (!existsSync(oldHome) && !existsSync(newHome)) fail(`${basename(target)} is not a Design Kit project. Start one with bin/new-project.`)
if (!existsSync(join(kit, '.git'))) fail("the kit folder has no history (it was not cloned with git), so it cannot tell its own files from this project's. Clone the kit with git, then run this again.")
const git = gitIn(target)
if (git('status', '--porcelain', '--untracked-files=no').out) fail(`${basename(target)} has unsaved changes. Commit them first, then run this again.`)

const workspace = readJson(existsSync(newHome) ? newHome : oldHome, {})
const joined = workspace.joined === true
const keepOut = workspace.visibility === 'public' || workspace.devRepo === true
const app = resolve(target, workspace.app ?? '.')
const log = newLog()
const had = folders(target)
const owns = kitVersions(kit)
const same = (a, b) => [a, b].every((f) => statSync(f, { throwIfNoEntry: false })?.isFile()) && readFileSync(a).equals(readFileSync(b))
const off = new Set(workspace.skillsOff ?? [])
const leftOut = (path) => off.has(relative(kit, path).match(/^\.agents\/skills\/([^/]+)$/)?.[1])
const { place, sweep, sweepWhole } = placer(kit, target, owns, log, { filter: (path) => !(joined && /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)) && !leftOut(path), prune: !joined })

/* State */
function move(from, to) {
  if (!existsSync(at(from)) || existsSync(at(to))) return
  mkdirSync(dirname(at(to)), { recursive: true })
  renameSync(at(from), at(to))
  log.moved.push(`${from} to ${to}`)
}
move('.claude/workspace.json', '.designkit/workspace.json')
move('.claude/slop-policy.json', '.designkit/slop-policy.json')
move('.claude/upstream.json', '.designkit/upstream.json')
move('.claude/state', '.designkit/state')

/* Old kit files */
for (const name of OLD_COMMANDS) sweep(`.claude/commands/${name}.md`)
for (const name of OLD_SCRIPTS) if (!same(at(`.claude/scripts/${name}`), join(kit, '.claude/scripts', name))) sweep(`.claude/scripts/${name}`)
const kitSkills = readdirSync(join(kit, '.agents/skills'))
for (const name of existsSync(at('.claude/skills')) ? readdirSync(at('.claude/skills')) : []) sweepWhole(`.claude/skills/${name}`)
if (joined) for (const name of existsSync(at('.agents/skills')) ? readdirSync(at('.agents/skills')) : []) if (!kitSkills.includes(name)) sweepWhole(`.agents/skills/${name}`)
if (joined) for (const name of kitSkills) for (const file of ['AGENTS.md', 'README.md']) if (!existsSync(join(kit, '.agents/skills', name, file))) sweep(`.agents/skills/${name}/${file}`)
for (const path of ['.claude/design-kit.md', '.claude/THIRD-PARTY-NOTICES.md', '.claude/licenses']) sweep(path)
for (const dir of ['.claude/commands', '.claude/scripts']) if (existsSync(at(dir)) && !readdirSync(at(dir)).length) sweep(dir)

/* Kit files */
for (const [from, to] of joined ? JOINED : STANDARD) place(from, to)
if (!joined) for (const name of ['README.md', 'THIRD-PARTY-NOTICES.md']) if (existsSync(at(name))) place(name)
for (const name of FORWARDERS) place(`.claude/scripts/${name}`)

if (!existsSync(at('project/DEV.md')) && existsSync(join(kit, 'project/DEV.md'))) {
  mkdirSync(at('project'), { recursive: true })
  cpSync(join(kit, 'project/DEV.md'), at('project/DEV.md'))
  log.added.push('project/DEV.md')
}

/* Policy */
const kitPolicy = readJson(join(kit, '.designkit/slop-policy.json'), {})
const policy = readJson(at('.designkit/slop-policy.json'), null)
const newRules = []
const waiting = []
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
if (!policy) place('.designkit/slop-policy.json')
else {
  const candidates = (kitPolicy.block ?? []).filter((id) => !policy.block?.includes(id) && !policy.skip?.includes(id))
  const found = candidates.length ? appHits() : null
  for (const id of candidates) {
    if (found === null) waiting.push([id, null])
    else if (found.get(id)) waiting.push([id, found.get(id)])
    else newRules.push(id)
  }
  const paths = (kitPolicy.excludePaths ?? []).filter((p) => !policy.excludePaths?.includes(p))
  if (newRules.length || paths.length) {
    writeJson(at('.designkit/slop-policy.json'), { ...policy, block: [...(policy.block ?? []), ...newRules], excludePaths: [...(policy.excludePaths ?? []), ...paths] })
    log.updated.push('.designkit/slop-policy.json')
  }
}
if (!joined) {
  const mine = readJson(at('.designkit/upstream.json'), null)
  const theirs = readJson(join(kit, '.designkit/upstream.json'), {})
  if (!mine) place('.designkit/upstream.json')
  else if (JSON.stringify(mine.borrowed) !== JSON.stringify(theirs.borrowed)) {
    writeJson(at('.designkit/upstream.json'), { ...mine, borrowed: theirs.borrowed })
    log.updated.push('.designkit/upstream.json')
  }
}

/* Rules */
const claude = at('CLAUDE.md')
const rules = existsSync(claude) ? readFileSync(claude, 'utf8') : null
if (joined || rules?.includes('@.claude/design-kit.md') || rules?.includes(IMPORT)) {
  if (rules?.includes('@.claude/design-kit.md')) {
    writeFileSync(claude, rules.replace('@.claude/design-kit.md', IMPORT))
    log.updated.push('CLAUDE.md')
  }
  ruleFiles(target)
} else if (rules === null || owns(claude)) {
  place('CLAUDE.md')
  place('AGENTS.md')
} else {
  if (fixed(rules) !== rules) {
    writeFileSync(claude, fixed(rules))
    log.updated.push('CLAUDE.md (the kit\'s paths in it; the rest is this project\'s own)')
  }
  if (!existsSync(at('AGENTS.md'))) {
    writeFileSync(at('AGENTS.md'), 'Read `CLAUDE.md` in this folder before any work: it holds this project\'s rules.\n')
    log.added.push('AGENTS.md')
  }
}

/* Tools */
const settingsFile = `.claude/${keepOut ? 'settings.local.json' : 'settings.json'}`
const settingsNow = readJson(at(settingsFile), {})
const settingsNext = mergeSettings(settingsNow, readJson(join(kit, '.claude/settings.json'), {}))
if (JSON.stringify(settingsNow) !== JSON.stringify(settingsNext)) {
  writeJson(at(settingsFile), settingsNext)
  log.updated.push(settingsFile)
}
if (existsSync(at('.mcp.json')) && owns(at('.mcp.json')) && !keepOut) place('.mcp.json')
else if (mergeMcp(target, kit, keepOut)) log.updated.push('.mcp.json')
const made = sync(target, { owns, merge: !keepOut })
log.added.push(...made.added)
log.updated.push(...made.updated)
log.kept.push(...made.kept)

/* Workspace */
const home = homedir()
const kitRef = kit.startsWith(`${home}/`) ? `~/${kit.slice(home.length + 1)}` : kit
const here = readJson(newHome, {})
if (here.kit !== kitRef) writeJson(newHome, { ...here, kit: kitRef })

/* Ignore */
if (joined) exclude(target, keepOut ? [...LOCAL, ...log.added.filter((p) => !p.startsWith('project/') && p !== 'AGENTS.md').map(hide(had)), '/.designkit/workspace.json', '/.designkit/slop-policy.json', '/.designkit/upstream.json'] : LOCAL)
else {
  const file = at('.gitignore')
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split('\n') : []
  const next = lines.filter((line) => line.trim() !== '.agents/').map((line) => (line.trim() === '.claude/state/' ? '.designkit/state/' : line))
  if (!next.includes('.designkit/state/')) next.splice(next.at(-1) === '' ? -1 : next.length, 0, '.designkit/state/')
  if (next.join('\n') !== lines.join('\n')) {
    writeFileSync(file, next.join('\n'))
    log.updated.push('.gitignore')
  }
}
const ignored = git('check-ignore', '-q', '.agents/skills/no-slop/SKILL.md').ok && !keepOut

/* Hooks */
const appGit = gitIn(app)
const hooksPath = appGit('config', '--get', 'core.hooksPath').out
const hookFiles = [...HOOK_FILES, ...(hooksPath ? [`${hooksPath}/pre-commit`] : [])]
for (const name of hookFiles) {
  const file = join(app, name)
  if (!existsSync(file)) continue
  const text = readFileSync(file, 'utf8')
  if (fixed(text) === text) continue
  writeFileSync(file, fixed(text))
  log.updated.push(`${app === target ? '' : `${basename(app)}/`}${name}`)
}
const husky = join(app, '.husky/pre-commit')
if (!joined && existsSync(husky) && readFileSync(husky, 'utf8').includes('designkit.docs')) {
  for (const [name, text] of Object.entries(APP_HOOKS)) {
    if (existsSync(join(app, '.husky', name))) continue
    writeFileSync(join(app, '.husky', name), text)
    log.added.push(`${basename(app)}/.husky/${name}`)
  }
}
const ownHooks = existsSync(at('.git/hooks')) && readdirSync(at('.git/hooks')).some((name) => !name.endsWith('.sample'))
if (!joined && !git('config', '--get', 'core.hooksPath').out && !ownHooks) {
  for (const name of ['commit-msg', 'pre-push']) if (existsSync(at(`.designkit/hooks/${name}`))) chmodSync(at(`.designkit/hooks/${name}`), 0o755)
  git('config', 'core.hooksPath', '.designkit/hooks')
}

/* Finish */
const sheet = joined ? styleLines(target) : null
if (sheet) log.updated.push(sheet)
if (spawnSync('npm', ['ci', '--no-audit', '--no-fund', '--silent'], { cwd: at('.designkit/scripts') }).status !== 0) console.error("update-project: could not install the slop gate's parser (offline?). /sync will retry.")
const STALE = /\.claude\/(?:scripts|state|workspace\.json|slop-policy\.json|upstream\.json|commands)/
const mentions = git('grep', '-l', '-E', STALE.source, '--', 'project', '*.md').out.split('\n').filter((f) => f && f !== 'CLAUDE.md')

const changed = log.moved.length + log.added.length + log.updated.length + log.removed.length
if (!changed) {
  say(`\n  ${workspace.name ?? basename(target)} is already current with the kit.${log.kept.length ? `\n  Still this project's own, not the kit's: ${[...new Set(log.kept)].join(', ')}.` : ''}\n`)
  process.exit(0)
}
const few = (list) => (list.length > 12 ? `${list.slice(0, 12).join(', ')} and ${list.length - 12} more` : list.join(', '))
say(`\n  ${workspace.name ?? basename(target)} now uses the kit's current layout.`)
if (log.moved.length) say(`  Moved: ${log.moved.join('; ')}.`)
say(`  Kit files: ${log.added.length} added, ${log.updated.length} replaced with the current version, ${log.removed.length} old ones removed.`)
if (log.updated.some((p) => p.startsWith('CLAUDE.md ('))) say("  CLAUDE.md is this project's own: only the kit's paths in it were updated. Read it once and correct what it says about where the kit lives (.designkit/, .agents/skills/).")
if (log.kept.length) say(`  Kept, because this project changed or wrote them: ${few([...new Set(log.kept)])}.`)
if (newRules.length) say(`  New checks now on: ${newRules.join(', ')}. Add an id to "skip" in .designkit/slop-policy.json if the project's look needs it.`)
for (const [id, n] of waiting) say(n === null ? `  ${id} is new; the app could not be checked, so it warns until /sync finds the app passes it.` : `  ${id} is new and found ${n} place(s) already in the app: it warns until they are fixed, then /sync turns it on.`)
if (mentions.length) say(`  Still mention the old paths (they keep working; fix when next there): ${few(mentions)}.`)
if (ignored) say('  Warning: .agents/ is ignored by git here, so skills will not reach teammates. Remove that line from .gitignore.')
if (joined) say('  The commit message and push checks are not in this project\'s own hooks yet: /setup, .agents/skills/setup/joined.md step 6, has the lines.')
say('\n  Nothing is committed. Next: read this list, commit this folder and the app, then start a new chat\n  (a chat opened before this still has the old commands loaded).\n')
