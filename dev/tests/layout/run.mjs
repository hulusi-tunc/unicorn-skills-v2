#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
let passed = 0
let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) passed++
  else failed++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n        ${detail}`}`)
}
const tracked = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: KIT, encoding: 'utf8' }).stdout.split('\n').filter(Boolean)
const read = (file) => readFileSync(join(KIT, file), 'utf8')
const has = (file) => existsSync(join(KIT, file))
const isFile = (file) => !!lstatSync(join(KIT, file), { throwIfNoEntry: false })?.isFile()

console.log('Machinery')
for (const f of ['slop-gate.mjs', 'slop-rules.mjs', 'team-sync.mjs', 'quick-check.mjs', 'review-due.mjs', 'status.mjs', 'check-upstream.mjs', 'kit-paths.mjs', 'package.json', 'package-lock.json']) check(`.designkit/scripts/${f}`, has(`.designkit/scripts/${f}`))
check('.designkit/slop-policy.json', has('.designkit/slop-policy.json'))
check('.designkit/upstream.json', has('.designkit/upstream.json'))
check('the rules read only in one situation', has('.designkit/rules/joined.md') && has('.designkit/rules/handover.md'))

console.log('\nOld paths')
const FORWARDERS = ['check-upstream.mjs', 'quick-check.mjs', 'review-due.mjs', 'slop-gate.mjs', 'team-sync.mjs'].map((f) => `.claude/scripts/${f}`)
check('five forwarders and nothing else under .claude/scripts', tracked.filter((f) => f.startsWith('.claude/scripts/')).sort().join() === FORWARDERS.join())
const self = spawnSync(process.execPath, [join(KIT, '.claude/scripts/slop-gate.mjs'), '--self-test'], { cwd: KIT, encoding: 'utf8' })
check('the old gate path still runs the gate', self.status === 0 && /self-test: all passed/.test(self.stdout), (self.stderr || self.stdout).slice(0, 200))
const STALE = /\.claude\/(?:scripts|state|workspace\.json|slop-policy\.json|upstream\.json|skills\/)/
const HISTORY = /^(?:dev\/|bin\/|\.claude\/scripts\/|\.claude\/settings\.local\.json$|\.designkit\/scripts\/(?:adapters|tools)\.mjs$)/
const borrowed = Object.keys(JSON.parse(read('skills-lock.json')).skills)
const lent = (f) => f.startsWith('.agents/skills/') && borrowed.includes(f.split('/')[2])
const stale = tracked.filter((f) => !HISTORY.test(f) && !lent(f) && isFile(f) && STALE.test(read(f)))
check('no instruction still points at the old machinery', stale.length === 0, stale.join(', '))

console.log('\nSkills')
const skills = has('.agents/skills') ? readdirSync(join(KIT, '.agents/skills')).filter((n) => has(`.agents/skills/${n}/SKILL.md`)) : []
check('the 20 design skills live in .agents/skills', ['no-slop', 'kill-ai-slop', 'frontend-design', 'ui-design', 'accessibility'].every((n) => skills.includes(n)) && skills.length >= 20, `${skills.length} found`)
const linked = skills.filter((n) => {
  const s = lstatSync(join(KIT, '.claude/skills', n), { throwIfNoEntry: false })
  return s?.isSymbolicLink() && readlinkSync(join(KIT, '.claude/skills', n)) === `../../.agents/skills/${n}`
})
check('each is linked into .claude/skills', linked.length === skills.length && skills.length > 0, skills.filter((n) => !linked.includes(n)).join(', '))
check('.agents is not ignored', spawnSync('git', ['check-ignore', '-q', '.agents/skills/no-slop/SKILL.md'], { cwd: KIT }).status !== 0)
const upToDate = spawnSync(process.execPath, [join(KIT, '.designkit/scripts/adapters.mjs'), '--check'], { cwd: KIT, encoding: 'utf8' })
check('bin/adapters --check: nothing to regenerate', upToDate.status === 0, (upToDate.stdout || upToDate.stderr).slice(0, 300))

