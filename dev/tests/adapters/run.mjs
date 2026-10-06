#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const { sync, SHARED } = await import(join(KIT, '.designkit/scripts/adapters.mjs'))
const tmp = mkdtempSync(join(tmpdir(), 'adapter-tests-'))
let passed = 0
let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) passed++
  else failed++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n        ${detail}`}`)
}
const put = (root, file, text) => {
  mkdirSync(dirname(join(root, file)), { recursive: true })
  writeFileSync(join(root, file), text)
}
const text = (root, file) => (existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : '')
const data = (root, file) => {
  try {
    return JSON.parse(text(root, file) || '{}')
  } catch {
    return {}
  }
}
const seed = (name) => {
  const root = join(tmp, name)
  put(root, '.agents/skills/setup/SKILL.md', '---\nname: setup\ndescription: Once per project: ask, write it down, scaffold.\n---\n# /setup\n')
  put(root, '.agents/skills/no-slop/SKILL.md', '---\nname: no-slop\ndescription: Anti-slop guardrails.\n---\n')
  put(root, '.designkit/agents/bug-hunter.md', "---\nname: bug-hunter\ndescription: Runs every automated check the app has; never launched unasked.\nmodel: fast\nedits: true\nskills:\n  - no-slop\n---\n\nMake the tools find bugs; never guess.\nUse `rg -n '\\bName\\b' src`.\n")
  put(root, '.designkit/agents/code-reviewer.md', '---\nname: code-reviewer\ndescription: Judges whether the app is clean enough to hand over.\nmodel: strong\nedits: false\n---\n\nReview for the developer who receives this code.\n')
  put(root, '.designkit/plugins/opencode.js', readFileSync(join(KIT, '.designkit/plugins/opencode.js'), 'utf8'))
  put(root, '.mcp.json', JSON.stringify({ mcpServers: { 'chrome-devtools': { command: 'npx', args: ['-y', 'chrome-devtools-mcp@1.10.1', '--flag'] }, figma: { type: 'http', url: 'https://mcp.figma.com/mcp' } } }))
  return root
}

