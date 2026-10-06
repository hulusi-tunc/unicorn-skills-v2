import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'

export const IMPORT = '@.designkit/rules.md'
export const POINTER = "If `.designkit/rules.md` exists, read it before any work here: the design kit's rules apply to this project."
export const LOCAL = ['/.designkit/state/', '/.designkit/scripts/node_modules/']
export const JOINED = [
  ['.agents/skills', '.agents/skills'],
  ['.designkit/scripts', '.designkit/scripts'],
  ['.designkit/agents', '.designkit/agents'],
  ['.designkit/hooks', '.designkit/hooks'],
  ['.designkit/plugins', '.designkit/plugins'],
  ['.designkit/rules', '.designkit/rules'],
  ['.designkit/upstream.json', '.designkit/upstream.json'],
  ['.designkit/tools.lock.json', '.designkit/tools.lock.json'],
  ['.claude/output-styles', '.claude/output-styles'],
  ['AGENTS.md', '.designkit/rules.md'],
  ['THIRD-PARTY-NOTICES.md', '.designkit/THIRD-PARTY-NOTICES.md'],
  ['licenses', '.designkit/licenses'],
]
export const STANDARD = [
  ['.agents/skills', '.agents/skills'],
  ['.designkit/scripts', '.designkit/scripts'],
  ['.designkit/agents', '.designkit/agents'],
  ['.designkit/hooks', '.designkit/hooks'],
  ['.designkit/plugins', '.designkit/plugins'],
  ['.designkit/rules', '.designkit/rules'],
  ['.designkit/tools.lock.json', '.designkit/tools.lock.json'],
  ['.claude/output-styles', '.claude/output-styles'],
  ['licenses', 'licenses'],
  ['skills-lock.json', 'skills-lock.json'],
]
const STYLE_DIRS = ['.claude', '.agents', '.designkit', 'project']
const ROOTS = ['.designkit', '.agents', '.claude', '.codex', '.cursor', '.gemini', '.opencode', '.github']
const SKIP = new Set(['node_modules', '.DS_Store'])
const KIT_HOOK = /\.(?:claude|designkit)\/scripts\/(?:team-sync|review-due|slop-gate|hook)\.mjs/

export const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}
export const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}
export const gitIn = (cwd) => (...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  return { ok: r.status === 0, out: (r.stdout ?? '').trim() }
}
export const newLog = () => ({ added: [], updated: [], kept: [], removed: [], moved: [] })

/* Ownership */
const blob = (data) => createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')

export function kitVersions(kit) {
  const current = new Set()
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue
      if (entry.isDirectory()) walk(join(dir, entry.name))
      else if (entry.isFile()) current.add(blob(readFileSync(join(dir, entry.name))))
    }
  }
  walk(kit)
  const past = new Map()
  return (file) => {
    const hash = blob(readFileSync(file))
    if (current.has(hash)) return true
    if (!past.has(hash)) past.set(hash, spawnSync('git', ['cat-file', '-e', hash], { cwd: kit }).status === 0)
    return past.get(hash)
  }
}

/* Place */
export function placer(kit, target, owns, log, { filter = () => true, prune = false } = {}) {
  const rel = (abs) => relative(target, abs)
  const mine = (abs) => basename(abs) === '.DS_Store' || owns(abs)
  const gone = (abs, tell) => {
    const stat = lstatSync(abs, { throwIfNoEntry: false })
    if (!stat) return true
    if (stat.isSymbolicLink()) return false
    if (stat.isDirectory()) {
      if (basename(abs) === 'node_modules') {
        rmSync(abs, { recursive: true, force: true })
        return true
      }
      const empty = readdirSync(abs).map((entry) => gone(join(abs, entry), tell)).every(Boolean)
      if (empty) rmdirSync(abs)
      return empty
    }
    if (mine(abs)) {
      unlinkSync(abs)
      if (basename(abs) !== '.DS_Store') log.removed.push(rel(abs))
      return true
    }
    if (tell) log.kept.push(rel(abs))
    return false
  }
  const wholly = (abs) => {
    const stat = lstatSync(abs, { throwIfNoEntry: false })
    if (!stat || stat.isSymbolicLink()) return true
    if (stat.isDirectory()) return readdirSync(abs).every((entry) => entry === 'node_modules' || wholly(join(abs, entry)))
    return mine(abs)
  }
  const file = (from, to) => {
    if (!existsSync(to)) {
      mkdirSync(dirname(to), { recursive: true })
      cpSync(from, to)
      log.added.push(rel(to))
    } else if (readFileSync(from).equals(readFileSync(to))) return
    else if (owns(to)) {
      cpSync(from, to)
      log.updated.push(rel(to))
    } else log.kept.push(rel(to))
  }
  const tree = (from, to) => {
    if (!statSync(from).isDirectory()) return file(from, to)
    const names = readdirSync(from).filter((entry) => !SKIP.has(entry) && filter(join(from, entry)))
    for (const entry of names) tree(join(from, entry), join(to, entry))
    if (!prune || !existsSync(to)) return
    for (const entry of readdirSync(to)) if (!SKIP.has(entry) && !names.includes(entry)) gone(join(to, entry), false)
  }
  return {
    place: (from, to = from) => existsSync(join(kit, from)) && tree(join(kit, from), join(target, to)),
    sweep: (path) => gone(join(target, path), true),
    sweepWhole: (path) => {
      const abs = join(target, path)
      const stat = lstatSync(abs, { throwIfNoEntry: false })
      if (!stat || stat.isSymbolicLink()) return
      if (!wholly(abs)) return log.kept.push(`${path}/`)
      rmSync(abs, { recursive: true, force: true })
      log.removed.push(`${path}/`)
    },
  }
}

