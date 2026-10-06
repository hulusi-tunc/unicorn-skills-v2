#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SCRIPTS = join(KIT, '.designkit/scripts')
const tmp = mkdtempSync(join(tmpdir(), 'hook-tests-'))
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' }
let passed = 0
let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) passed++
  else failed++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n        ${detail}`}`)
}
const git = (cwd, ...args) => spawnSync('git', args, { cwd, env, encoding: 'utf8' })

console.log('Guard')
const { refusal, figmaWrite } = await import(join(SCRIPTS, 'guard.mjs'))
const REFUSED = [
  'git add -A', 'git add --all', 'git add .', 'git add -A src', 'git -C app add .', 'cd app && git add -A', 'git add -Av', 'GIT_TRACE=1 git add .',
  'command git add --all', '/usr/bin/git add .', 'git add -- .', 'git stage -A', 'bash -c "git add -A"', 'echo "$(git add .)"', 'git status; git add .',
  'git commit --no-verify -m x', 'git commit -n -m x', 'git commit -nm "x"', 'git -c core.hooksPath=/dev/null commit -m x', 'HUSKY=0 git commit -m x',
  'git -C app commit -m "x" --no-verify', 'git merge --no-verify topic', 'git push --no-verify',
  'git push --force', 'git push -f', 'git push origin main --force', 'git push --force-with-lease', 'git push origin +main', 'git -C app push -f origin main', 'git push -uf origin main', 'git push --mirror',
  'bash -lc "git add -A"', "sh -ec 'git add .'", 'zsh -xc "git push -f"', 'git add --al', 'git add --a', 'git add :', "git add ':(top)'", 'git add :/', "git add '*'", "git add ':!node_modules'",
  'git commit --no-verif -m x', 'git push --forc', 'git push --mirr', 'git config core.hooksPath /dev/null', 'git config --global core.hooksPath /tmp/none', 'git config unset core.hooksPath', 'git config --unset core.hooksPath',
  'export HUSKY=0; git commit -m x', "git -c alias.x='add -A' x", "git config alias.x 'add -A'", "git config --global alias.ship '!git push -f'", 'git --config-env=core.hooksPath=HP commit -m x',
  'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit -m x', 'timeout 10 git add -A', 'nice -n 5 git add -A', 'caffeinate -i git push -f',
  'git add -f project/screens/today.md', 'git add --force project/DEV.md', 'git add -fv project/x.md', 'git add --forc project/x.md',
]
const ALLOWED = [
  'git add src/app/page.tsx', 'git add -- src/a.ts src/b.ts', 'git add -p src/a.ts', 'git commit -m "add . and -A to the docs"', 'git commit -m "--no-verify is refused"',
  'git commit -m "fix the -n flag"', 'git commit -m -n', 'git push', 'git push -u origin main', 'git push origin main', 'git push origin main -n', 'git status', 'git log --all', 'git log -n 5',
  'git notes add .', 'echo git add -A', 'npm run add -- -A', 'rm -rf node_modules && git status', 'git diff --no-index a b', '', 'ls -la .',
  'bash -lc "git status"', 'git add src/', "git add ':(top)src/a.ts'", 'git add -u', 'git config core.hooksPath', 'git config --get core.hooksPath', 'git config alias.st status', 'git config user.name "Ada"',
  'timeout 10 git status', 'nice -n 5 npm run build', 'git push --follow-tags', 'export PATH=/usr/bin:$PATH', 'git commit --no-edit',
]
const wrongly = REFUSED.filter((c) => !refusal(c))
check(`${REFUSED.length} spellings of the refused commands are refused`, wrongly.length === 0, wrongly.join(' | '))
const blocked = ALLOWED.filter((c) => refusal(c))
check(`${ALLOWED.length} ordinary commands pass`, blocked.length === 0, blocked.join(' | '))
check('a forced add is refused with its own reason', /ignore/.test(refusal('git add -f project/x.md') ?? ''))
check('the reason is a sentence for the agent', /by name/.test(refusal('git add -A')) && /commit check/.test(refusal('git commit -n')) && /force/.test(refusal('git push -f')))
check('Figma write tools are refused under any server name', ['mcp__figma__use_figma', 'mcp__claude_ai_Figma__create_new_file', 'mcp_figma_upload_assets', 'figma_generate_diagram', 'MCP:figma/create_shader', 'use_figma'].every(figmaWrite))
const idle = spawnSync('sh', ['-c', `sleep 1 | "${process.execPath}" "${join(SCRIPTS, 'hook.mjs')}" before-command --tool claude`], { cwd: tmp, encoding: 'utf8' })
check('an input pipe with nothing in it: no crash, no output', idle.status === 0 && !idle.stdout && !/Error|EAGAIN/.test(idle.stderr), idle.stderr.slice(0, 160))
check('Figma read tools and other tools pass', !['mcp__figma__get_design_context', 'mcp_figma_get_screenshot', 'mcp__mobbin__search_screens', 'mcp__drive__create_new_file', 'Bash', ''].some(figmaWrite))

