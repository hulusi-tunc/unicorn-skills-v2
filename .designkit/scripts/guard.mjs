import { basename } from 'node:path'

const ALL = 'Stage files by name. `git add -A`, `--all` and `.` are refused here: they sweep in files nobody read.'
const SKIP = 'Never skip the commit check. Fix what it names, stage the fix and commit again.'
const IGNORED = 'Never force-add a file git ignores here: it is left out on purpose (in a repository a developer works in, the design notes stay on this Mac). Stage only what git accepts.'
const FORCE = 'Never force a push or rewrite shared history. Pull first: node .designkit/scripts/team-sync.mjs --share'
const WRAPPERS = new Set(['command', 'exec', 'sudo', 'doas', 'time', 'nohup', 'env', 'builtin', 'timeout', 'nice', 'ionice', 'caffeinate', 'stdbuf', 'chronic'])
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash'])
const GIT_VALUES = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env'])
const COMMIT_VALUES = new Set(['-m', '-F', '-C', '-c', '-t', '--message', '--file', '--reuse-message', '--reedit-message', '--template', '--author', '--date', '--fixup', '--squash', '--cleanup', '--trailer', '--pathspec-from-file'])
const SWEEP = /^(?:\.\/?|\*+|:\/?\**|:\([^)]*\)\/?\**|:[!^].*)$/
const HOOKS_KEY = /^core\.hookspath$/i
const FIGMA_WRITES = /(?:^|[_/:.-])(?:use_figma|create_new_file|upload_assets|generate_figma_design|generate_diagram|add_code_connect_map|send_code_connect_mappings|create_generative_plugin|update_generative_plugin|create_shader|update_shader)$/

/* Shell */
function parse(command) {
  const segments = [[]]
  const inner = []
  let token = ''
  let open = false
  let quote = null
  let quoted = ''
  const push = () => {
    if (open) segments.at(-1).push(token)
    token = ''
    open = false
  }
  const cut = () => {
    push()
    if (segments.at(-1).length) segments.push([])
  }
  for (let i = 0; i < command.length; i++) {
    const c = command[i]
    if (quote) {
      if (c === quote) {
        if (quote === '"' && /\$\(|`/.test(quoted)) inner.push(quoted)
        quote = null
      } else if (c === '\\' && quote === '"' && i + 1 < command.length) {
        token += command[++i]
        quoted += command[i]
      } else {
        token += c
        quoted += c
      }
      continue
    }
    if (c === "'" || c === '"') {
      quote = c
      quoted = ''
      open = true
    } else if (c === '\\' && command[i + 1] === '\n') i++
    else if (c === '\\' && i + 1 < command.length) {
      token += command[++i]
      open = true
    } else if (c === '\n' || ';&|()`{}'.includes(c)) cut()
    else if (c === '$' && command[i + 1] === '(') {
      cut()
      i++
    } else if (/\s/.test(c)) push()
    else {
      token += c
      open = true
    }
  }
  cut()
  return { segments: segments.filter((s) => s.length), inner }
}

function gitCall(tokens) {
  let i = 0
  const env = []
  let wrapped = false
  while (i < tokens.length) {
    const t = tokens[i]
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) env.push(t)
    else if (WRAPPERS.has(t)) wrapped = true
    else if (!(wrapped && (t.startsWith('-') || /^\d+(?:\.\d+)?[smhd]?$/.test(t)))) break
    i++
  }
  if (i >= tokens.length) return null
  const program = basename(tokens[i])
  if (program === 'export') return { env: tokens.slice(i + 1), config: [], sub: null, args: [] }
  if (SHELLS.has(program) || program === 'eval') {
    const at = program === 'eval' ? i : tokens.findIndex((t, n) => n > i && /^-[A-Za-z]*c[A-Za-z]*$/.test(t))
    return at < 0 ? null : { script: tokens.slice(at + 1).join(' ') }
  }
  if (program !== 'git') return null
  i++
  const config = []
  while (i < tokens.length && tokens[i].startsWith('-')) {
    if (tokens[i] === '-c' || tokens[i] === '--config-env') config.push(tokens[i + 1] ?? '')
    if (tokens[i].startsWith('--config-env=')) config.push(tokens[i].slice('--config-env='.length))
    i += GIT_VALUES.has(tokens[i]) ? 2 : 1
  }
  return { env, config, sub: tokens[i], args: tokens.slice(i + 1) }
}

/* Verdict */
const cluster = (list, letter) => list.some((a) => /^-[A-Za-z]+$/.test(a) && a.includes(letter))
const abbrev = (list, full, min) => list.some((a) => a.length >= min && full.startsWith(a.split('=')[0]))
const aliased = (value) => (value.startsWith('!') ? refusal(value.slice(1), 1) : refusal(`git ${value}`, 1))

function judge({ env, config, sub, args }) {
  const flags = args.filter((a, n) => a.startsWith('-') && !(sub === 'commit' && COMMIT_VALUES.has(args[n - 1])))
  if (config.some((c) => /^core\.hookspath=/i.test(c)) || env.includes('HUSKY=0') || abbrev(flags, '--no-verify', 6)) return SKIP
  if (env.some((e) => /^GIT_CONFIG_(?:KEY_\d+|PARAMETERS)=.*core\.hookspath/i.test(e))) return SKIP
  for (const c of config) {
    const alias = /^alias\.[^=]+=(.+)$/i.exec(c)
    if (alias && aliased(alias[1])) return aliased(alias[1])
  }
  if (sub === 'config') {
    const key = args.findIndex((a) => HOOKS_KEY.test(a))
    if (key >= 0 && (args.length > key + 1 || args.some((a) => /^(?:--)?(?:unset|unset-all|set|replace-all)$/.test(a)))) return SKIP
    const alias = args.findIndex((a) => /^alias\./i.test(a))
    if (alias >= 0 && args[alias + 1] && aliased(args[alias + 1])) return aliased(args[alias + 1])
  }
  if (sub === 'commit' && cluster(flags, 'n')) return SKIP
  if ((sub === 'add' || sub === 'stage') && (args.some((a) => SWEEP.test(a)) || abbrev(flags, '--all', 3) || cluster(flags, 'A'))) return ALL
  if ((sub === 'add' || sub === 'stage') && (abbrev(flags, '--force', 4) || cluster(flags, 'f'))) return IGNORED
  if (sub === 'push' && (abbrev(flags, '--force', 5) || flags.some((a) => a.startsWith('--force')) || abbrev(flags, '--mirror', 4) || args.some((a) => /^\+./.test(a)) || cluster(flags, 'f'))) return FORCE
  return null
}

export function refusal(command, depth = 0) {
  if (typeof command !== 'string' || !command.trim() || depth > 3) return null
  const { segments, inner } = parse(command)
  for (const tokens of segments) {
    const call = gitCall(tokens)
    const found = call?.script !== undefined ? refusal(call.script, depth + 1) : call ? judge(call) : null
    if (found) return found
  }
  for (const text of inner) {
    const found = refusal(text, depth + 1)
    if (found) return found
  }
  return null
}

export const figmaWrite = (tool) => /figma/i.test(String(tool)) && FIGMA_WRITES.test(String(tool))
