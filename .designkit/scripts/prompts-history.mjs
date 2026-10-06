#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { NOT_TYPED, mask, signals, textOf, typed, validate } from './prompts.mjs'

const HOME = process.env.DESIGNKIT_HOME ?? homedir()
const STORE = process.env.DESIGNKIT_PROMPTING_STORE ?? join(HOME, '.designkit/prompting/history')
const MAX_PER_DAY = 200
const arg = (name, fallback = null) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback)
const day = (ts) => (ts ? new Date(ts).toLocaleDateString('en-CA') : null)

export function projectOf(cwd) {
  if (!cwd) return null
  const rest = cwd.startsWith(HOME) ? cwd.slice(HOME.length + 1) : null
  if (rest === null || rest.startsWith('.') || rest.startsWith('Library')) return null
  const parts = rest.split('/')
  const folder = ['Projects', 'Work', 'Documents'].includes(parts[0]) ? parts[1] : parts[0] || 'home'
  if (!folder) return 'home'
  return folder
    .replace(/-worktree-session-.*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'home'
}

export async function history() {
  const out = new Map()
  const root = join(HOME, '.claude/projects')
  if (!existsSync(root)) return out
  for (const dir of readdirSync(root)) {
    const d = join(root, dir)
    let files = []
    try {
      files = readdirSync(d).filter((f) => f.endsWith('.jsonl'))
    } catch {
      continue
    }
    for (const f of files) {
      for await (const line of createInterface({ input: createReadStream(join(d, f)), crlfDelay: Infinity })) {
        if (!line.includes('"type":"user"')) continue
        let e
        try {
          e = JSON.parse(line)
        } catch {
          continue
        }
        if (!typed(e)) continue
        const t = textOf(e.message?.content)
        if (!t || !t.text.trim() || NOT_TYPED.test(t.text.trim())) continue
        const project = projectOf(e.cwd)
        const date = day(e.timestamp)
        if (!project || !date) continue
        const key = `${project}|${date}`
        if (!out.has(key)) out.set(key, [])
        out.get(key).push({ tool: 'claude-code', session: e.sessionId, at: e.timestamp, text: t.text, images: t.images + (t.text.match(/\[Image[: #]/g) ?? []).length })
      }
    }
  }
  for (const list of out.values()) list.sort((a, b) => String(a.at).localeCompare(String(b.at)))
  return out
}

const sample = (list) => (list.length <= MAX_PER_DAY ? list : Array.from({ length: MAX_PER_DAY }, (_, i) => list[Math.floor((i * list.length) / MAX_PER_DAY)]))
const rubric = (project, date, prompts) => `You score one designer's prompts to an AI coding agent for one day, as coaching. Reply with one JSON object and nothing else.

Score every prompt 0 to 5 on six lines, then average each line over the day, keeping one decimal:
- goal: says what done looks like, not only what to do.
- context: names the screen, file, user or data it is about; points to what exists.
- criteria: says how to tell it worked (a state to see, a size, a behaviour, a check to pass).
- scope: one change a review can judge; not five unrelated asks in one message.
- references: gives a link, screenshot, file or example when the result is visual or exact.
- rounds: few corrections after it ("no", "again", "still broken"); a reply that fixes the cause scores higher than one that only says it is wrong.
A short reply to a question the agent asked ("yes", "go", "the second one", "push it") is not scored. Typos and mixed languages are never penalised.
overall = the sum of the six averages divided by 30, times 100, as a whole number.

Then at most three tips, each one sentence under 200 characters, each naming the habit and showing a better prompt in a few words. About the prompting, never about the person. No em dashes.
Then the day's best and worst scored prompt, quoted from the list exactly (they are already masked), each cut to 280 characters, each with a one-line why.

JSON shape:
{"scores":{"overall":0,"goal":0,"context":0,"criteria":0,"scope":0,"references":0,"rounds":0},"tips":["..."],"examples":{"best":{"text":"...","why":"..."},"worst":{"text":"...","why":"..."}}}

Project: ${project}. Day: ${date}. ${prompts.length} prompts, in order:
${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`

function score(project, date, prompts, model) {
  const r = spawnSync('claude', ['-p', '--model', model, '--output-format', 'text', '--allowedTools', ''], { input: rubric(project, date, prompts), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 600000 })
  if (r.status !== 0) throw new Error(`scoring failed: ${(r.stderr || r.stdout).trim().slice(0, 200)}`)
  const m = r.stdout.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('scoring returned no JSON')
  return JSON.parse(m[0])
}

async function run() {
  const model = arg('--model', 'sonnet')
  const only = arg('--project')
  const limit = Number(arg('--limit', 1e9))
  const dryRun = process.argv.includes('--dry-run')
  const all = await history()
  let done = 0
  let skipped = 0
  const failed = []
  for (const [key, list] of [...all].sort()) {
    const [project, date] = key.split('|')
    if (only && project !== only) continue
    const file = join(STORE, project, `${date}.json`)
    if (existsSync(file)) {
      skipped++
      continue
    }
    if (done >= limit) break
    const names = [project.replace(/-/g, ' '), project]
    const prompts = sample(list).map((p) => mask(p.text, names).replace(/\s+/g, ' ').slice(0, 600))
    if (dryRun) {
      console.log(`${project} ${date}: ${list.length} prompts`)
      done++
      continue
    }
    try {
      const s = score(project, date, prompts, model)
      const report = {
        version: 1,
        project,
        date,
        tool: 'claude-code',
        prompts: list.length,
        sessions: new Set(list.map((p) => p.session)).size,
        scores: s.scores,
        signals: signals(list),
        tips: (s.tips ?? []).slice(0, 3).map((t) => mask(t, names).slice(0, 200)),
        examples: Object.fromEntries(Object.entries(s.examples ?? {}).map(([k, e]) => [k, { text: mask(e.text ?? '', names).slice(0, 280), why: String(e.why ?? '').slice(0, 280) }])),
      }
      const issues = validate(report)
      if (issues.length) throw new Error(issues.join('; '))
      mkdirSync(join(STORE, project), { recursive: true })
      writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`)
      done++
      console.log(`${project} ${date}: ${list.length} prompts, ${report.scores.overall}`)
    } catch (e) {
      failed.push(`${project} ${date}: ${e.message}`)
      console.error(`${project} ${date}: ${e.message}`)
    }
  }
  console.log(`history: ${done} days scored${dryRun ? ' (dry run)' : ''}, ${skipped} already done, ${failed.length} failed`)
  return failed.length ? 1 : 0
}

async function send() {
  const host = arg('--gallery', 'unicorn-studio-gallery.vercel.app')
  const token =
    process.env.GALLERY_TOKEN ||
    spawnSync('security', ['find-generic-password', '-s', 'unicorn-gallery', '-a', `https://${host}`, '-w'], { encoding: 'utf8' }).stdout.trim()
  if (!token) throw new Error('not signed in to the gallery: run the gallery tool login once')
  let sent = 0
  const failed = []
  for (const project of existsSync(STORE) ? readdirSync(STORE) : []) {
    for (const f of readdirSync(join(STORE, project)).filter((x) => x.endsWith('.json'))) {
      const file = join(STORE, project, f)
      if (existsSync(file.replace(/\.json$/, '.sent'))) continue
      const res = await fetch(`https://${host}/api/v2/prompt-reports`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: readFileSync(file, 'utf8') })
      if (res.ok) {
        writeFileSync(file.replace(/\.json$/, '.sent'), new Date().toISOString())
        sent++
      } else failed.push(`${project}/${basename(f)}: ${res.status} ${(await res.text()).slice(0, 160)}`)
    }
  }
  console.log(`history: ${sent} reports sent, ${failed.length} not sent`)
  for (const f of failed.slice(0, 10)) console.log(`  ${f}`)
  return failed.length ? 1 : 0
}

const cmd = process.argv[2]
if (cmd === '--list') {
  const byProject = new Map()
  for (const [key, list] of await history()) {
    const p = key.split('|')[0]
    const v = byProject.get(p) ?? { days: 0, prompts: 0 }
    byProject.set(p, { days: v.days + 1, prompts: v.prompts + list.length })
  }
  for (const [p, v] of [...byProject].sort((a, b) => b[1].prompts - a[1].prompts)) console.log(`${String(v.prompts).padStart(6)} prompts ${String(v.days).padStart(3)} days  ${p}`)
} else if (cmd === '--run') process.exitCode = await run()
else if (cmd === '--send') process.exitCode = await send()
else if (cmd) {
  console.error('use --list, --run [--project p] [--limit n] [--model m] [--dry-run], or --send')
  process.exitCode = 1
}
