#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isKitPath } from './kit-paths.mjs'

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const STATE = join(HERE, '.designkit/state/last-check.json')
const PLACEHOLDER = /no test specified/

const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}
const workspace = readJson(join(HERE, '.designkit/workspace.json'), {})
const APP = workspace.app ? resolve(HERE, workspace.app) : process.cwd()
const pkg = readJson(join(APP, 'package.json'), {})
const scripts = pkg.scripts ?? {}
const deps = { ...pkg.dependencies, ...pkg.devDependencies }

function found() {
  const steps = []
  if (deps.typescript && existsSync(join(APP, 'tsconfig.json'))) {
    const typegen = deps.next ? '(npx --no-install next typegen >/dev/null 2>&1 || true) && ' : ''
    steps.push({ name: 'typecheck', run: `${typegen}npx --no-install tsc --noEmit` })
  }
  if (scripts.lint) steps.push({ name: 'lint', run: 'npm run lint --silent' })
  if (scripts.test && !PLACEHOLDER.test(scripts.test)) steps.push({ name: 'test', run: 'npm test --silent' })
  if (scripts.build) steps.push({ name: 'build', run: 'npm run build --silent' })
  return steps
}
const steps = () => workspace.quickCheck ?? found()
const tail = (text) => text.trimEnd().split('\n').slice(-40).join('\n')

function run(step) {
  const begin = Date.now()
  const r = spawnSync(step.run, { cwd: APP, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return { ...step, ok: r.status === 0, seconds: Math.round((Date.now() - begin) / 1000), output: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

function tree() {
  const r = spawnSync('git', ['write-tree'], { cwd: APP, encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : null
}

function onlyKitFiles() {
  if (!workspace.joined) return false
  const staged = spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: APP, encoding: 'utf8' }).stdout.split('\n').filter(Boolean)
  return staged.length > 0 && staged.every(isKitPath)
}

function check() {
  if (onlyKitFiles()) return
  const done = []
  for (const step of steps()) {
    const r = run(step)
    if (!r.ok) {
      console.error(`quick check: ${r.name} failed. Fix it, stage the fix, and commit again.\n${tail(r.output)}`)
      process.exit(1)
    }
    done.push({ name: r.name, seconds: r.seconds })
  }
  mkdirSync(dirname(STATE), { recursive: true })
  writeFileSync(STATE, `${JSON.stringify({ date: new Date().toISOString(), tree: tree(), steps: done }, null, 2)}\n`)
  if (done.length) console.log(`quick check: passed (${done.map((s) => `${s.name} ${s.seconds}s`).join(', ')})`)
}

const args = process.argv.slice(2)
if (args[0] === '--list') console.log(JSON.stringify(steps(), null, 2))
else if (args[0] === '--time') {
  const extra = args.slice(1).map((name) => ({ name, run: `npm run ${name} --silent` }))
  console.log(JSON.stringify([...found(), ...extra].map(run).map(({ output, ...r }) => r), null, 2))
} else check()
