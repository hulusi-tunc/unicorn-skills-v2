#!/usr/bin/env node
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SELF = fileURLToPath(import.meta.url)
const LINKS = '.claude/skills'
const SKILLS = '.agents/skills'
const AGENTS = '.designkit/agents'
const HOOK = '.designkit/scripts/hook.mjs'
const PLUGIN = '.designkit/plugins/opencode.js'
const WORKFLOWS = ['setup', 'tokenize', 'design-screen', 'commit', 'check', 'slop-check', 'sync']
export const SHARED = ['.codex/hooks.json', '.codex/config.toml', '.cursor/hooks.json', '.cursor/mcp.json', '.gemini/settings.json', 'opencode.json']

const parse = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
const json = (value) => `${JSON.stringify(value, null, 2)}\n`
const quote = (value) => JSON.stringify(value)
const pick = (from, keys) => Object.fromEntries(keys.filter((k) => from[k] !== undefined).map((k) => [k, from[k]]))

/* Skills */
export function linkSkills(root, write = true) {
  const from = join(root, SKILLS)
  const to = join(root, LINKS)
  const changed = []
  if (!existsSync(from)) return changed
  if (write) mkdirSync(to, { recursive: true })
  for (const name of readdirSync(from).sort()) {
    if (!existsSync(join(from, name, 'SKILL.md'))) continue
    const link = join(to, name)
    const want = `../../${SKILLS}/${name}`
    const now = lstatSync(link, { throwIfNoEntry: false })
    if (now && !now.isSymbolicLink()) continue
    if (now && readlinkSync(link) === want) continue
    changed.push(`${LINKS}/${name}`)
    if (!write) continue
    if (now) unlinkSync(link)
    symlinkSync(want, link)
  }
  for (const name of existsSync(to) ? readdirSync(to) : []) {
    const link = join(to, name)
    if (!lstatSync(link).isSymbolicLink() || !readlinkSync(link).startsWith(`../../${SKILLS}/`) || existsSync(link)) continue
    changed.push(`${LINKS}/${name}`)
    if (write) unlinkSync(link)
  }
  return changed
}

/* Sources */
function source(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return null
  const meta = {}
  let list = null
  for (const line of m[1].split('\n')) {
    const item = line.match(/^\s+-\s+(.+)$/)
    const pair = line.match(/^([A-Za-z-]+):\s*(.*)$/)
    if (item && list) meta[list].push(item[1].trim())
    else if (pair) {
      list = pair[2] === '' ? pair[1] : null
      meta[pair[1]] = pair[2] === '' ? [] : pair[2]
    }
  }
  return { meta, body: m[2].replace(/^\n+/, '') }
}

const servers = (root) => Object.entries(parse(existsSync(join(root, '.mcp.json')) ? readFileSync(join(root, '.mcp.json'), 'utf8') : '{}')?.mcpServers ?? {})
const remote = (server) => typeof server.url === 'string'

/* Hooks */
const tail = (event, tool) => `[ -f "$f" ] && command -v node >/dev/null 2>&1 || exit 0; node "$f" ${event} --tool ${tool}`
const RUN = {
  codex: (event) => `d=$(git config --get designkit.docs 2>/dev/null); f="$(git rev-parse --show-toplevel 2>/dev/null)/\${d:+$d/}${HOOK}"; ${tail(event, 'codex')}`,
  cursor: (event) => `f=${HOOK}; ${tail(event, 'cursor')}`,
  copilot: (event) => `f=${HOOK}; ${tail(event, 'copilot')}`,
  gemini: (event) => `f=$GEMINI_PROJECT_DIR/${HOOK}; ${tail(event, 'gemini')}`,
}
const ours = (command) => typeof command === 'string' && command.includes(HOOK)
const grouped = (tool, event, timeout, extra = {}) => ({ ...extra, hooks: [{ ...(tool === 'gemini' ? { name: `design-kit-${event}` } : {}), type: 'command', command: RUN[tool](event), timeout }] })
const CODEX = {
  SessionStart: [grouped('codex', 'session-start', 90)],
  PreToolUse: [grouped('codex', 'before-command', 10, { matcher: '^(Bash|mcp__.*[Ff]igma.*)$' })],
  PostToolUse: [grouped('codex', 'after-edit', 30, { matcher: 'apply_patch' })],
}
const GEMINI = {
  SessionStart: [grouped('gemini', 'session-start', 90000)],
  BeforeTool: [grouped('gemini', 'before-command', 10000, { matcher: '^(run_shell_command|mcp_figma_.*)$' })],
  AfterTool: [grouped('gemini', 'after-edit', 30000, { matcher: '^(write_file|replace)$' })],
}
const CURSOR = {
  sessionStart: [{ command: RUN.cursor('session-start'), timeout: 90 }],
  beforeShellExecution: [{ command: RUN.cursor('before-command'), timeout: 10 }],
  beforeMCPExecution: [{ command: RUN.cursor('before-command'), timeout: 10 }],
  postToolUse: [{ command: RUN.cursor('after-edit'), matcher: 'Write', timeout: 30 }],
}
const COPILOT = {
  version: 1,
  hooks: {
    sessionStart: [{ type: 'command', command: RUN.copilot('session-start'), timeoutSec: 90 }],
    preToolUse: [{ type: 'command', matcher: 'bash|powershell|.*figma.*', command: RUN.copilot('before-command'), timeoutSec: 10 }],
    postToolUse: [{ type: 'command', matcher: 'edit|create|str_replace_editor|apply_patch', command: RUN.copilot('after-edit'), timeoutSec: 30 }],
  },
}