console.log('\nCommit message')
const clean = (text) => {
  const file = join(tmp, 'MSG')
  writeFileSync(file, text)
  const r = spawnSync(process.execPath, [join(SCRIPTS, 'commit-msg.mjs'), file], { encoding: 'utf8' })
  return { status: r.status, text: readFileSync(file, 'utf8') }
}
const signed = clean('feat(home): show the balance\n\nThe total was hidden behind a tap.\n\n\u{1F916} Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n')
check('AI signature lines are removed, the message stays', signed.status === 0 && signed.text === 'feat(home): show the balance\n\nThe total was hidden behind a tap.\n', JSON.stringify(signed.text))
const others = clean('fix: a\n\nCo-authored-by: Cursor <cursoragent@cursor.com>\nCo-authored-by: Copilot <198982749+Copilot@users.noreply.github.com>\nCo-authored-by: Codex <codex@openai.com>\nhttps://claude.ai/code/session_01ABC\n')
check("other tools' lines and session links go too", others.text === 'fix: a\n', JSON.stringify(others.text))
const human = 'feat: b\n\nGenerated with cursor-based pagination in mind.\n\nCo-authored-by: Claude Dupont <claude@dupont.fr>\nCo-authored-by: Ada Lovelace <ada@example.com>\n'
check('human co-authors and ordinary sentences are kept', clean(human).text === human)
check('a missing file is not an error', spawnSync(process.execPath, [join(SCRIPTS, 'commit-msg.mjs'), join(tmp, 'nope')]).status === 0)

console.log('\nPush')
const origin = join(tmp, 'origin.git')
const work = join(tmp, 'work')
git(tmp, 'init', '-q', '--bare', '-b', 'main', origin)
git(tmp, 'clone', '-q', origin, work)
writeFileSync(join(work, 'a.txt'), 'one\n')
git(work, 'add', 'a.txt')
git(work, 'commit', '-qm', 'one')
git(work, 'push', '-q', 'origin', 'HEAD:main')
const first = git(work, 'rev-parse', 'HEAD').stdout.trim()
writeFileSync(join(work, 'a.txt'), 'two\n')
git(work, 'commit', '-qam', 'two')
const second = git(work, 'rev-parse', 'HEAD').stdout.trim()
const prePush = (line) => spawnSync(process.execPath, [join(SCRIPTS, 'pre-push.mjs')], { cwd: work, env, encoding: 'utf8', input: line })
check('a push that adds commits passes', prePush(`refs/heads/main ${second} refs/heads/main ${first}\n`).status === 0)
check('a new branch passes', prePush(`refs/heads/x ${second} refs/heads/x ${'0'.repeat(40)}\n`).status === 0)
const rewrite = prePush(`refs/heads/main ${first} refs/heads/main ${second}\n`)
check('a push that would replace commits is refused, in plain words', rewrite.status === 1 && /replace commits/.test(rewrite.stderr))
check('commits this Mac has never seen count as theirs', prePush(`refs/heads/main ${second} refs/heads/main ${'a'.repeat(40)}\n`).status === 1)
git(work, 'push', '-q', 'origin', 'HEAD:main')
mkdirSync(join(work, '.designkit'), { recursive: true })
spawnSync('cp', ['-R', SCRIPTS, join(work, '.designkit/scripts')])
spawnSync('cp', ['-R', join(KIT, '.designkit/hooks'), join(work, '.designkit/hooks')])
git(work, 'config', 'core.hooksPath', '.designkit/hooks')
git(work, 'reset', '-q', '--hard', first)
writeFileSync(join(work, 'a.txt'), 'three\n')
const made = git(work, 'commit', '-qam', 'three', '-m', 'Co-Authored-By: Claude <noreply@anthropic.com>')
check('through git: the commit lands without the AI line', made.status === 0 && !/Co-Authored/i.test(git(work, 'log', '-1', '--format=%B').stdout))
const forced = git(work, 'push', '-q', '--force', 'origin', 'HEAD:main')
check('through git: a forced push is stopped by the push check', forced.status !== 0 && git(origin, 'rev-parse', 'main').stdout.trim() === second)

