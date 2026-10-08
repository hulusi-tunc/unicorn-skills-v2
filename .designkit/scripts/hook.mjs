#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { figmaWrite, refusal } from './guard.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const LOCKS = join(ROOT, '.designkit/state/hooks')
const EDITS = /^(?:write|edit|multiedit|notebookedit|apply_patch|patch|write_file|replace|create|str_replace_editor|create_file|replace_string_in_file|insert_edit_into_file|multi_replace_string_in_file)$/i
const FIGMA = 'Figma is read-only here: this tool writes to Figma. Read the design and build it in code instead. A Figma-first project opens writes with: node .designkit/scripts/tools.mjs --pull figma'
const ON = 'Design kit: checks are on (sync at the start of the chat, slop check after every save in the app, command guard).'
const BY_HAND = 'Design kit: synced by hand. This tool runs no checks by itself: after every save in the app run node .designkit/scripts/hook.mjs after-edit <file> and fix what it names.'
const USAGE = 'usage: hook.mjs session-start | before-command | after-edit [file ...] [--tool <name>]'

const [event, ...rest] = process.argv.slice(2)
const flag = rest.includes('--tool') ? rest[rest.indexOf('--tool') + 1] : 'plain'
const named = rest.filter((a, i) => !a.startsWith('--') && rest[i - 1] !== '--tool')

/* Input */
const parse = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
const record = (value) => {
  const v = typeof value === 'string' ? parse(value) : value
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}
const stdin = () => {
  if (process.stdin.isTTY) return ''
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}
const input = record(stdin())
const args = record(input.toolArgs)
const ti = record(input.tool_input)
const tool = String(input.tool_name ?? input.toolName ?? input.tool ?? '')
const cwd = String(input.cwd ?? process.cwd())
const patch = [ti.command, ti.input, ti.patchText, input.toolArgs].find((t) => typeof t === 'string' && t.includes('*** Begin Patch')) ?? ''
const dialect =
  input.cursor_version !== undefined || flag === 'cursor'
    ? 'cursor'
    : input.hook_event_name === 'BeforeTool' || input.hook_event_name === 'AfterTool' || flag === 'gemini'
      ? 'gemini'
      : input.hook_event_name
        ? 'nested'
        : input.toolName !== undefined || input.sessionId !== undefined || flag === 'copilot'
          ? 'flat'
          : flag === 'claude' || flag === 'codex'
            ? 'nested'
            : 'plain'
const byHand = dialect === 'plain' && flag !== 'opencode'

/* Output */
const print = (value) => process.stdout.write(typeof value === 'string' ? value : JSON.stringify(value))
const SAY = {
  nested: (name, text) => print({ hookSpecificOutput: { hookEventName: name, additionalContext: text } }),
  gemini: (name, text) => print({ hookSpecificOutput: { hookEventName: name === 'PostToolUse' ? 'AfterTool' : name, additionalContext: text } }),
  cursor: (name, text) => print({ additional_context: text }),
  flat: (name, text) => print({ additionalContext: text }),
  plain: (name, text) => print(`${text}\n`),
}
const FIX = { ...SAY, nested: (name, text) => print({ decision: 'block', reason: text }) }
const DENY = {
  nested: (reason) => print({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }),
  gemini: (reason) => print({ decision: 'deny', reason }),
  cursor: (reason) => print({ permission: 'deny', user_message: reason, agent_message: reason }),
  flat: (reason) => print({ permissionDecision: 'deny', permissionDecisionReason: reason }),
  plain: (reason) => {
    console.error(reason)
    process.exitCode = 2
  },
}

/* Once */
function first(key, seconds) {
  const file = join(LOCKS, createHash('sha1').update(key).digest('hex').slice(0, 20))
  try {
    mkdirSync(LOCKS, { recursive: true })
    if (existsSync(file) && Date.now() - statSync(file).mtimeMs >= seconds * 1000) unlinkSync(file)
    writeFileSync(file, '', { flag: 'wx' })
    return true
  } catch (error) {
    return error.code !== 'EEXIST'
  }
}

