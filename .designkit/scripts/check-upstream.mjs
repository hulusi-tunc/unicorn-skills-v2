#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { linkSkills } from './adapters.mjs'

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CACHE = join(homedir(), '.cache/design-kit')
const DIFF_LINES = 150

const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
const expand = (p) => (p.startsWith('~/') ? join(homedir(), p.slice(2)) : p)

const IS_KIT = existsSync(join(HERE, 'bin/new-project'))
const workspace = readJson(join(HERE, '.designkit/workspace.json'), {})
const KIT = IS_KIT ? HERE : workspace.kit && existsSync(join(expand(workspace.kit), 'bin/new-project')) ? resolve(expand(workspace.kit)) : null
const TARGETS = [...new Set([KIT, HERE].filter(Boolean))]
const OFF = IS_KIT ? [] : workspace.skillsOff ?? []
const UNUSED = ['AGENTS.md', 'README.md']

function run(cmd, args, cwd, input) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, input, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] })
  return { ok: r.status === 0, status: r.status, out: r.stdout ?? '', err: (r.stderr ?? '').trim() }
}

function git(args, cwd) {
  const r = run('git', args, cwd)
  if (!r.ok) throw new Error(`git ${args[0]} failed: ${(r.err.split('\n').find((l) => l.startsWith('fatal:')) ?? r.err.split('\n').pop()).replace(/^fatal:\s*/, '')}`)
  return r.out
}

const repos = new Map()
function repo(slug) {
  if (repos.has(slug)) return repos.get(slug)
  const dir = join(CACHE, slug.replace('/', '__'))
  mkdirSync(CACHE, { recursive: true })
  if (!existsSync(join(dir, '.git'))) git(['clone', '-q', '--filter=blob:none', '--no-checkout', `https://github.com/${slug}.git`, dir], CACHE)
  else git(['fetch', '-q', 'origin'], dir)
  const head = git(['rev-parse', 'refs/remotes/origin/HEAD'], dir).trim()
  const info = { dir, head }
  repos.set(slug, info)
  return info
}

const cap = (text) => {
  const lines = text.trimEnd().split('\n')
  return lines.length > DIFF_LINES ? `${lines.slice(0, DIFF_LINES).join('\n')}\n... ${lines.length - DIFF_LINES} more lines` : lines.join('\n')
}

/* Check */
function checkBorrowed(lock, up, errors) {
  const out = []
  for (const [name, entry] of Object.entries(lock.skills ?? {})) {
    if (entry.sourceType !== 'github' || OFF.includes(name)) continue
    const base = up.borrowed?.[name]
    let r
    try {
      r = repo(entry.source)
    } catch (error) {
      errors.push(`${entry.source}: ${error.message}`)
      continue
    }
    const folder = dirname(entry.skillPath)
    if (!base) {
      errors.push(`${name}: no recorded upstream version; run --apply ${name} once to record it`)
      continue
    }
    if (base === r.head) continue
    const paths = [folder, ...UNUSED.map((f) => `:!${folder}/${f}`)]
    const changed = run('git', ['diff', '--quiet', base, r.head, '--', ...paths], r.dir)
    if (changed.ok) continue
    if (changed.status !== 1) {
      errors.push(`${name}: ${changed.err}`)
      continue
    }
    const exists = run('git', ['cat-file', '-e', `${r.head}:${folder}`], r.dir).ok
    const fingerprint = git(['log', '-1', '--format=%H', r.head, '--', folder], r.dir).trim()
    out.push({
      name,
      source: entry.source,
      fingerprint,
      removed: !exists,
      declined: up.declined?.[name] === fingerprint,
      log: git(['log', '--format=%h %ad %s', '--date=short', `${base}..${r.head}`, '--', ...paths], r.dir).trim(),
      diff: cap(git(['diff', base, r.head, '--', ...paths], r.dir)),
    })
  }
  return out
}

function check() {
  const up = readJson(join(HERE, '.designkit/upstream.json'), null)
  const lock = readJson(join(HERE, 'skills-lock.json'), { skills: {} })
  if (!up) {
    console.log('check-upstream: .designkit/upstream.json is missing; copy it from ~/design-kit/.designkit/upstream.json')
    process.exit(2)
  }
  const errors = []
  const found = checkBorrowed(lock, up, errors)
  const fresh = found.filter((f) => !f.declined)
  const declined = found.filter((f) => f.declined)
  const today = new Date().toISOString().slice(0, 10)

  console.log(`Upstream check, ${today}. Watching the ${Object.keys(lock.skills ?? {}).length} borrowed skills in skills-lock.json; the kit's own skills are not watched.`)
  if (!KIT && !IS_KIT) console.log('Note: the kit folder was not found (workspace.json "kit"), so applying would update this project only.')
  if (!fresh.length) console.log(errors.length ? '\nNothing new among the skills that could be checked.' : '\nEverything is current.')
  for (const f of fresh) {
    console.log(`\n=== ${f.name} (${f.source})${f.removed ? ' REMOVED UPSTREAM' : ''}`)
    if (f.log) console.log(`commits:\n${f.log.replace(/^/gm, '  ')}`)
    if (f.diff) console.log(`changes:\n${f.diff}`)
  }
  if (declined.length) console.log(`\nDeclined earlier, nothing new since: ${declined.map((f) => f.name).join(', ')}`)
  if (errors.length) console.log(`\nCould not check (offline, or the repo moved):\n${errors.map((e) => `  ${e}`).join('\n')}`)
  if (fresh.length) console.log(`\nTo take changes: node .designkit/scripts/check-upstream.mjs --apply <names>\nTo skip them until they change again: node .designkit/scripts/check-upstream.mjs --skip <names>`)

  for (const t of TARGETS) {
    const tu = readJson(join(t, '.designkit/upstream.json'), null)
    if (tu) writeJson(join(t, '.designkit/upstream.json'), { ...tu, checked: today })
  }
}

