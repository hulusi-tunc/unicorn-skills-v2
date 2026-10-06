#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const git = (args) => {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  return r.status === 0 ? r.stdout : ''
}

const FILES = [
  [/(^|\/)\.env(\.[^/]*)?$/, (f) => !/\.env\.(example|sample|template)$/.test(f), 'an env file: secrets live in the environment; commit .env.example with empty values'],
  [/(^|\/)\.claude\/settings\.local\.json$/, () => true, 'a personal Claude settings file'],
  [/\.jsonl$/, () => true, 'a chat or session dump'],
  [/(^|\/)(node_modules|\.next|\.expo|dist)\//, () => true, 'a build or dependency folder'],
  [/(^|\/)\.DS_Store$/, () => true, 'a macOS folder file'],
]
const SECRETS = [
  [/\bsk_live_[0-9A-Za-z]{16,}/, 'a Stripe live secret key'],
  [/\brk_live_[0-9A-Za-z]{16,}/, 'a Stripe live restricted key'],
  [/-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, 'a private key'],
  [/\bgh[pousr]_[0-9A-Za-z]{30,}|\bgithub_pat_[0-9A-Za-z_]{30,}/, 'a GitHub token'],
  [/\bglpat-[0-9A-Za-z_-]{20,}/, 'a GitLab token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key'],
  [/\bxox[abpr]-[0-9A-Za-z-]{10,}/, 'a Slack token'],
]
const PUBLIC_SECRET = /\b(?:NEXT_PUBLIC|EXPO_PUBLIC|VITE|PUBLIC|REACT_APP)_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE|PASSWORD)[A-Z0-9_]*/
const MAX_BYTES = 5e6

const role = (token) => {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).role
  } catch {
    return null
  }
}

export function findProblems() {
  const staged = git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']).split('\0').filter(Boolean)
  const problems = []
  for (const f of staged) {
    for (const [re, applies, why] of FILES) if (re.test(f) && applies(f)) problems.push(`${f}: ${why}`)
    const size = Number(git(['cat-file', '-s', `:${f}`]).trim() || 0)
    if (size > MAX_BYTES) problems.push(`${f}: ${(size / 1e6).toFixed(1)} MB; masters go to LFS or Drive, the app gets a web size`)
  }
  let file = ''
  for (const line of git(['diff', '--cached', '-U0', '--no-color']).split('\n')) {
    if (line.startsWith('+++ ')) {
      file = line.slice(6)
      continue
    }
    if (!line.startsWith('+') || line.startsWith('+++')) continue
    const text = line.slice(1)
    for (const [re, what] of SECRETS) if (re.test(text)) problems.push(`${file}: ${what}`)
    for (const token of text.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? [])
      if (role(token) === 'service_role') problems.push(`${file}: a Supabase service_role key; it skips row level security and belongs on the server only`)
    const pub = text.match(PUBLIC_SECRET)
    if (pub) problems.push(`${file}: ${pub[0]}; a public prefix ships it to every visitor, a secret never gets one`)
  }
  return [...new Set(problems)]
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = findProblems()
  if (problems.length) {
    console.error(
      [
        `secrets check: not committed. ${problems.length === 1 ? 'One thing' : `${problems.length} things`} must not go into git:`,
        ...problems.map((p) => `  - ${p}`),
        'Unstage with: git restore --staged <file>. A real key that was ever committed or pushed must be rotated: removing it from git does not make it safe.',
      ].join('\n'),
    )
    process.exit(1)
  }
}
