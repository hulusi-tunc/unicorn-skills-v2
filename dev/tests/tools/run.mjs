#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const tmp = mkdtempSync(join(tmpdir(), 'tools-tests-'))
const proj = join(tmp, 'proj')
mkdirSync(join(proj, '.designkit/scripts'), { recursive: true })
mkdirSync(join(proj, '.agents/skills'), { recursive: true })
cpSync(join(KIT, '.designkit/tools.lock.json'), join(proj, '.designkit/tools.lock.json'))
cpSync(join(KIT, '.designkit/scripts/tools.mjs'), join(proj, '.designkit/scripts/tools.mjs'))
writeFileSync(join(proj, '.designkit/workspace.json'), '{}\n')
spawnSync('git', ['init', '-q'], { cwd: proj })
const tools = (...args) => spawnSync(process.execPath, [join(proj, '.designkit/scripts/tools.mjs'), ...args], { cwd: proj, encoding: 'utf8', env: { ...process.env, DESIGNKIT_TOOLS_CACHE: join(tmp, 'cache') } })

let passed = 0
const failed = []
const check = (name, ok) => (ok ? passed++ : failed.push(name))
const lock = JSON.parse(readFileSync(join(KIT, '.designkit/tools.lock.json'), 'utf8')).tools
check('every tool with a repo has a full pin and a skill path', Object.values(lock).every((t) => !t.repo || (/^[0-9a-f]{40}$/.test(t.pin) && t.skill)))
check('auth suggests the security audit', tools('--suggest', 'auth').stdout.includes('security-audit'))
tools('--decline', 'security-audit', 'auth')
check('a declined tool is not suggested again at that moment', !tools('--suggest', 'auth').stdout.includes('security-audit'))
check('a tool without a repository cannot be pulled', tools('--pull', 'qa-kit').status === 1)
if (spawnSync('git', ['ls-remote', '--exit-code', lock['security-audit'].repo, 'HEAD'], { encoding: 'utf8', timeout: 15000 }).status === 0) {
  const r = tools('--pull', 'security-audit')
  const link = join(proj, '.agents/skills/security-audit')
  check('pull links the skill into the project', r.status === 0 && existsSync(join(link, 'SKILL.md')))
  check('the pulled copy is exactly the pinned commit', existsSync(link) && spawnSync('git', ['rev-parse', 'HEAD'], { cwd: realpathSync(link), encoding: 'utf8' }).stdout.trim() === lock['security-audit'].pin)
  check('the pulled tool is never committed (local exclude)', readFileSync(join(proj, '.git/info/exclude'), 'utf8').includes('/.agents/skills/security-audit') && !spawnSync('git', ['status', '--porcelain'], { cwd: proj, encoding: 'utf8' }).stdout.includes('security-audit'))
  check('the workspace records the tool', JSON.parse(readFileSync(join(proj, '.designkit/workspace.json'), 'utf8')).tools?.includes('security-audit'))
  check('figma-first suggests the Figma skills', tools('--suggest', 'figma-first').stdout.includes('figma'))
  const fig = tools('--pull', 'figma')
  check('pulling figma links figma-use and its companions', fig.status === 0 && ['figma-use', 'figma-generate-design', 'figma-generate-library', 'figma-code-connect'].every((s) => existsSync(join(proj, '.agents/skills', s, 'SKILL.md'))))
  check('pulling figma opens Figma writes for this project', JSON.parse(readFileSync(join(proj, '.designkit/workspace.json'), 'utf8')).figma === 'write')
} else console.log('offline: pull checks skipped')
rmSync(tmp, { recursive: true, force: true })
for (const f of failed) console.log(`FAIL ${f}`)
console.log(`${passed} passed, ${failed.length} failed`)
process.exit(failed.length ? 1 : 0)
