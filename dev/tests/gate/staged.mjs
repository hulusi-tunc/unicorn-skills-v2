#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const KIT = resolve(HERE, '../../..')
const tmp = mkdtempSync(join(tmpdir(), 'gate-staged-'))
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' }
let passed = 0
let failed = 0
const check = (name, ok) => {
  if (ok) passed++
  else failed++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`)
}

function project(name, workspace, skip = []) {
  const dir = join(tmp, name)
  mkdirSync(join(dir, '.designkit/scripts'), { recursive: true })
  mkdirSync(join(dir, '.agents/skills'), { recursive: true })
  for (const f of ['slop-gate.mjs', 'slop-rules.mjs', 'kit-paths.mjs']) cpSync(join(KIT, '.designkit/scripts', f), join(dir, '.designkit/scripts', f))
  symlinkSync(join(KIT, '.agents/skills/kill-ai-slop'), join(dir, '.agents/skills/kill-ai-slop'))
  const policy = JSON.parse(readFileSync(join(KIT, '.designkit/slop-policy.json'), 'utf8'))
  writeFileSync(join(dir, '.designkit/slop-policy.json'), JSON.stringify({ ...policy, skip: [...policy.skip, ...skip] }))
  writeFileSync(join(dir, '.designkit/workspace.json'), JSON.stringify(workspace))
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: dir })
  return dir
}
const git = (dir, ...args) => spawnSync('git', args, { cwd: dir, env, encoding: 'utf8' })
const put = (dir, path, text) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true })
  writeFileSync(join(dir, path), text)
  git(dir, 'add', '--', path)
}
const gate = (dir, ...args) => spawnSync(process.execPath, ['.designkit/scripts/slop-gate.mjs', '--staged', ...args], { cwd: dir, env, encoding: 'utf8' }).status
const reset = (dir) => git(dir, 'reset', '-q', '--hard')

const old = '// TODO: tidy this up later\nexport const a = 1\n'
const folio = project('Folio', { name: 'Folio', app: '.', joined: true })
put(folio, 'src/a.ts', old)
git(folio, 'commit', '-qm', 'old code')

console.log('Commit check, new problems only')
put(folio, 'src/a.ts', `${old}export const b = 2\n`)
check('an old problem in a touched file does not block with --new-only', gate(folio, '--new-only') === 0)
check('the same change still blocks without --new-only', gate(folio) === 1)
reset(folio)
put(folio, 'src/a.ts', `export const b = 2\n${old}`)
check('a moved old line is not new', gate(folio, '--new-only') === 0)
reset(folio)
put(folio, 'src/a.ts', `${old}// TODO: and another one\n`)
check('a new problem in an old file blocks', gate(folio, '--new-only') === 1)
reset(folio)
put(folio, 'src/b.ts', '// TODO: a brand new file\nexport const c = 3\n')
check('a problem in a new file blocks', gate(folio, '--new-only') === 1)
reset(folio)

console.log("\nJoined project: the kit's own documents are not app code")
put(folio, 'project/TASTE.md', '## Never\n- Lorem ipsum placeholder copy\n')
check('a taste file that names banned copy does not block a commit', gate(folio, '--new-only') === 0)
const saved = (path) => spawnSync(process.execPath, ['.designkit/scripts/slop-gate.mjs', '--hook'], { cwd: folio, env, encoding: 'utf8', input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: join(folio, path) } }) }).stdout
check('nor a save', !saved('project/TASTE.md').includes('"decision":"block"'))
put(folio, 'project/notes.md', 'Two looks \u2014 one accent.\n')
check('a document still gets the em dash note', saved('project/notes.md').includes('Em dashes in project/notes.md'))
const scan = JSON.parse(spawnSync(process.execPath, ['.designkit/scripts/slop-gate.mjs', '--json', '--no-fail'], { cwd: folio, env, encoding: 'utf8' }).stdout)
check('a whole-project scan leaves the documents out', !scan.hits.some((h) => h.file.startsWith('project/')))
reset(folio)

console.log('\nRules the designer switched off')
const quiet = project('Quiet', { name: 'Quiet', app: '.', joined: true }, ['dk-07'])
put(quiet, 'src/a.ts', old)
check('joined project: a switched-off dk-07 does not block', gate(quiet) === 0)
const strict = project('Strict', { name: 'Strict', app: '.' }, ['dk-07'])
put(strict, 'src/a.ts', old)
check('project the kit started: dk-07 still has no off switch', gate(strict) === 1)
const tuned = project('Tuned', { name: 'Tuned', app: '.' }, ['dk-04', '01'])
check("the self-test tests the gate, not this project's switched-off rules", spawnSync(process.execPath, ['.designkit/scripts/slop-gate.mjs', '--self-test'], { cwd: tuned, env, encoding: 'utf8' }).status === 0)

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
