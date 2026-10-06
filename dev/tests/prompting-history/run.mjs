#!/usr/bin/env node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const home = mkdtempSync(join(tmpdir(), 'history-tests-'))
mkdirSync(join(home, '.claude/projects/a'), { recursive: true })
const line = (cwd, at, text, o = {}) => JSON.stringify({ type: 'user', cwd: join(home, cwd), timestamp: at, sessionId: 's', message: { role: 'user', content: text }, ...o })
writeFileSync(join(home, '.claude/projects/a/s.jsonl'), [
  line('Projects/Acme App', '2026-09-10T03:00:00Z', 'build the checkout'),
  line('Projects/Acme App', '2026-09-10T04:00:00Z', 'no, again'),
  line('Projects/Acme App-worktree-session-bold-owl', '2026-09-11T03:00:00Z', 'fix the list'),
  line('Projects/Other', '2026-09-10T03:00:00Z', 'hello'),
  line('Projects/Acme App', '2026-09-10T05:00:00Z', 'automated', { entrypoint: 'sdk-cli' }),
  line('Projects/Acme App', '2026-09-10T05:00:00Z', 'helper', { isSidechain: true }),
  line('.brain-chat', '2026-09-10T05:00:00Z', 'brain app'),
].join('\n'))
const r = spawnSync(process.execPath, [join(KIT, '.designkit/scripts/prompts-history.mjs'), '--list'], { encoding: 'utf8', env: { ...process.env, DESIGNKIT_HOME: home } })
const rows = Object.fromEntries(r.stdout.trim().split('\n').map((l) => { const m = l.trim().match(/^(\d+) prompts\s+(\d+) days\s+(\S+)$/); return m ? [m[3], { prompts: +m[1], days: +m[2] }] : [l, null] }))
let passed = 0
const failed = []
const check = (name, ok) => (ok ? passed++ : failed.push(name))
check('typed prompts are grouped by project folder', rows['acme-app']?.prompts === 3)
check('worktrees count as their project', rows['acme-app']?.days === 2)
check('another project stays separate', rows.other?.prompts === 1)
check('automated runs, helper agents and hidden folders are left out', !Object.keys(rows).some((k) => k.includes('brain')) && rows['acme-app']?.prompts === 3)
rmSync(home, { recursive: true, force: true })
for (const f of failed) console.log(`FAIL ${f}`)
console.log(`${passed} passed, ${failed.length} failed`)
process.exit(failed.length ? 1 : 0)
