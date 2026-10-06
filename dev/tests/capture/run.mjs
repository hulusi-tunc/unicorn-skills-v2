#!/usr/bin/env node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const { manifestFrom } = await import(join(KIT, '.designkit/scripts/e2e-manifest.mjs'))
const art = mkdtempSync(join(tmpdir(), 'capture-tests-'))
const shot = (dir) => {
  mkdirSync(join(art, dir), { recursive: true })
  writeFileSync(join(art, dir, '001.png'), 'png')
  return `${dir}/001.png`
}
const result = (title, status, path) => ({ testId: `tests/a.e2e.ts::s::${encodeURIComponent(title)}`, titlePath: ['s', title], status, attempts: [{ artifacts: path ? [{ kind: 'screenshot', path }] : [] }] })
const report = { run: { results: [
  result('home/today@normal.light.440', 'passed', shot('a')),
  result('home/today@normal.dark.440', 'passed', shot('b')),
  result('Home screen', 'passed', shot('c')),
  result('road/hualien@normal.light.440', 'failed', shot('d')),
  result('road/map@normal.light.440', 'passed', null),
] } }
const { manifest, problems } = manifestFrom(report, art, 'ios')
let passed = 0
const failed = []
const check = (name, ok) => (ok ? passed++ : failed.push(name))
check('passed tests with a frame-key title become frames', manifest.frames.length === 2 && manifest.frames[0].key === 'home/today@normal.light.440' && manifest.frames[0].file === 'a/001.png')
check('every frame names the platform', manifest.frames.every((f) => f.platform === 'ios'))
check('a title that is not a frame key is reported, not sent', problems.some((p) => p.includes('Home screen')))
check('a failed test is reported, not sent', problems.some((p) => p.includes('road/hualien') && p.includes('failed')))
check('a test without a screenshot is reported', problems.some((p) => p.includes('road/map')))
rmSync(art, { recursive: true, force: true })
for (const f of failed) console.log(`FAIL ${f}`)
console.log(`${passed} passed, ${failed.length} failed`)
process.exit(failed.length ? 1 : 0)