console.log('\nRules')
check('AGENTS.md holds the rules', has('AGENTS.md') && /## Working together/.test(read('AGENTS.md')))
check('CLAUDE.md only loads it', has('CLAUDE.md') && read('CLAUDE.md').trim() === '@AGENTS.md')
const WORKFLOWS = ['setup', 'tokenize', 'design-screen', 'commit', 'check', 'slop-check', 'sync']
const ownSkills = tracked.filter((f) => f.startsWith('.agents/skills/') && !borrowed.includes(f.split('/')[2]) && /\.(?:md|mjs|json)$/.test(f))
const NEUTRAL = ['AGENTS.md', ...tracked.filter((f) => /^\.designkit\/(?:agents|hooks)\//.test(f)), ...ownSkills]
const named = NEUTRAL.filter((f) => isFile(f) && /claude/i.test(read(f).replace(/`?\.claude\/[^\s`]*`?|CLAUDE\.md/g, '')))
check('shared files name no product', named.length === 0, named.join(', '))
const NAMES = /\b(?:Peter|Osmose|Dirigeo)\b|DIRIGEO-\d/i
const people = tracked.filter((f) => !/^(?:dev|\.superpowers)\//.test(f) && isFile(f) && NAMES.test(read(f)))
check('shipped files name no colleague or client project', people.length === 0, people.join(', '))
check('the rules tell an agent without hooks what to run', has('AGENTS.md') && /hook\.mjs session-start/.test(read('AGENTS.md')) && /hook\.mjs after-edit/.test(read('AGENTS.md')))
const readme = read('README.md')
check('the README says which agents work and how far', /## Which AI agents/.test(readme) && ['Claude Code', 'Codex', 'Cursor', 'Gemini CLI', 'GitHub Copilot', 'OpenCode'].every((n) => readme.includes(`| ${n} |`)) && /Tested live: Claude Code/.test(readme))
check("the README's steps for an agent use the new paths", /## For your AI agent/.test(readme) && readme.includes('.agents/skills/setup/SKILL.md') && readme.includes('bin/update-project') && !/For Claude:/.test(readme))
const claudeHooks = JSON.parse(read('.claude/settings.json')).hooks
check('Claude Code runs the hook script at the start, before a command and after an edit', ['SessionStart', 'PreToolUse', 'PostToolUse'].every((e) => JSON.stringify(claudeHooks[e] ?? '').includes('.designkit/scripts/hook.mjs')) && !JSON.stringify(claudeHooks).includes('slop-gate.mjs'))

check("the rules call only the kit's own tool files generated", /`\.github\/agents`/.test(read('AGENTS.md')) && !/`\.github\/`, `\.opencode\/`\) is generated/.test(read('AGENTS.md').replace(/\s+/g, ' ')))
check("Claude Code's command guard also sees Figma tools under any server name", (claudeHooks.PreToolUse ?? []).some((g) => new RegExp(`^(?:${g.matcher})$`).test('mcp__plugin_figma_figma__use_figma') && new RegExp(`^(?:${g.matcher})$`).test('Bash')))

console.log('\nWorkflows')
for (const name of WORKFLOWS) {
  const file = `.agents/skills/${name}/SKILL.md`
  const head = has(file) ? read(file).split('\n---')[0] : ''
  check(`/${name} is a skill`, new RegExp(`^name: ${name}$`, 'm').test(head) && /^description: \S/m.test(head))
}
check('no commands folder is left', !has('.claude/commands'))
const tooled = WORKFLOWS.filter((n) => has(`.agents/skills/${n}/SKILL.md`) && /AskUserQuestion|subagent_type|run_in_background|\$ARGUMENTS|Agent call/.test(read(`.agents/skills/${n}/SKILL.md`)))
check("workflows name no single tool's features", tooled.length === 0, tooled.join(', '))

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