/* Apply */
function fetchSkill(entry, name) {
  const tmp = mkdtempSync(join(tmpdir(), 'design-kit-skill-'))
  const r = run('npx', ['-y', 'skills', 'add', entry.source, '--skill', name, '-a', 'claude-code', '--copy', '-y'], tmp, '')
  const dir = join(tmp, '.claude/skills', name)
  if (!r.ok || !existsSync(join(dir, 'SKILL.md'))) {
    rmSync(tmp, { recursive: true, force: true })
    throw new Error(`skills add ${name} failed: ${(r.err || r.out).split('\n').slice(-3).join(' ')}`)
  }
  return { tmp, dir, lock: readJson(join(tmp, 'skills-lock.json'), { skills: {} }).skills?.[name] }
}

function applyBorrowed(name, notes) {
  const entry = readJson(join(KIT ?? HERE, 'skills-lock.json'), { skills: {} }).skills[name]
  if (!entry) throw new Error(`${name} is not in skills-lock.json`)
  const got = fetchSkill(entry, name)
  try {
    for (const t of TARGETS) {
      if (t === KIT || !OFF.includes(name)) {
        rmSync(join(t, '.agents/skills', name), { recursive: true, force: true })
        cpSync(got.dir, join(t, '.agents/skills', name), { recursive: true })
        for (const f of UNUSED) rmSync(join(t, '.agents/skills', name, f), { force: true })
        linkSkills(t)
      }
      const lock = readJson(join(t, 'skills-lock.json'), { version: 1, skills: {} })
      lock.skills[name] = got.lock ?? entry
      writeJson(join(t, 'skills-lock.json'), lock)
    }
  } finally {
    rmSync(got.tmp, { recursive: true, force: true })
  }
  const head = repo(entry.source).head
  for (const t of TARGETS) {
    const up = readJson(join(t, '.designkit/upstream.json'), null)
    if (!up) continue
    up.borrowed = { ...(up.borrowed ?? {}), [name]: head }
    if (up.declined) delete up.declined[name]
    writeJson(join(t, '.designkit/upstream.json'), up)
  }
  notes.push(`${name}: refreshed${TARGETS.length > 1 ? ' in the kit and here' : ''}`)
}

function apply(names) {
  const lock = readJson(join(HERE, 'skills-lock.json'), { skills: {} })
  const borrowed = Object.keys(lock.skills ?? {})
  const list = names.includes('all') ? borrowed : names
  const notes = []
  const failed = []
  for (const name of list) {
    try {
      if (borrowed.includes(name)) applyBorrowed(name, notes)
      else {
        failed.push(name)
        notes.push(`${name}: not a watched skill`)
      }
    } catch (error) {
      failed.push(name)
      notes.push(`${name}: ${error.message}`)
    }
  }
  console.log([...new Set(notes)].join('\n'))
  const gate = join(HERE, '.designkit/scripts/slop-gate.mjs')
  if (existsSync(gate)) {
    const t = run(process.execPath, [gate, '--self-test'], HERE)
    console.log(`\nslop gate self-test: ${t.ok ? 'passed' : 'FAILED'}${t.ok ? '' : `\n${t.out}`}`)
    if (!t.ok) failed.push('slop gate')
  }
  process.exit(failed.length ? 1 : 0)
}

function skip(names) {
  const up = readJson(join(HERE, '.designkit/upstream.json'), {})
  const lock = readJson(join(HERE, 'skills-lock.json'), { skills: {} })
  const errors = []
  const found = checkBorrowed(lock, up, errors)
  for (const name of names) {
    const f = found.find((x) => x.name === name)
    if (!f) {
      console.log(`${name}: no upstream change to skip`)
      continue
    }
    for (const t of TARGETS) {
      const tu = readJson(join(t, '.designkit/upstream.json'), null)
      if (!tu) continue
      tu.declined = { ...(tu.declined ?? {}), [name]: f.fingerprint }
      writeJson(join(t, '.designkit/upstream.json'), tu)
    }
    console.log(`${name}: skipped until it changes upstream again`)
  }
}

const args = process.argv.slice(2)
try {
  if (args[0] === '--apply') apply(args.slice(1))
  else if (args[0] === '--skip') skip(args.slice(1))
  else check()
} catch (error) {
  console.log(`check-upstream: ${error.message}`)
  process.exit(2)
}