console.log('\nHook script')
const docs = join(tmp, 'Proj')
const appDir = join(docs, 'Proj-app')
mkdirSync(join(docs, '.designkit'), { recursive: true })
mkdirSync(join(docs, '.agents/skills'), { recursive: true })
mkdirSync(join(appDir, 'src'), { recursive: true })
spawnSync('cp', ['-R', SCRIPTS, join(docs, '.designkit/scripts')])
spawnSync('cp', [join(KIT, '.designkit/slop-policy.json'), join(docs, '.designkit/slop-policy.json')])
symlinkSync(join(KIT, '.agents/skills/kill-ai-slop'), join(docs, '.agents/skills/kill-ai-slop'))
writeFileSync(join(docs, '.designkit/workspace.json'), JSON.stringify({ name: 'Proj', app: 'Proj-app' }))
const todo = join(appDir, 'src/todo.ts')
const cleanFile = join(appDir, 'src/clean.ts')
writeFileSync(todo, '// TODO: tidy this up later\nexport const b = 2\n')
writeFileSync(cleanFile, 'export const a = 1\n')
git(docs, 'init', '-q', '-b', 'main')
git(appDir, 'init', '-q', '-b', 'main')
let tick = Math.floor(Date.now() / 1000)
const bump = (file) => utimesSync(file, ++tick + 1000, tick + 1000)
const hook = (event, flag, input, ...files) => {
  bump(todo)
  bump(cleanFile)
  return spawnSync(process.execPath, [join(docs, '.designkit/scripts/hook.mjs'), event, ...(flag ? ['--tool', flag] : []), ...files], { cwd: docs, env, encoding: 'utf8', input: typeof input === 'string' ? input : JSON.stringify(input ?? {}) })
}
const json = (r) => {
  try {
    return JSON.parse(r.stdout)
  } catch {
    return {}
  }
}

const claudeEdit = hook('after-edit', 'claude', { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: todo } })
check('Claude Code: a TODO in the app is blocked', json(claudeEdit).decision === 'block' && /dk-07/.test(json(claudeEdit).reason), claudeEdit.stderr.slice(0, 200))
const patch = '*** Begin Patch\n*** Update File: Proj-app/src/todo.ts\n@@\n-old\n+new\n*** End Patch'
const codexEdit = hook('after-edit', 'codex', { hook_event_name: 'PostToolUse', tool_name: 'apply_patch', cwd: docs, tool_input: { command: patch } })
check('Codex: the file is read out of the patch', json(codexEdit).decision === 'block' && /dk-07/.test(json(codexEdit).reason))
const geminiEdit = hook('after-edit', 'gemini', { hook_event_name: 'AfterTool', tool_name: 'write_file', cwd: docs, tool_input: { file_path: 'Proj-app/src/todo.ts' } })
check('Gemini CLI: a relative path, its own reply format', json(geminiEdit).hookSpecificOutput?.hookEventName === 'AfterTool' && /dk-07/.test(json(geminiEdit).hookSpecificOutput.additionalContext))
const cursorEdit = hook('after-edit', 'claude', { cursor_version: '2.0', hook_event_name: 'postToolUse', tool_name: 'Write', tool_input: { file_path: todo } })
check("Cursor running Claude's hooks still gets Cursor's format", /dk-07/.test(json(cursorEdit).additional_context ?? '') && !('decision' in json(cursorEdit)))
const copilotEdit = hook('after-edit', 'copilot', { sessionId: 's', toolName: 'edit', cwd: docs, toolArgs: JSON.stringify({ path: todo, old_str: 'a', new_str: '// TODO: tidy this up later' }) })
check('Copilot CLI: arguments arrive as a JSON string', /dk-07/.test(json(copilotEdit).additionalContext ?? ''))
const vscodeEdit = hook('after-edit', 'copilot', { hook_event_name: 'PostToolUse', tool_name: 'replace_string_in_file', tool_input: { filePath: todo, newString: '// TODO: tidy this up later' } })
check('Copilot in VS Code: the nested format', json(vscodeEdit).decision === 'block' && /dk-07/.test(json(vscodeEdit).reason))
const byHand = hook('after-edit', null, '', todo)
check('by hand: plain words, exit 0', byHand.status === 0 && /dk-07/.test(byHand.stdout) && !byHand.stdout.trim().startsWith('{'))
check('clean code: silence in every format', ['claude', 'gemini', 'cursor', 'copilot'].every((flag) => hook('after-edit', flag, { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: cleanFile } }).stdout === ''))
check('a tool that only read the file is ignored', hook('after-edit', 'copilot', { hook_event_name: 'PostToolUse', tool_name: 'read_file', tool_input: { filePath: todo } }).stdout === '')
bump(todo)
const same = { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: todo } }
const run = (flag) => spawnSync(process.execPath, [join(docs, '.designkit/scripts/hook.mjs'), 'after-edit', '--tool', flag], { cwd: docs, env, encoding: 'utf8', input: JSON.stringify(same) })
const firstRun = run('cursor')
const secondRun = run('claude')
check('the same edit, twice: the second call says nothing', firstRun.stdout !== '' && secondRun.stdout === '' && secondRun.status === 0)