function tidy() {
  try {
    for (const name of readdirSync(LOCKS)) if (Date.now() - statSync(join(LOCKS, name)).mtimeMs > 86400000) unlinkSync(join(LOCKS, name))
  } catch {}
}

/* Events */
const node = (script, list, stdin = '') => spawnSync(process.execPath, [join(HERE, script), ...list], { cwd: ROOT, encoding: 'utf8', input: stdin, maxBuffer: 16 * 1024 * 1024 })

function sessionStart() {
  const session = String(input.session_id ?? input.sessionId ?? input.conversation_id ?? '')
  if (!byHand && !first(`start:${session}`, 20)) return
  tidy()
  const lines = [byHand ? BY_HAND : ON]
  for (const [script, list] of [['team-sync.mjs', ['--start']], ['review-due.mjs', []], ['prompts.mjs', ['--due']]]) {
    const out = (node(script, list).stdout ?? '').trim()
    if (out) lines.push(out)
  }
  SAY[dialect]('SessionStart', lines.join('\n'))
}

const figmaOpen = () => {
  try {
    return JSON.parse(readFileSync(join(ROOT, '.designkit/workspace.json'), 'utf8')).figma === 'write'
  } catch {
    return false
  }
}

function beforeCommand() {
  if (EDITS.test(tool)) return
  const name = input.mcp_server_name ? `${input.mcp_server_name}__${tool}` : tool
  const command = [ti.command, args.command, input.command].find((c) => typeof c === 'string') ?? ''
  const reason = figmaWrite(name) && !figmaOpen() ? FIGMA : refusal(command)
  if (reason) DENY[dialect](reason)
}

function files() {
  const found = [ti.file_path, ti.filePath, ti.path, args.path, args.filePath, input.file_path, input.file, input.tool_response?.filePath, ...named]
  for (const r of Array.isArray(ti.replacements) ? ti.replacements : []) found.push(r?.filePath)
  for (const m of patch.matchAll(/^\*\*\* (?:Add File|Update File|Move to): (.+)$/gm)) found.push(m[1].trim())
  return [...new Set(found.filter((f) => typeof f === 'string' && f).map((f) => (isAbsolute(f) ? f : resolve(cwd, f))))]
}

function afterEdit() {
  if (tool && !EDITS.test(tool)) return
  const news = [ti.new_string, ti.new_str, ti.newString, args.new_str].find((s) => typeof s === 'string' && s)
  const edits = [ti.edits, input.edits].find(Array.isArray)
  const blocks = []
  const notes = []
  for (const file of files()) {
    const stat = statSync(file, { throwIfNoEntry: false })
    if (!stat?.isFile()) continue
    if (!byHand && !first(`edit:${file}:${stat.mtimeMs}:${stat.size}`, 10)) continue
    const shaped = edits ? { tool_name: 'MultiEdit', tool_input: { file_path: file, edits } } : news ? { tool_name: 'Edit', tool_input: { file_path: file, new_string: news } } : { tool_name: 'Write', tool_input: { file_path: file } }
    const out = record(node('slop-gate.mjs', ['--hook'], JSON.stringify(shaped)).stdout)
    if (out.decision === 'block') blocks.push(out.reason)
    else if (out.hookSpecificOutput?.additionalContext) notes.push(out.hookSpecificOutput.additionalContext)
  }
  if (blocks.length) FIX[dialect]('PostToolUse', [...blocks, ...notes].join('\n\n'))
  else if (notes.length) SAY[dialect]('PostToolUse', notes.join('\n\n'))
}

try {
  if (event === 'session-start') sessionStart()
  else if (event === 'before-command') beforeCommand()
  else if (event === 'after-edit') afterEdit()
  else console.error(USAGE)
} catch (error) {
  if (event === 'after-edit') SAY[dialect]('PostToolUse', `The slop check could not run (${error.message}). Tell the user it needs attention: node .designkit/scripts/slop-gate.mjs --self-test. Do not describe the file as checked.`)
}
