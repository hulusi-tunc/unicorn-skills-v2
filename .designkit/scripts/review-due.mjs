#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isKitPath } from './kit-paths.mjs'
import { parseStatus } from './status.mjs'

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const IS_KIT = existsSync(join(HERE, 'bin/new-project'))
const STATE = join(HERE, '.designkit/state/review.json')
const STATUS = join(HERE, 'project/reviews/STATUS.md')
const IGNORED = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|next-env\.d\.ts)$|\.snap$|(^|\/)(node_modules|\.next|\.expo|dist|build|out|coverage)\//
const SCREENS = 3
const LINES = 500
const DAYS = 14
const OPEN = 20

const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}
const workspace = readJson(join(HERE, '.designkit/workspace.json'), {})
const APP = workspace.app ? resolve(HERE, workspace.app) : null

function git(...args) {
  const r = spawnSync('git', args, { cwd: APP, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return r.status === 0 ? r.stdout.trim() : null
}

function start(status) {
  const known = git('merge-base', status.marker, 'HEAD') || (status.lastDate ? git('rev-list', '-1', `--before=${status.lastDate}T23:59:59`, 'HEAD') : null)
  if (!known) return null
  const declined = readJson(STATE, {}).declinedAt
  const later = declined && git('merge-base', '--is-ancestor', known, declined) !== null && git('merge-base', '--is-ancestor', declined, 'HEAD') !== null
  return later ? declined : known
}

function changes(base) {
  const files = []
  let lines = 0
  for (const row of (git('diff', '--numstat', base) ?? '').split('\n').filter(Boolean)) {
    const [added, removed, file] = row.split('\t')
    if (IGNORED.test(file) || isKitPath(file)) continue
    files.push(file)
    lines += (Number(added) || 0) + (Number(removed) || 0)
  }
  return { files, lines }
}

function screens(files) {
  const root = ['src/features', 'features'].find((dir) => existsSync(join(APP, dir)))
  const names = new Set()
  for (const file of files) {
    if (root) {
      const m = file.startsWith(`${root}/`) && file.slice(root.length + 1).match(/^([^/]+)\//)
      if (m) names.add(m[1])
    } else {
      const m = file.match(/^(?:src\/)?app\/(?:(.+)\/)?[^/]+$/)
      if (m) names.add(m[1] ?? '/')
    }
  }
  return names.size
}

function due() {
  if (IS_KIT || !APP || !existsSync(join(APP, '.git')) || !existsSync(STATUS)) return null
  const status = parseStatus(readFileSync(STATUS, 'utf8'))
  if (!status.marker) return null
  const base = start(status)
  if (!base) return null
  const { files, lines } = changes(base)
  if (!files.length) return null
  const count = screens(files)
  const age = Math.floor((Date.now() / 1000 - Number(git('log', '-1', '--format=%ct', base))) / 86400)
  const reason =
    count >= SCREENS
      ? `${count} screens changed since the last review.`
      : lines >= LINES
        ? `${lines} lines of app code changed since the last review.`
        : age >= DAYS
          ? `${age} days since the last review, with changes since.`
          : null
  if (!reason) return null
  if (status.open.length >= OPEN) return `Review due, but ${status.open.length} problems are still open in project/reviews/STATUS.md. Ask the designer, as one yes or no: a fix-up session on those first, most serious first?`
  return `Review due: ${reason} Ask the designer, as one yes or no: run one now? About ${Math.min(10, 3 + 2 * count)} minutes.`
}

function decline() {
  const head = APP && existsSync(join(APP, '.git')) ? git('rev-parse', 'HEAD') : null
  if (!head) return
  mkdirSync(dirname(STATE), { recursive: true })
  writeFileSync(STATE, `${JSON.stringify({ declinedAt: head }, null, 2)}\n`)
  console.log('Review reminder quiet until more work builds up.')
}

try {
  if (process.argv.includes('--decline')) decline()
  else {
    const line = due()
    if (line) console.log(line)
  }
} catch {}
