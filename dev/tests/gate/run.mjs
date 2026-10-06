#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const KIT = resolve(HERE, '../../..')
const withoutTypescript = process.argv.includes('--without-typescript')

const tmp = mkdtempSync(join(tmpdir(), 'gate-tests-'))
const docs = join(tmp, 'docs')
const app = join(tmp, 'app')
mkdirSync(join(docs, '.designkit/scripts'), { recursive: true })
mkdirSync(join(docs, '.agents/skills'), { recursive: true })
for (const f of ['slop-gate.mjs', 'slop-rules.mjs', 'kit-paths.mjs', 'package.json', 'package-lock.json']) cpSync(join(KIT, '.designkit/scripts', f), join(docs, '.designkit/scripts', f))
cpSync(join(KIT, '.designkit/slop-policy.json'), join(docs, '.designkit/slop-policy.json'))
symlinkSync(join(KIT, '.agents/skills/kill-ai-slop'), join(docs, '.agents/skills/kill-ai-slop'))
writeFileSync(join(docs, '.designkit/workspace.json'), JSON.stringify({ name: 'GateTests', app: '../app' }))
cpSync(join(HERE, 'probes'), app, { recursive: true })
writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'gate-tests', private: true }))

let mode = 'without TypeScript (the simpler fallback checks)'
if (!withoutTypescript) {
  const install = spawnSync('npm', ['ci', '--no-audit', '--no-fund', '--silent'], { cwd: join(docs, '.designkit/scripts'), encoding: 'utf8' })
  if (install.status === 0) mode = 'with the pinned TypeScript parser (the precise checks real projects get)'
  else console.log('Could not install the pinned TypeScript parser (offline?); running the fallback checks only.\n')
}

const expect = JSON.parse(readFileSync(join(HERE, 'expect.json'), 'utf8'))
const failures = []
for (const [label, want] of Object.entries(expect)) {
  const r = spawnSync(process.execPath, [join(docs, '.designkit/scripts/slop-gate.mjs'), join(app, label), '--json', '--no-fail'], { cwd: docs, encoding: 'utf8' })
  let got
  try {
    got = JSON.parse(r.stdout).hits.filter((h) => h.level === 'block' && String(h.id).startsWith('dk-')).map((h) => `${h.id}@${h.line}`)
  } catch {
    got = [`error: ${(r.stderr || r.stdout).trim().slice(0, 120)}`]
  }
  const a = [...new Set(got)].sort().join(' ')
  const b = [...want].sort().join(' ')
  if (a !== b) failures.push(`${label}\n  expected [${b}]\n  got      [${a}]`)
}

const self = spawnSync(process.execPath, [join(docs, '.designkit/scripts/slop-gate.mjs'), '--self-test'], { cwd: docs, encoding: 'utf8' })

let newerTs = 'skipped'
if (!withoutTypescript) {
  const ts7 = spawnSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', '--silent', 'typescript@7'], { cwd: app, encoding: 'utf8' })
  if (ts7.status === 0) {
    rmSync(join(docs, '.designkit/scripts/node_modules'), { recursive: true, force: true })
    const r = spawnSync(process.execPath, [join(docs, '.designkit/scripts/slop-gate.mjs'), join(app, 'src/Hero.tsx'), '--json', '--no-fail'], { cwd: docs, encoding: 'utf8' })
    let ok = false
    try {
      ok = r.status === 0 && JSON.parse(r.stdout).counts.block > 0
    } catch {}
    newerTs = ok ? 'passed (no crash, fell back to the simpler checks)' : `FAILED: ${(r.stderr || r.stdout).trim().slice(0, 160)}`
    if (!ok) failures.push('app on TypeScript 7 without the pinned parser')
  }
}
rmSync(tmp, { recursive: true, force: true })

const total = Object.keys(expect).length
console.log(`Gate tests, ${mode}`)
if (failures.length) console.log(`\n${failures.join('\n')}`)
console.log(`\n${total - failures.length}/${total} probes correct`)
console.log(`self-test: ${self.status === 0 ? 'passed' : `FAILED\n${self.stdout}`}`)
console.log(`app on a TypeScript the gate cannot use: ${newerTs}`)
if (withoutTypescript || mode.startsWith('without')) {
  console.log('Without TypeScript, a few probes are expected to miss (JSX-only checks). Only the TypeScript run must be perfect.')
  process.exit(self.status === 0 ? 0 : 1)
}
process.exit(failures.length || self.status !== 0 ? 1 : 0)
