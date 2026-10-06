#!/usr/bin/env node
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const tmp = mkdtempSync(join(tmpdir(), 'prompting-tests-'))
const proj = join(tmp, 'Acme')
const home = join(tmp, 'home')
mkdirSync(join(proj, '.designkit/scripts'), { recursive: true })
cpSync(join(KIT, '.designkit/scripts/prompts.mjs'), join(proj, '.designkit/scripts/prompts.mjs'))
writeFileSync(join(proj, '.designkit/workspace.json'), JSON.stringify({ name: 'Acme', prompting: true }))
const day = '2026-10-05'
const line = (o) => JSON.stringify({ type: 'user', userType: 'external', cwd: proj, sessionId: 's1', timestamp: `${day}T03:00:00.000Z`, ...o })
mkdirSync(join(home, '.claude/projects/x'), { recursive: true })
writeFileSync(join(home, '.claude/projects/x/s1.jsonl'), [
  line({ message: { role: 'user', content: 'Build the Acme checkout screen: pay button, card form, show the error under the field. Mail tests to a@b.co' } }),
  line({ message: { role: 'user', content: 'no, the error must sit under the field, again' } }),
  line({ isMeta: true, message: { role: 'user', content: 'meta entry' } }),
  line({ message: { role: 'user', content: [{ type: 'tool_result', content: 'x' }] } }),
  line({ message: { role: 'user', content: '[Request interrupted by user]' } }),
  line({ cwd: '/elsewhere', message: { role: 'user', content: 'another project' } }),
  line({ isSidechain: true, message: { role: 'user', content: 'Research brief written by the agent for a helper agent' } }),
].join('\n'))
const run = (...args) => spawnSync(process.execPath, [join(proj, '.designkit/scripts/prompts.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, DESIGNKIT_HOME: home, GALLERY_TOKEN: '' } })

let passed = 0
const failed = []
const check = (name, ok) => (ok ? passed++ : failed.push(name))
const c = JSON.parse(run('--collect', day).stdout)
check('only typed prompts in this project are collected', c.prompts === 2)
check('a correction is counted', c.signals.corrections === 1)
check('the email and project name are masked', !c.items[0].text.includes('a@b.co') && !c.items[0].text.includes('Acme') && c.items[0].text.includes('<email>'))
const masked = spawnSync(process.execPath, [join(proj, '.designkit/scripts/prompts.mjs'), '--mask'], { input: 'key sk_live_ABCDEFGHIJKLMNOPQRSTUV at https://x.io', encoding: 'utf8', env: { ...process.env, DESIGNKIT_HOME: home } }).stdout
check('keys and links are masked', masked.includes('<secret>') && masked.includes('<url>') && !masked.includes('sk_live'))
const report = (o) => {
  const f = join(tmp, 'r.json')
  writeFileSync(f, JSON.stringify({ version: 1, date: day, tool: 'claude-code', prompts: 2, sessions: 1, scores: { overall: 60, goal: 3, context: 3, criteria: 2, scope: 4, references: 3, rounds: 3 }, signals: {}, tips: ['Say how it looks when it works.'], examples: { best: { text: 'Build the <name> checkout screen', why: 'clear' } }, ...o }))
  return run('--send', f)
}
check('a valid report is kept when the gallery is not linked', report({}).status === 0)
check('a report with an unmasked email is refused', report({ tips: ['mail a@b.co'] }).status === 1)
check('a sub-score with one decimal is kept', report({ scores: { overall: 61, goal: 3.5, context: 3, criteria: 2, scope: 4, references: 3, rounds: 3 } }).status === 0)
check('a tip over 200 characters is refused', report({ tips: ['x'.repeat(201)] }).status === 1)
check('a score out of range is refused', report({ scores: { overall: 140, goal: 3, context: 3, criteria: 2, scope: 4, references: 3, rounds: 3 } }).status === 1)
rmSync(tmp, { recursive: true, force: true })
for (const f of failed) console.log(`FAIL ${f}`)
console.log(`${passed} passed, ${failed.length} failed`)
process.exit(failed.length ? 1 : 0)
