#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const STATE = join(ROOT, '.designkit/state/prompting')
const readJson = (p, fallback) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return fallback
  }
}
const workspace = readJson(join(ROOT, '.designkit/workspace.json'), {})
const APP = workspace.app ? resolve(ROOT, workspace.app) : null
const HOME = process.env.DESIGNKIT_HOME ?? homedir()
const today = () => new Date().toISOString().slice(0, 10)
const dayBefore = (d) => new Date(Date.parse(`${d}T12:00:00Z`) - 86400000).toISOString().slice(0, 10)

/* Masking: nothing that names a client, a person or a secret leaves the laptop */
const SECRET = /\b(?:sk|rk|pk)_(?:live|test)_[0-9A-Za-z]{8,}|\bgh[pousr]_[0-9A-Za-z]{20,}|\bgithub_pat_\w{20,}|\bglpat-[\w-]{16,}|\bAKIA[0-9A-Z]{16}\b|\bxox[abpr]-[\w-]{10,}|eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}|\b[0-9a-f]{32,}\b|\b[A-Za-z0-9+/_-]{40,}={0,2}/g
export function mask(text, names = []) {
  let t = String(text)
    .replace(SECRET, '<secret>')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\+?\d[\d\s-]{8,}\d/g, '<number>')
    .replace(new RegExp(`${HOME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\S*`, 'g'), '<path>')
  for (const n of names.filter((x) => x && x.length > 2)) t = t.replace(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '<name>')
  return t
}
const maskNames = () => [workspace.name, ...(workspace.maskNames ?? [])]

