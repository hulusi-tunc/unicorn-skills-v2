#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const LOCK = JSON.parse(readFileSync(join(HERE, '.designkit/tools.lock.json'), 'utf8')).tools
const CACHE = process.env.DESIGNKIT_TOOLS_CACHE ?? join(homedir(), '.designkit/tools')
const WS = join(HERE, '.designkit/workspace.json')
const workspace = () => {
  try {
    return JSON.parse(readFileSync(WS, 'utf8'))
  } catch {
    return {}
  }
}
const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' })

function list() {
  const have = new Set(workspace().tools ?? [])
  for (const [name, t] of Object.entries(LOCK)) console.log(`${have.has(name) ? 'on ' : '   '} ${name.padEnd(16)} ${t.repo ? '' : '(no repo yet) '}${t.what}`)
}

function suggest(moment) {
  const ws = workspace()
  const have = new Set(ws.tools ?? [])
  const declined = new Set((ws.toolsDeclined ?? []).filter((d) => d.moment === moment).map((d) => d.name))
  const fits = Object.entries(LOCK).filter(([name, t]) => t.suggest?.includes(moment) && !have.has(name) && !declined.has(name) && t.repo)
  for (const [name, t] of fits) console.log(`${name}: ${t.what}. Pinned and checked (${t.checked}).`)
}

function decline(name, moment) {
  const ws = workspace()
  ws.toolsDeclined = [...(ws.toolsDeclined ?? []), { name, moment, date: new Date().toISOString().slice(0, 10) }]
  writeFileSync(WS, `${JSON.stringify(ws, null, 2)}\n`)
}

function pull(name) {
  const t = LOCK[name]
  if (!t) throw new Error(`no tool named ${name}; see --list`)
  if (!t.repo) throw new Error(`${name} has no repository yet: ${t.pending}`)
  const dir = join(CACHE, `${name}@${t.pin.slice(0, 12)}`)
  if (!existsSync(join(dir, '.git'))) {
    mkdirSync(dir, { recursive: true })
    git(['init', '-q'], dir)
    git(['remote', 'add', 'origin', t.repo], dir)
    const f = git(['fetch', '-q', '--depth', '1', 'origin', t.pin], dir)
    if (f.status !== 0) {
      rmSync(dir, { recursive: true, force: true })
      throw new Error(`could not fetch ${name} at ${t.pin.slice(0, 7)}: ${f.stderr.trim().slice(0, 200)}`)
    }
    git(['checkout', '-q', 'FETCH_HEAD'], dir)
  }
  const head = git(['rev-parse', 'HEAD'], dir).stdout.trim()
  if (head !== t.pin) throw new Error(`${name} cache is at ${head.slice(0, 7)}, the lock pins ${t.pin.slice(0, 7)}; delete ${dir} and pull again`)
  const linked = []
  for (const rel of [t.skill, ...(t.also ?? [])]) {
    const source = join(dir, rel)
    const target = join(HERE, '.agents/skills', rel === '.' ? name : basename(rel))
    if (existsSync(target) || isLink(target)) rmSync(target, { recursive: true, force: true })
    symlinkSync(source, target)
    linked.push(basename(target))
  }
  const gitDir = git(['rev-parse', '--git-dir'], HERE)
  if (gitDir.status === 0) {
    const exclude = resolve(HERE, gitDir.stdout.trim(), 'info/exclude')
    mkdirSync(dirname(exclude), { recursive: true })
    const have = existsSync(exclude) ? readFileSync(exclude, 'utf8') : ''
    const lines = linked.flatMap((n) => [`/.agents/skills/${n}`, `/.claude/skills/${n}`]).filter((l) => !have.split('\n').includes(l))
    if (lines.length) appendFileSync(exclude, `${have && !have.endsWith('\n') ? '\n' : ''}${lines.join('\n')}\n`)
  }
  const ws = workspace()
  ws.tools = [...new Set([...(ws.tools ?? []), name])]
  writeFileSync(WS, `${JSON.stringify(ws, null, 2)}\n`)
  const adapters = join(HERE, '.designkit/scripts/adapters.mjs')
  if (existsSync(adapters)) spawnSync(process.execPath, [adapters], { cwd: HERE, encoding: 'utf8' })
  console.log(`${name} ready at ${t.pin.slice(0, 7)}: ${linked.join(', ')}.${t.env ? ` Run it with ${Object.entries(t.env).map(([k, v]) => `${k}=${v}`).join(' ')}.` : ''}${t.patch ? ` ${t.patch}.` : ''}`)
}
const isLink = (p) => {
  try {
    return lstatSync(p).isSymbolicLink()
  } catch {
    return false
  }
}

const [cmd, a, b] = process.argv.slice(2)
try {
  if (cmd === '--list' || !cmd) list()
  else if (cmd === '--suggest') suggest(a)
  else if (cmd === '--pull') pull(a)
  else if (cmd === '--decline') decline(a, b)
  else throw new Error('use --list, --suggest <moment>, --pull <name> or --decline <name> <moment>')
} catch (e) {
  console.error(`tools: ${e.message}`)
  process.exit(1)
}
