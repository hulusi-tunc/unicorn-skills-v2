#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const NONE = /^0+$/
const workspace = (() => {
  try {
    return JSON.parse(readFileSync(join(resolve(dirname(fileURLToPath(import.meta.url)), '../..'), '.designkit/workspace.json'), 'utf8'))
  } catch {
    return {}
  }
})()
const guarded = new Set(workspace.protected ?? [])
const remoteUrl = process.argv[3] ?? ''
const problems = []
const refused = []
for (const line of readFileSync(0, 'utf8').split('\n').filter(Boolean)) {
  const [, local, ref, remote] = line.split(' ')
  const branch = (ref ?? '').replace(/^refs\/heads\//, '')
  if (local && !NONE.test(local) && guarded.has(branch)) problems.push(`${branch} takes changes through a merge request, never a direct push`)
  if (!local || !remote || NONE.test(local)) continue
  if (!NONE.test(remote) && spawnSync('git', ['merge-base', '--is-ancestor', remote, local]).status !== 0) refused.push(branch)
  const range = NONE.test(remote) ? [local, '--not', '--remotes'] : [`${remote}..${local}`]
  const emails = spawnSync('git', ['log', '--format=%ae', ...range], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean)
  for (const e of new Set(emails)) if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) problems.push(`author email "${e}" is broken: set git config user.email, then amend the commit`)
}
if (refused.length) problems.push(`it would replace commits already on GitHub (${refused.join(', ')}). Pull first, then push; never force`)

function visibility() {
  if (process.env.DESIGNKIT_TEST_VISIBILITY) return process.env.DESIGNKIT_TEST_VISIBILITY
  const gh = remoteUrl.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)
  const gl = remoteUrl.match(/gitlab[^:/]*[:/](.+?)(?:\.git)?$/)
  const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 8000 })
  if (gh) return run('gh', ['api', `repos/${gh[1]}`, '--jq', '.visibility']).stdout?.trim() || null
  if (gl) {
    try {
      return JSON.parse(run('glab', ['api', `projects/${encodeURIComponent(gl[1])}`]).stdout).visibility
    } catch {
      return null
    }
  }
  return null
}
if (!workspace.public && visibility() === 'public') problems.push('this repository is public: anyone can read the code and its history. Make it private, or record the decision as "public": true in .designkit/workspace.json')

if (problems.length) {
  console.error(`push refused:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  process.exit(1)
}