/* Reading the day's prompts from each tool's own transcripts */
const real = (p) => {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}
const ROOTS = [ROOT, APP].filter(Boolean).flatMap((p) => [p, real(p)])
const seen = new Map()
const inProject = (cwd) => {
  if (!cwd) return false
  if (!seen.has(cwd)) seen.set(cwd, ROOTS.some((r) => cwd.startsWith(r) || real(cwd).startsWith(r)))
  return seen.get(cwd)
}
const recent = (dir, day) => {
  const out = []
  const since = Date.parse(`${day}T00:00:00`) - 86400000
  const walk = (d, depth) => {
    if (!existsSync(d) || depth > 5) return
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      const s = statSync(p)
      if (s.isDirectory()) walk(p, depth + 1)
      else if (n.endsWith('.jsonl') && s.mtimeMs >= since) out.push(p)
    }
  }
  walk(dir, 0)
  return out
}
const onDay = (ts, day) => !!ts && new Date(ts).toLocaleDateString('en-CA') === day
function textOf(content) {
  if (typeof content === 'string') return { text: content, images: 0 }
  if (!Array.isArray(content) || content.some((b) => b?.type === 'tool_result')) return null
  const text = content.filter((b) => b?.type === 'text').map((b) => b.text).join('\n')
  return { text, images: content.filter((b) => b?.type === 'image').length }
}
const NOT_TYPED = /^(?:<(?:command|local-command|system|task-notification|cross-session|bash-|user-memory)|\[Request interrupted|This session is being continued|Caveat: )/
export function collect(day) {
  const prompts = []
  for (const f of recent(join(HOME, '.claude/projects'), day)) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      let d
      try {
        d = JSON.parse(line)
      } catch {
        continue
      }
      if (d.type !== 'user' || d.isMeta || !inProject(d.cwd) || !onDay(d.timestamp, day)) continue
      const t = textOf(d.message?.content)
      if (!t || !t.text.trim() || NOT_TYPED.test(t.text.trim())) continue
      prompts.push({ tool: 'claude-code', session: d.sessionId, at: d.timestamp, text: t.text, images: t.images + (t.text.match(/\[Image[: #]/g) ?? []).length })
    }
  }
  for (const f of recent(join(HOME, '.codex/sessions'), day)) {
    let cwd = null
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      let d
      try {
        d = JSON.parse(line)
      } catch {
        continue
      }
      if (d.type === 'session_meta') cwd = d.payload?.cwd
      if (d.type === 'event_msg' && d.payload?.type === 'user_message' && inProject(cwd) && onDay(d.timestamp, day))
        prompts.push({ tool: 'codex', session: f, at: d.timestamp, text: String(d.payload.message ?? ''), images: (d.payload.images ?? []).length })
    }
  }
  return prompts.sort((a, b) => String(a.at).localeCompare(String(b.at)))
}

const CORRECTION = /^(?:no\b|nope|not\s|wrong|again|still\b|why (?:did|is|are)\b|undo|revert|that'?s not|it'?s not|doesn'?t work|didn'?t work|broken|you (?:removed|changed|broke)|i (?:said|told you|asked))/i
export function signals(prompts) {
  const words = prompts.map((p) => p.text.trim().split(/\s+/).length)
  const corrections = prompts.filter((p) => CORRECTION.test(p.text.trim())).length
  let acceptedFirstTry = 0
  prompts.forEach((p, i) => {
    const next = prompts.slice(i + 1).find((q) => q.session === p.session)
    if (!CORRECTION.test(p.text.trim()) && (!next || !CORRECTION.test(next.text.trim()))) acceptedFirstTry++
  })
  return {
    avgWords: words.length ? Math.round(words.reduce((a, b) => a + b, 0) / words.length) : 0,
    withFiles: prompts.filter((p) => /(?:@[\w./-]+|\b[\w-]+\/[\w./-]+\.\w{1,5}\b|\b\w+\.(?:tsx?|jsx?|md|css|json|swift|dart|png|jpe?g|pdf)\b)/.test(p.text)).length,
    withImages: prompts.filter((p) => p.images > 0).length,
    corrections,
    acceptedFirstTry,
  }
}

/* Sending */
const TOOLS = new Set(['claude-code', 'codex', 'cursor', 'gemini', 'other'])
export function validate(r) {
  const issues = []
  const n05 = (v) => Number.isInteger(v) && v >= 0 && v <= 5
  if (r.version !== 1) issues.push('version must be 1')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '')) issues.push('date must be YYYY-MM-DD')
  if (!TOOLS.has(r.tool)) issues.push(`tool must be one of ${[...TOOLS].join(', ')}`)
  const s = r.scores ?? {}
  if (!(Number.isInteger(s.overall) && s.overall >= 0 && s.overall <= 100)) issues.push('scores.overall must be 0 to 100')
  for (const k of ['goal', 'context', 'criteria', 'scope', 'references', 'rounds']) if (!n05(s[k])) issues.push(`scores.${k} must be 0 to 5`)
  if (!Array.isArray(r.tips) || r.tips.length > 3) issues.push('tips must be at most 3')
  for (const k of ['best', 'worst']) {
    const e = r.examples?.[k]
    if (e && (typeof e.text !== 'string' || e.text.length > 280)) issues.push(`examples.${k}.text must be at most 280 characters`)
  }
  const visible = JSON.stringify([r.tips, r.examples])
  if (/[\w.+-]+@[\w-]+\.\w|https?:\/\//.test(visible) || mask(visible, maskNames()) !== visible) issues.push('tips or examples still hold something unmasked: run them through --mask first')
  return issues
}
function token(host) {
  if (process.env.GALLERY_TOKEN) return process.env.GALLERY_TOKEN
  const r = spawnSync('security', ['find-generic-password', '-s', 'unicorn-gallery', '-a', `https://${host}`, '-w'], { encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : null
}
async function send(file) {
  const report = readJson(file, null)
  if (!report) throw new Error(`could not read ${file}`)
  const gallery = readJson(join(APP ?? ROOT, '.gallery.json'), {})
  report.project = report.project ?? gallery.project
  const issues = validate(report)
  if (issues.length) throw new Error(`report not sent:\n  - ${issues.join('\n  - ')}`)
  mkdirSync(STATE, { recursive: true })
  writeFileSync(join(STATE, `${report.date}.${report.tool}.json`), `${JSON.stringify(report, null, 2)}\n`)
  const host = workspace.gallery ?? 'unicorn-studio-gallery.vercel.app'
  const t = token(host)
  if (!t || !report.project) {
    console.log(`prompting: report for ${report.date} kept on this Mac; it goes to the gallery once the project is linked and you are signed in (/capture step 1).`)
    return
  }
  const res = await fetch(`https://${host}/api/v2/prompt-reports`, { method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: JSON.stringify(report) }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }))
  if (!res.ok) {
    console.log(`prompting: report for ${report.date} kept on this Mac; the gallery did not take it yet (${res.status}). It is sent again next time.`)
    return
  }
  writeFileSync(join(STATE, `${report.date}.${report.tool}.sent`), new Date().toISOString())
  console.log(`prompting: report for ${report.date} sent.`)
}

function due() {
  if (workspace.prompting !== true) return
  const last = existsSync(STATE) ? readdirSync(STATE).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, 10)).sort().pop() : null
  const day = dayBefore(today())
  if (last && last >= day) return
  if (!collect(day).length) return
  console.log(`Prompting: the report for ${day} is due. Run /prompting before the first task, in under a minute.`)
}

const [cmd, arg] = process.argv.slice(2)
const isMain = !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
if (isMain) {
  try {
    if (cmd === '--due') due()
    else if (cmd === '--collect') {
      const day = arg ?? dayBefore(today())
      const prompts = collect(day)
      const names = maskNames()
      console.log(JSON.stringify({ date: day, prompts: prompts.length, sessions: new Set(prompts.map((p) => p.session)).size, tools: [...new Set(prompts.map((p) => p.tool))], signals: signals(prompts), items: prompts.map((p) => ({ tool: p.tool, session: String(p.session).slice(-8), text: mask(p.text, names).slice(0, 1200), images: p.images })) }, null, 2))
    } else if (cmd === '--mask') console.log(mask(readFileSync(0, 'utf8'), maskNames()))
    else if (cmd === '--send') await send(arg)
    else throw new Error('use --due, --collect [YYYY-MM-DD], --mask (stdin) or --send <report.json>')
  } catch (e) {
    console.error(`prompting: ${e.message}`)
    process.exit(1)
  }
}