/* Settings */
export function mergeSettings(mine, kits) {
  const out = { ...mine }
  for (const key of ['outputStyle', 'attribution', 'includeCoAuthoredBy']) if (!(key in out) && key in kits) out[key] = kits[key]
  out.permissions = { ...mine.permissions, deny: [...new Set([...(mine.permissions?.deny ?? []), ...(kits.permissions?.deny ?? [])])] }
  out.hooks = {}
  for (const [event, groups] of Object.entries(mine.hooks ?? {})) {
    const left = groups.map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !KIT_HOOK.test(h.command ?? '')) })).filter((g) => g.hooks.length)
    if (left.length) out.hooks[event] = left
  }
  for (const [event, groups] of Object.entries(kits.hooks ?? {})) out.hooks[event] = [...(out.hooks[event] ?? []), ...groups]
  return out
}

export function mergeMcp(target, kit, skipExisting) {
  const path = join(target, '.mcp.json')
  if (skipExisting && existsSync(path)) return false
  const mine = readJson(path, {})
  const servers = { ...readJson(join(kit, '.mcp.json'), {}).mcpServers, ...mine.mcpServers }
  if (Object.keys(servers).length === Object.keys(mine.mcpServers ?? {}).length) return false
  writeJson(path, { ...mine, mcpServers: servers })
  return true
}

/* Rules */
export function ruleFiles(target) {
  const claude = join(target, 'CLAUDE.md')
  const agents = join(target, 'AGENTS.md')
  const own = existsSync(claude) ? readFileSync(claude, 'utf8') : existsSync(agents) ? '@AGENTS.md\n' : ''
  if (!own.split(/\r?\n/).includes(IMPORT)) writeFileSync(claude, own ? `${own.replace(/\n*$/, '\n')}\n${IMPORT}\n` : `${IMPORT}\n`)
  const theirs = existsSync(agents) ? readFileSync(agents, 'utf8') : ''
  if (!theirs.includes('.designkit/rules.md')) writeFileSync(agents, theirs ? `${theirs.replace(/\n*$/, '\n')}\n${POINTER}\n` : `${POINTER}\n`)
}

/* Ignore */
export function exclude(target, paths) {
  const file = resolve(target, gitIn(target)('rev-parse', '--git-path', 'info/exclude').out)
  mkdirSync(dirname(file), { recursive: true })
  const have = existsSync(file) ? readFileSync(file, 'utf8').split('\n') : []
  const lines = [...new Set(paths)].filter((p) => !have.includes(p))
  if (lines.length) appendFileSync(file, `${have.length && have.at(-1) !== '' ? '\n' : ''}${lines.join('\n')}\n`)
}

/* Hidden */
export const folders = (target) =>
  new Set(
    ROOTS.flatMap((root) =>
      existsSync(join(target, root))
        ? [root, ...readdirSync(join(target, root), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `${root}/${e.name}`)]
        : [],
    ),
  )
export const hide = (had) => (path) => {
  const [a, b, c] = path.split('/')
  return c !== undefined && !had.has(`${a}/${b}`) ? `/${a}/${b}/` : `/${path}`
}

/* Styles */
export function styleLines(target) {
  const pkg = readJson(join(target, 'package.json'), {})
  const range = { ...pkg.dependencies, ...pkg.devDependencies }.tailwindcss
  if (!range || !/^\D*4/.test(range)) return null
  const installed = readJson(join(target, 'node_modules/tailwindcss/package.json'), {}).version
  if (installed && /^4\.0\./.test(installed)) return null
  const sheets = gitIn(target)('ls-files', '*.css').out.split('\n').filter(Boolean)
  const sheet = sheets.find((f) => /^@import\s+["']tailwindcss["']/m.test(readFileSync(join(target, f), 'utf8')))
  if (!sheet) return null
  const lines = readFileSync(join(target, sheet), 'utf8').split('\n')
  const up = relative(dirname(join(target, sheet)), target) || '.'
  const missing = STYLE_DIRS.map((dir) => `@source not "${up}/${dir}";`).filter((line) => !lines.includes(line))
  if (!missing.length) return null
  const last = lines.findLastIndex((line) => /^@source not /.test(line))
  lines.splice((last >= 0 ? last : lines.findLastIndex((line) => /^@import\s/.test(line))) + 1, 0, ...missing)
  writeFileSync(join(target, sheet), lines.join('\n'))
  return sheet
}
