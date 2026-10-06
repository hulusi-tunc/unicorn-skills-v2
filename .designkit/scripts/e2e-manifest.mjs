#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const KEY = /^[a-z0-9-]+(?:\/[a-z0-9-]+)+@[a-z0-9-]+\.(?:light|dark)\.\d+$/

export function manifestFrom(report, artifactsDir, platform) {
  const run = report.run ?? report
  const frames = []
  const problems = []
  for (const result of run.results ?? []) {
    const attempt = (result.attempts ?? []).at(-1)
    if (!attempt) continue
    if (result.status !== 'passed') {
      problems.push(`${decodeURIComponent(result.testId ?? '')}: ${result.status}`)
      continue
    }
    const key = String((result.titlePath ?? []).at(-1) ?? decodeURIComponent(String(result.testId ?? '').split('::').pop() ?? ''))
    const title = key
    const shot = (attempt.artifacts ?? []).filter((a) => a.kind === 'screenshot').at(-1)
    if (!shot) {
      problems.push(`${title}: no screenshot`)
      continue
    }
    if (!KEY.test(key)) {
      problems.push(`${title}: the test title is not a frame key (flow/screen@state.theme.width)`)
      continue
    }
    const file = resolve(artifactsDir, shot.path)
    if (!existsSync(file)) {
      problems.push(`${key}: ${shot.path} is missing`)
      continue
    }
    frames.push({ platform, key, file: relative(artifactsDir, file) })
  }
  return { manifest: { version: 2, frames }, problems }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
if (isMain) {
  const [reportPath = '.e2e/report.json', platform = 'ios', out = 'gallery-manifest.json'] = process.argv.slice(2)
  const report = JSON.parse(readFileSync(reportPath, 'utf8'))
  const artifacts = join(dirname(resolve(reportPath)), 'artifacts')
  const { manifest, problems } = manifestFrom(report, artifacts, platform)
  writeFileSync(join(artifacts, out), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`${manifest.frames.length} frames written to ${join(artifacts, out)}`)
  if (problems.length) {
    console.error(`Not in the manifest (${problems.length}):\n${problems.map((p) => `  - ${p}`).join('\n')}`)
    process.exit(1)
  }
}