function withGroups(base, groups) {
  const hooks = {}
  for (const [event, list] of Object.entries(base.hooks ?? {})) {
    const left = (Array.isArray(list) ? list : []).map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !ours(h.command)) })).filter((g) => g.hooks.length)
    if (left.length) hooks[event] = left
  }
  for (const [event, list] of Object.entries(groups)) hooks[event] = [...(hooks[event] ?? []), ...list]
  return { ...base, hooks }
}

function withEntries(base, entries) {
  const hooks = {}
  for (const [event, list] of Object.entries(base.hooks ?? {})) {
    const left = (Array.isArray(list) ? list : []).filter((h) => !ours(h.command))
    if (left.length) hooks[event] = left
  }
  for (const [event, list] of Object.entries(entries)) hooks[event] = [...(hooks[event] ?? []), ...list]
  return { version: 1, ...base, hooks }
}

/* Tool files */
function codexToml(now, list) {
  const tables = list.map(([name, server]) => {
    const header = `[mcp_servers.${/^[A-Za-z0-9_-]+$/.test(name) ? name : quote(name)}]`
    const env = Object.entries(server.env ?? {})
    const lines = remote(server)
      ? [`url = ${quote(server.url)}`]
      : [`command = ${quote(server.command)}`, ...(server.args?.length ? [`args = [${server.args.map(quote).join(', ')}]`] : []), ...(env.length ? [`env = { ${env.map(([k, v]) => `${k} = ${quote(v)}`).join(', ')} }`] : [])]
    return { header, text: `${header}\n${lines.join('\n')}\n` }
  })
  const fresh = tables.map((t) => t.text).join('\n')
  if (now === null) return fresh
  const lines = now.split('\n')
  const headers = lines.filter((line) => /^\s*\[/.test(line)).map((line) => line.trim())
  const before = lines.slice(0, Math.max(0, lines.findIndex((line) => /^\s*\[/.test(line)))).join('').trim()
  if (headers.length && !before && headers.every((h) => tables.some((t) => t.header === h))) return fresh
  const missing = tables.filter((t) => !headers.includes(t.header))
  return missing.length ? `${now.replace(/\n*$/, '\n')}\n${missing.map((t) => t.text).join('\n')}` : now
}

const front = (pairs) => `---\n${pairs.filter(Boolean).join('\n')}\n---\n\n`
const literal = (text) => (text.includes("'''") ? `"""\n${text.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')}"""` : `'''\n${text}'''`)

function reviewers(root, owned) {
  const dir = join(root, AGENTS)
  for (const file of existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : []) {
    const parsed = source(readFileSync(join(dir, file), 'utf8'))
    if (!parsed) continue
    const { meta, body } = parsed
    const name = typeof meta.name === 'string' ? meta.name : file.slice(0, -3)
    const skills = Array.isArray(meta.skills) ? meta.skills : []
    const brief = `${skills.length ? `Before starting, read ${skills.map((s) => `\`${SKILLS}/${s}/SKILL.md\``).join(', ')}.\n\n` : ''}${body}`
    const head = [`name: ${name}`, `description: ${meta.description}`]
    owned(`.claude/agents/${name}.md`, front([...head, `tools: Bash, Read, Glob, Grep, Write${meta.edits === 'true' ? ', Edit' : ''}`, `model: ${meta.model === 'strong' ? 'opus' : 'sonnet'}`, skills.length && `skills:\n${skills.map((s) => `  - ${s}`).join('\n')}`]) + body)
    owned(`.cursor/agents/${name}.md`, front([...head, 'model: inherit']) + brief)
    owned(`.gemini/agents/${name}.md`, front([...head, 'kind: local']) + brief)
    owned(`.github/agents/${name}.agent.md`, front(head) + brief)
    owned(`.opencode/agents/${name}.md`, front([`description: ${meta.description}`, 'mode: subagent']) + brief)
    owned(`.codex/agents/${name}.toml`, `name = ${quote(name)}\ndescription = ${quote(meta.description)}\ndeveloper_instructions = ${literal(brief)}\n`)
  }
}

function commands(root, owned) {
  for (const name of WORKFLOWS) {
    const file = join(root, SKILLS, name, 'SKILL.md')
    if (!existsSync(file)) continue
    const description = source(readFileSync(file, 'utf8'))?.meta.description
    owned(`.gemini/commands/${name}.toml`, `description = ${quote(typeof description === 'string' ? description : name)}\nprompt = """\nCarry out the workflow in ${SKILLS}/${name}/SKILL.md: activate the skill named ${name} if it is listed, otherwise read that file and follow it.\nWhat the designer said with it: {{args}}\n"""\n`)
  }
}

/* All */
export function sync(root, { write = true, owns = () => true, merge = true } = {}) {
  const result = { added: linkSkills(root, write), updated: [], kept: [] }
  const put = (rel, next, mine) => {
    const abs = join(root, rel)
    const now = existsSync(abs) ? readFileSync(abs, 'utf8') : null
    if (now === next) return
    if (now !== null && !mine && !owns(abs)) return result.kept.push(rel)
    ;(now === null ? result.added : result.updated).push(rel)
    if (!write) return
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, next)
  }
  const owned = (rel, text) => put(rel, text, false)
  const shared = (rel, build) => {
    const abs = join(root, rel)
    const now = existsSync(abs) ? readFileSync(abs, 'utf8') : null
    if (now !== null && !merge) return result.kept.push(rel)
    const next = build(now)
    if (next === null) return result.kept.push(rel)
    put(rel, next, true)
  }
  const data = (build) => (now) => {
    const base = now === null ? {} : parse(now)
    return base && typeof base === 'object' && !Array.isArray(base) ? json(build(base)) : null
  }
  const list = servers(root)

  reviewers(root, owned)
  commands(root, owned)
  if (existsSync(join(root, PLUGIN))) owned('.opencode/plugins/designkit.js', readFileSync(join(root, PLUGIN), 'utf8'))
  owned('.github/hooks/designkit.json', json(COPILOT))
  shared('.codex/hooks.json', data((base) => withGroups(base, CODEX)))
  shared('.cursor/hooks.json', data((base) => withEntries(base, CURSOR)))
  shared(
    '.gemini/settings.json',
    data((base) => {
      const names = [base.context?.fileName ?? 'GEMINI.md'].flat()
      const next = withGroups({ ...base, context: { ...base.context, fileName: names.includes('AGENTS.md') ? names : ['AGENTS.md', ...names] } }, GEMINI)
      return list.length ? { ...next, mcpServers: { ...next.mcpServers, ...Object.fromEntries(list.map(([n, s]) => [n, remote(s) ? { ...pick(s, ['url', 'headers']), type: 'http' } : pick(s, ['command', 'args', 'env'])])) } } : next
    }),
  )
  if (list.length) {
    shared('.codex/config.toml', (now) => codexToml(now, list))
    shared(
      '.cursor/mcp.json',
      data((base) => ({ ...base, mcpServers: { ...base.mcpServers, ...Object.fromEntries(list.map(([n, s]) => [n, remote(s) ? pick(s, ['url', 'headers']) : pick(s, ['command', 'args', 'env'])])) } })),
    )
    shared(
      'opencode.json',
      data((base) => ({
        ...(base.$schema ? {} : { $schema: 'https://opencode.ai/config.json' }),
        ...base,
        mcp: { ...base.mcp, ...Object.fromEntries(list.map(([n, s]) => [n, remote(s) ? { type: 'remote', ...pick(s, ['url', 'headers']), enabled: true } : { type: 'local', command: [s.command, ...(s.args ?? [])], ...(s.env ? { environment: s.env } : {}), enabled: true }])) },
      })),
    )
  }
  return result
}

/* CLI */
if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const root = resolve(args.find((a) => !a.startsWith('--')) ?? resolve(dirname(SELF), '../..'))
  const { added, updated, kept } = sync(root, { write: !check })
  const changed = [...added, ...updated]
  if (changed.length) console.log(`${check ? 'out of date' : 'written'}:\n${changed.map((p) => `  ${p}`).join('\n')}`)
  else console.log('adapters: everything is current')
  if (kept.length) console.log(`kept as they are:\n${kept.map((p) => `  ${p}`).join('\n')}`)
  process.exit(check && changed.length ? 1 : 0)
}
