#!/usr/bin/env node
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { linkSkills } from './adapters.mjs'

export const OFF = {
  web: ['vercel-react-native-skills'],
  mobile: ['vercel-react-best-practices', 'web-design-guidelines', 'shadcn-ui'],
  both: [],
}

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const WORKSPACE = join(HERE, '.designkit/workspace.json')
const platform = process.argv[2]
const fail = (text) => {
  console.error(`skills-for: ${text}`)
  process.exit(2)
}

if (!OFF[platform]) fail('usage: skills-for.mjs web | mobile | both')
if (existsSync(join(HERE, 'bin/new-project'))) fail('this is the kit; it keeps every skill.')
if (!existsSync(WORKSPACE)) fail('not a project: .designkit/workspace.json is missing.')

const workspace = JSON.parse(readFileSync(WORKSPACE, 'utf8'))
const home = (p) => (p?.startsWith('~/') ? join(homedir(), p.slice(2)) : p)
const kit = home(workspace.kit)
const off = OFF[platform]
const back = (workspace.skillsOff ?? []).filter((name) => !off.includes(name))
const missing = []

for (const name of off) rmSync(join(HERE, '.agents/skills', name), { recursive: true, force: true })
for (const name of back) {
  const from = kit && join(kit, '.agents/skills', name)
  if (from && existsSync(join(from, 'SKILL.md'))) cpSync(from, join(HERE, '.agents/skills', name), { recursive: true })
  else missing.push(name)
}
linkSkills(HERE)

if (off.length) workspace.skillsOff = off
else delete workspace.skillsOff
writeFileSync(WORKSPACE, `${JSON.stringify(workspace, null, 2)}\n`)

console.log(off.length ? `Skills for ${platform}: left out ${off.join(', ')}.` : 'Skills for web and mobile: all kept.')
if (missing.length) console.log(`Could not bring back ${missing.join(', ')}: the kit folder was not found. /sync brings them back.`)
