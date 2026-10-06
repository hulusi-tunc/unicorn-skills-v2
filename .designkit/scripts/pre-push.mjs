#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const NONE = /^0+$/
const refused = []
for (const line of readFileSync(0, 'utf8').split('\n').filter(Boolean)) {
  const [, local, ref, remote] = line.split(' ')
  if (!local || !remote || NONE.test(local) || NONE.test(remote)) continue
  if (spawnSync('git', ['merge-base', '--is-ancestor', remote, local]).status !== 0) refused.push(ref.replace(/^refs\/heads\//, ''))
}
if (refused.length) {
  console.error(`push refused: it would replace commits already on GitHub (${refused.join(', ')}). Pull first, then push; never force.`)
  process.exit(1)
}