const deny = (r) => json(r).hookSpecificOutput?.permissionDecision === 'deny' && /by name/.test(json(r).hookSpecificOutput.permissionDecisionReason)
check('Claude Code and Codex: git add -A is refused with the reason', deny(hook('before-command', 'claude', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git add -A' } })) && deny(hook('before-command', 'codex', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'cd Proj-app && git add .' } })))
const geminiDeny = json(hook('before-command', 'gemini', { hook_event_name: 'BeforeTool', tool_name: 'run_shell_command', tool_input: { command: 'git push --force' } }))
check('Gemini CLI: refused in its format', geminiDeny.decision === 'deny' && /force/.test(geminiDeny.reason))
const cursorDeny = json(hook('before-command', 'cursor', { cursor_version: '2.0', hook_event_name: 'beforeShellExecution', command: 'git push -f' }))
check('Cursor: refused, the agent and the designer both get the reason', cursorDeny.permission === 'deny' && /force/.test(cursorDeny.agent_message) && cursorDeny.user_message === cursorDeny.agent_message)
const claudeFigma = json(hook('before-command', 'claude', { hook_event_name: 'PreToolUse', tool_name: 'mcp__plugin_figma_figma__use_figma', tool_input: {} }))
check('Claude Code: a Figma write under a plugin server name is refused', claudeFigma.hookSpecificOutput?.permissionDecision === 'deny')
const cursorFigma = json(hook('before-command', 'cursor', { cursor_version: '2.0', hook_event_name: 'beforeMCPExecution', tool_name: 'use_figma', mcp_server_name: 'figma', tool_input: '{}' }))
check('Cursor: a Figma write tool is refused', cursorFigma.permission === 'deny' && /read-only/.test(cursorFigma.agent_message))
const copilotDeny = json(hook('before-command', 'copilot', { sessionId: 's', toolName: 'bash', toolArgs: '{"command":"git commit -n -m x"}' }))
check('Copilot CLI: refused in its format', copilotDeny.permissionDecision === 'deny' && /commit check/.test(copilotDeny.permissionDecisionReason))
const plainDeny = hook('before-command', 'opencode', { command: 'git add .' })
check('plain: exit 2 and the reason on stderr', plainDeny.status === 2 && /by name/.test(plainDeny.stderr) && plainDeny.stdout === '')
check('an ordinary command passes in every format', ['claude', 'codex', 'gemini', 'cursor', 'copilot', 'opencode'].every((flag) => {
  const r = hook('before-command', flag, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git status' } })
  return r.status === 0 && r.stdout === ''
}))
check('an edit tool is never read as a command', hook('before-command', 'copilot', { hook_event_name: 'PreToolUse', tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n git add -A\n*** End Patch' } }).stdout === '')
check('unknown input: no crash, no block', ['session-start', 'before-command', 'after-edit'].every((event) => {
  const r = hook(event, event === 'session-start' ? 'cursor' : 'claude', event === 'session-start' ? { cursor_version: '2', conversation_id: 'x1' } : 'this is not json')
  return r.status === 0 && (event === 'session-start' || r.stdout === '')
}))

const startClaude = hook('session-start', 'claude', { hook_event_name: 'SessionStart', session_id: 'c1', source: 'startup' })
const startText = json(startClaude).hookSpecificOutput?.additionalContext ?? ''
check('start of a chat: says the checks are on, then what the sync found', /checks are on/.test(startText) && /no GitHub home/.test(startText), startClaude.stdout.slice(0, 200) + startClaude.stderr.slice(0, 200))
check('the same chat starting twice syncs once', hook('session-start', 'cursor', { cursor_version: '2', conversation_id: 'c1' }).stdout === '')
const startByHand = hook('session-start', null, '')
check('by hand: says it was by hand and what to run after each save', /by hand/.test(startByHand.stdout) && /after-edit/.test(startByHand.stdout))
const startOpencode = hook('session-start', 'opencode', { session_id: 'o1' })
check('through the OpenCode plugin: plain text, checks on', /checks are on/.test(startOpencode.stdout) && !startOpencode.stdout.trim().startsWith('{'))

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