console.log('A fresh folder')
const a = seed('fresh')
const made = sync(a)
check('skills are linked for Claude Code', !!lstatSync(join(a, '.claude/skills/setup'), { throwIfNoEntry: false })?.isSymbolicLink())
const claude = text(a, '.claude/agents/bug-hunter.md')
check('Claude Code reviewer: tools, a fast model, its skills loaded', /^tools: Bash, Read, Glob, Grep, Write, Edit$/m.test(claude) && /^model: sonnet$/m.test(claude) && /^skills:\n  - no-slop$/m.test(claude) && claude.endsWith("Use `rg -n '\\bName\\b' src`.\n"))
check('the strong reviewer gets the strong model and no Edit tool', /^model: opus$/m.test(text(a, '.claude/agents/code-reviewer.md')) && /^tools: Bash, Read, Glob, Grep, Write$/m.test(text(a, '.claude/agents/code-reviewer.md')))
const codex = text(a, '.codex/agents/bug-hunter.toml')
check('Codex reviewer: the three keys, the brief untouched', /^name = "bug-hunter"$/m.test(codex) && /^description = "Runs every/m.test(codex) && codex.includes("developer_instructions = '''\n") && codex.includes("`rg -n '\\bName\\b' src`") && codex.includes('.agents/skills/no-slop/SKILL.md'))
check('Gemini reviewer: only the keys its strict format allows', text(a, '.gemini/agents/bug-hunter.md').startsWith('---\nname: bug-hunter\ndescription: Runs every automated check the app has; never launched unasked.\nkind: local\n---\n'))
check('Cursor reviewer inherits the model', /^model: inherit$/m.test(text(a, '.cursor/agents/bug-hunter.md')))
check('Copilot and OpenCode reviewers', text(a, '.github/agents/bug-hunter.agent.md').startsWith('---\nname: bug-hunter\n') && /^mode: subagent$/m.test(text(a, '.opencode/agents/bug-hunter.md')) && !/^name:/m.test(text(a, '.opencode/agents/bug-hunter.md')))
const events = (hooks) => Object.keys(hooks ?? {}).sort().join()
const calls = (value) => JSON.stringify(value ?? '').includes('.designkit/scripts/hook.mjs')
check('Codex hooks: three events, seconds', events(data(a, '.codex/hooks.json').hooks) === 'PostToolUse,PreToolUse,SessionStart' && data(a, '.codex/hooks.json').hooks.PostToolUse[0].matcher === 'apply_patch' && data(a, '.codex/hooks.json').hooks.SessionStart[0].hooks[0].timeout === 90)
check('Cursor hooks: version 1, shell, MCP and edit events', data(a, '.cursor/hooks.json').version === 1 && events(data(a, '.cursor/hooks.json').hooks) === 'beforeMCPExecution,beforeShellExecution,postToolUse,sessionStart' && data(a, '.cursor/hooks.json').hooks.postToolUse[0].matcher === 'Write')
check('Copilot hooks: its own file', data(a, '.github/hooks/designkit.json').version === 1 && data(a, '.github/hooks/designkit.json').hooks?.preToolUse[0].timeoutSec === 10 && calls(data(a, '.github/hooks/designkit.json')))
const gemini = data(a, '.gemini/settings.json')
check('Gemini settings: reads AGENTS.md, three hooks in milliseconds, both servers', !!gemini.context?.fileName.includes('AGENTS.md') && events(gemini.hooks) === 'AfterTool,BeforeTool,SessionStart' && gemini.hooks.SessionStart[0].hooks[0].timeout === 90000 && gemini.mcpServers.figma.url === 'https://mcp.figma.com/mcp' && gemini.mcpServers.figma.type === 'http' && gemini.mcpServers['chrome-devtools'].command === 'npx')
check('every hook command exits quietly when the script or Node is missing', [data(a, '.codex/hooks.json'), data(a, '.cursor/hooks.json'), data(a, '.github/hooks/designkit.json'), gemini.hooks].every((v) => JSON.stringify(v ?? '').includes('|| exit 0')))
const command = text(a, '.gemini/commands/setup.toml')
check('Gemini command for each workflow that exists', command.startsWith('description = "Once per project: ask, write it down, scaffold."\nprompt = """') && command.includes('{{args}}') && command.includes('.agents/skills/setup/SKILL.md') && !existsSync(join(a, '.gemini/commands/tokenize.toml')))
const toml = text(a, '.codex/config.toml')
check('Codex MCP servers', toml.includes('[mcp_servers.chrome-devtools]\ncommand = "npx"\nargs = ["-y", "chrome-devtools-mcp@1.10.1", "--flag"]') && toml.includes('[mcp_servers.figma]\nurl = "https://mcp.figma.com/mcp"'))
check('Cursor and OpenCode MCP servers', data(a, '.cursor/mcp.json').mcpServers?.figma.url === 'https://mcp.figma.com/mcp' && data(a, 'opencode.json').mcp?.['chrome-devtools'].type === 'local' && data(a, 'opencode.json').mcp['chrome-devtools'].command.join(' ') === 'npx -y chrome-devtools-mcp@1.10.1 --flag' && data(a, 'opencode.json').mcp.figma.type === 'remote')
const plugin = existsSync(join(a, '.opencode/plugins/designkit.js')) ? await import(pathToFileURL(join(a, '.opencode/plugins/designkit.js')).href) : {}
check('the OpenCode plugin loads and exports only its plugin function', Object.keys(plugin).join() === 'DesignKit' && typeof plugin.DesignKit === 'function')
check('it reports what it made', made.added.includes('.codex/hooks.json') && made.added.includes('.claude/skills/setup') && made.updated.length === 0 && made.kept.length === 0)
const again = sync(a)
check('running it again changes nothing', again.added.length === 0 && again.updated.length === 0)
rmSync(join(a, '.cursor/hooks.json'), { force: true })
const dry = sync(a, { write: false })
check('--check mode writes nothing', dry.added.includes('.cursor/hooks.json') && !existsSync(join(a, '.cursor/hooks.json')))

console.log('\nA project with its own tool files')
const b = seed('own')
put(b, '.cursor/hooks.json', JSON.stringify({ version: 1, hooks: { postToolUse: [{ command: 'echo mine' }], stop: [{ command: 'echo bye' }] } }))
put(b, '.gemini/settings.json', JSON.stringify({ theme: 'dark', context: { fileName: 'GEMINI.md' }, mcpServers: { mine: { command: 'x' } } }))
put(b, '.codex/config.toml', 'model = "gpt-5"\n\n[mcp_servers.mine]\ncommand = "x"\n')
put(b, '.claude/agents/bug-hunter.md', 'mine\n')
put(b, 'opencode.json', '{\n  // my notes\n  "theme": "x"\n}\n')
const merged = sync(b, { owns: () => false })
const cur = data(b, '.cursor/hooks.json').hooks ?? {}
check('Cursor: their hooks stay, ours are added', cur.postToolUse?.[0].command === 'echo mine' && calls(cur.postToolUse?.[1]) && cur.stop?.[0].command === 'echo bye' && calls(cur.sessionStart))
const gem = data(b, '.gemini/settings.json')
check('Gemini: their settings stay, AGENTS.md joins their context file', gem.theme === 'dark' && gem.context?.fileName.join() === 'AGENTS.md,GEMINI.md' && gem.mcpServers?.mine.command === 'x' && !!gem.mcpServers?.figma)
check('Codex: their config stays, our servers are appended', text(b, '.codex/config.toml').startsWith('model = "gpt-5"\n\n[mcp_servers.mine]\ncommand = "x"\n') && text(b, '.codex/config.toml').includes('[mcp_servers.figma]'))
check('a reviewer they wrote is kept and named', text(b, '.claude/agents/bug-hunter.md') === 'mine\n' && merged.kept.includes('.claude/agents/bug-hunter.md'))
check('a settings file this cannot read is kept and named, never overwritten', text(b, 'opencode.json').includes('// my notes') && merged.kept.includes('opencode.json'))
const twice = sync(b, { owns: () => false })
check('merging twice adds nothing twice', twice.added.length === 0 && twice.updated.length === 0 && data(b, '.cursor/hooks.json').hooks?.postToolUse.length === 2)
const c = seed('hands-off')
put(c, '.cursor/hooks.json', '{"version":1,"hooks":{}}')
const off = sync(c, { merge: false })
check('merge off: existing shared files are left alone and named', text(c, '.cursor/hooks.json') === '{"version":1,"hooks":{}}' && off.kept.includes('.cursor/hooks.json') && existsSync(join(c, '.codex/hooks.json')))
check('the shared files are listed for callers that must restore them', ['.codex/hooks.json', '.codex/config.toml', '.cursor/hooks.json', '.cursor/mcp.json', '.gemini/settings.json', 'opencode.json'].every((f) => (SHARED ?? []).includes(f)))

console.log('\nThe OpenCode plugin against the real hook script')
const d = seed('plugin')
spawnSync('cp', ['-R', join(KIT, '.designkit/scripts'), join(d, '.designkit/scripts')])
spawnSync('cp', [join(KIT, '.designkit/slop-policy.json'), join(d, '.designkit/slop-policy.json')])
spawnSync('ln', ['-s', join(KIT, '.agents/skills/kill-ai-slop'), join(d, '.agents/skills/kill-ai-slop')])
put(d, '.designkit/workspace.json', JSON.stringify({ name: 'P', app: 'P-app' }))
put(d, 'P-app/src/todo.ts', '// TODO: tidy this up later\nexport const b = 2\n')
spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: join(d, 'P-app') })
sync(d)
const loaded = existsSync(join(d, '.opencode/plugins/designkit.js')) ? await import(`${pathToFileURL(join(d, '.opencode/plugins/designkit.js')).href}?live`) : null
const live = loaded ? await loaded.DesignKit({ directory: d, worktree: d }) : null
let thrown = ''
await live?.['tool.execute.before']({ tool: 'bash' }, { args: { command: 'git add -A' } }).catch((error) => (thrown = error.message))
check('a refused command throws the reason', /by name/.test(thrown))
let quiet = !!live
await live?.['tool.execute.before']({ tool: 'bash' }, { args: { command: 'git status' } }).catch(() => (quiet = false))
check('an ordinary command passes', quiet)
const result = { title: '', output: 'Wrote file', metadata: {} }
await live?.['tool.execute.after']({ tool: 'write', args: { filePath: join(d, 'P-app/src/todo.ts') } }, result)
check('after a save, the slop finding is added to what the model reads', result.output.startsWith('Wrote file') && /dk-07/.test(result.output))
const system = { system: [] }
await live?.['experimental.chat.system.transform']({ sessionID: 's1' }, system)
check('the first request of a chat carries the start line', /checks are on/.test(system.system.join('\n')))

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
