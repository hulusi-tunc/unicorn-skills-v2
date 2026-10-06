#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SCRIPT = join(KIT, '.designkit/scripts/secrets.mjs')
const repo = mkdtempSync(join(tmpdir(), 'secrets-tests-'))
const sh = (cmd, args) => spawnSync(cmd, args, { cwd: repo, encoding: 'utf8' })
sh('git', ['init', '-q'])

const fake = (...parts) => parts.join('')
const jwt = (payload) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${'x'.repeat(20)}`
const cases = [
  ['Stripe live key', 'pay.ts', `const k = '${fake('sk_', 'live_', 'F'.repeat(24))}'\n`, true],
  ['Stripe test key', 'pay.ts', `const k = '${fake('sk_', 'test_', 'F'.repeat(24))}'\n`, false],
  ['Supabase service_role key', 'db.ts', `const k = '${jwt({ role: 'service_role' })}'\n`, true],
  ['Supabase anon key', 'db.ts', `const k = '${jwt({ role: 'anon' })}'\n`, false],
  ['secret behind a public prefix', 'env.ts', `process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY\n`, true],
  ['public URL behind a public prefix', 'env.ts', `process.env.NEXT_PUBLIC_SUPABASE_URL\n`, false],
  ['private key', 'key.pem', `${fake('-----BEGIN ', 'PRIVATE KEY-----')}\nabc\n`, true],
  ['.env file', '.env', `A=1\n`, true],
  ['.env.example', '.env.example', `A=\n`, false],
  ['Claude settings file', '.claude/settings.local.json', `{}\n`, true],
  ['chat dump', 'notes/chat.jsonl', `{}\n`, true],
  ['6 MB video', 'hero.mp4', Buffer.alloc(6_000_000, 1), true],
  ['plain code', 'app.ts', `export const a = 1\n`, false],
]

let passed = 0
const failed = []
for (const [name, file, content, blocked] of cases) {
  mkdirSync(dirname(join(repo, file)), { recursive: true })
  writeFileSync(join(repo, file), content)
  sh('git', ['add', '-f', '--', file])
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: repo, encoding: 'utf8' })
  const ok = blocked ? r.status === 1 : r.status === 0
  ok ? passed++ : failed.push(`${name}: expected ${blocked ? 'blocked' : 'allowed'}, exit ${r.status}${r.stderr ? `, ${r.stderr.trim().slice(0, 120)}` : ''}`)
  sh('git', ['rm', '-q', '--cached', '-f', '--', file])
  rmSync(join(repo, file), { force: true })
}
rmSync(repo, { recursive: true, force: true })
for (const f of failed) console.log(`FAIL ${f}`)
console.log(`${passed} passed, ${failed.length} failed`)
process.exit(failed.length ? 1 : 0)
