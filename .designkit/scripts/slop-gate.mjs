#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isKitPath } from './kit-paths.mjs'

const real = (p) => (existsSync(p) ? realpathSync(p) : p)
const DOCS = real(resolve(dirname(fileURLToPath(import.meta.url)), '../..'))
const SCANNER = join(DOCS, '.agents/skills/kill-ai-slop/scripts/scan.mjs')
const RULES = join(DOCS, '.designkit/scripts/slop-rules.mjs')
const JS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'])
const JSX = new Set(['.tsx', '.jsx', '.js'])
const MARKUP = new Set(['.html', '.vue', '.svelte', '.astro'])
const STYLE = new Set(['.css', '.scss'])
const CODE = new Set([...JS, ...MARKUP, ...STYLE])
const PROSE = new Set(['.md', '.mdx'])
const UI_IMPORT = /^\s*(?:import|export)\b[^'"\n]*['"](?:[^'"\n]*\/)?components\/ui(?:\/[^'"\n]*)?['"]|\brequire\(\s*['"](?:[^'"\n]*\/)?components\/ui(?:\/[^'"\n]*)?['"]/
const MOCK_IMPORT = /^\s*(?:import|export)\b[^'"\n]*['"](?:[^'"\n]*\/)?api\/mock(?:\/[^'"\n]*)?['"]|\brequire\(\s*['"](?:[^'"\n]*\/)?api\/mock(?:\/[^'"\n]*)?['"]/
const CONFIG_JSON = new Set(['package.json', 'package-lock.json', 'tsconfig.json', 'jsconfig.json', 'app.json', 'eas.json', 'components.json', 'vercel.json', 'turbo.json', 'knip.json', '.prettierrc.json', '.lintstagedrc.json', '.eslintrc.json'])
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.expo', 'ios', 'android', 'coverage', '.turbo', '.vercel', '.cache', 'vendor'])

const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

const policy = readJson(join(DOCS, '.designkit/slop-policy.json'), {})
const workspace = readJson(join(DOCS, '.designkit/workspace.json'), {})
const HARD = new Set(workspace.joined ? [] : ['dk-05', 'dk-07'])
const APP = workspace.app ? real(resolve(DOCS, workspace.app)) : null
const BLOCK = new Set(policy.block ?? [])
const SKIP = new Set((policy.skip ?? []).filter((id) => !HARD.has(id)))
const kitFile = (label) => !!workspace.joined && isKitPath(label)
const EXCLUDE = policy.excludePaths ?? []
let TELLS = []
let META = {}
let COPY_TELLS = []
let loadError = null
try {
  const rules = await import(pathToFileURL(RULES).href)
  TELLS = rules.default
  META = Object.fromEntries([...TELLS, ...(rules.gateRules ?? [])].map((r) => [r.id, { name: r.name, fix: r.fix }]))
  COPY_TELLS = TELLS.filter((t) => ['dk-01', 'dk-02', 'dk-03'].includes(t.id))
} catch (error) {
  loadError = new Error(`could not load ${relative(DOCS, RULES)}: ${error.message}`)
}

const inside = (parent, child) => {
  const rel = relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(sep)
}
const slash = (p) => p.split(sep).join('/')
const labelFor = (abs) => slash(APP && inside(APP, abs) ? relative(APP, abs) : relative(process.cwd(), abs))
const excluded = (label) => EXCLUDE.some((p) => label.startsWith(p)) || label.split('/').some((part) => SKIP_DIRS.has(part)) || kitFile(label)
const lineAt = (src, index) => src.slice(0, index).split('\n').length
const level = (hit) => (HARD.has(hit.id) || BLOCK.has(hit.id) ? 'block' : 'warn')

function kindOf(label) {
  const ext = extname(label)
  if (CODE.has(ext)) return 'code'
  if (PROSE.has(ext)) return 'prose'
  if (ext === '.json' && label.includes('/') && !CONFIG_JSON.has(basename(label))) return 'json'
  return null
}

function git(args, cwd) {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return run.status === 0 ? run.stdout : null
}

/* Suppression */
function suppressor(src) {
  const byLine = new Map()
  let file
  const ids = (tail) => {
    const list = (tail.match(/[\w-]+/g) ?? []).filter((t) => /\d/.test(t)).map((t) => (/^\d+$/.test(t) ? t.padStart(2, '0') : t))
    return list.length ? new Set(list) : null
  }
  src.split(/\r?\n/).forEach((text, i) => {
    const m = text.match(/deslop-ignore(-file|-next-line)?\b(.*)$/)
    if (!m) return
    const set = ids(m[2])
    if (m[1] === '-file') {
      if (set === null || file === null) file = null
      else file = new Set([...(file ?? []), ...set])
      return
    }
    const at = m[1] === '-next-line' ? i + 2 : i + 1
    if (set === null || byLine.get(at) === null) byLine.set(at, null)
    else byLine.set(at, new Set([...(byLine.get(at) ?? []), ...set]))
  })
  return (id, line) => {
    if (HARD.has(id)) return false
    if (file === null || file?.has(id)) return true
    const s = byLine.get(line)
    return s === null || (s !== undefined && s.has(id))
  }
}

/* TypeScript */
const tsCache = new Map()
const usable = (mod) => !!mod && typeof mod.createSourceFile === 'function' && !!mod.ScriptTarget && !!mod.ScriptKind && typeof mod.getLeadingCommentRanges === 'function'
function loadTs(abs) {
  const bases = [join(DOCS, '.designkit/scripts/package.json'), abs && join(dirname(abs), 'noop.js'), APP && join(APP, 'noop.js')].filter(Boolean)
  for (const base of bases) {
    const key = dirname(base)
    if (!tsCache.has(key)) {
      let mod = null
      try {
        mod = createRequire(base)('typescript')
      } catch {}
      tsCache.set(key, usable(mod) ? mod : null)
    }
    if (tsCache.get(key)) return tsCache.get(key)
  }
  return null
}

function scriptKind(ts, ext) {
  if (ext === '.tsx') return ts.ScriptKind.TSX
  if (['.jsx', '.js'].includes(ext)) return ts.ScriptKind.JSX
  if (['.mjs', '.cjs'].includes(ext)) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

/* Comments */
function tsComments(ts, ext, src, offset) {
  const sf = ts.createSourceFile(`x${ext}`, src, ts.ScriptTarget.Latest, true, scriptKind(ts, ext))
  const ranges = new Map()
  const jsxText = []
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.JsxText) {
      jsxText.push([node.pos, node.end])
      return
    }
    for (const r of ts.getLeadingCommentRanges(src, node.pos) ?? []) ranges.set(r.pos, r)
    for (const r of ts.getTrailingCommentRanges(src, node.end) ?? []) ranges.set(r.pos, r)
    for (const child of node.getChildren(sf)) visit(child)
  }
  visit(sf)
  const firstCode = sf.statements.length ? sf.statements[0].getStart(sf) : src.length
  return [...ranges.values()]
    .filter((r) => !jsxText.some(([a, b]) => r.pos >= a && r.pos < b))
    .sort((a, b) => a.pos - b.pos)
    .map((r) => ({
      line: sf.getLineAndCharacterOfPosition(r.pos).line + 1 + offset,
      raw: src.slice(r.pos, r.end),
      body: src.slice(r.pos + 2, r.kind === ts.SyntaxKind.MultiLineCommentTrivia ? r.end - 2 : r.end),
      header: r.pos < firstCode,
    }))
}

function lexComments(src, mode, offset = 0) {
  const found = []
  const n = src.length
  let line = 1
  let i = 0
  let codeSeen = false
  const regexCanStart = () => {
    let j = i - 1
    while (j >= 0 && /\s/.test(src[j])) j--
    if (j < 0) return true
    if (src[i - 1] === '<') return false
    if ('(,=:[!&|?{};+-*%<>~^'.includes(src[j])) return true
    const word = src.slice(Math.max(0, j - 10), j + 1).match(/[A-Za-z_$]+$/)
    return !!word && ['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'yield', 'await', 'else', 'do'].includes(word[0])
  }
  while (i < n) {
    const c = src[i]
    const d = src[i + 1]
    if (c === '\n') {
      line++
      i++
      continue
    }
    const quote = c === '"' || c === '`' || (c === "'" && !/[\p{L}\p{N}]/u.test(src[i - 1] ?? ''))
    if (quote && (mode === 'js' || c !== '`')) {
      let j = i + 1
      while (j < n && src[j] !== c && !(src[j] === '\n' && c !== '`')) {
        if (src[j] === '\\') {
          if (src[j + 1] === '\n') line++
          j += 2
          continue
        }
        if (src[j] === '\n') line++
        j++
      }
      i = src[j] === c ? j + 1 : j
      codeSeen = true
      continue
    }
    if (c === '/' && d === '/' && mode !== 'css' && !/[:\\(]/.test(src[i - 1] ?? '')) {
      let j = i + 2
      while (j < n && src[j] !== '\n') j++
      found.push({ line: line + offset, raw: src.slice(i, j), body: src.slice(i + 2, j), header: !codeSeen })
      i = j
      continue
    }
    if (c === '/' && d === '*') {
      const start = line
      let j = i + 2
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) {
        if (src[j] === '\n') line++
        j++
      }
      found.push({ line: start + offset, raw: src.slice(i, j + 2), body: src.slice(i + 2, j), header: !codeSeen })
      i = j + 2
      continue
    }
    if (mode === 'js' && c === '/' && regexCanStart()) {
      let j = i + 1
      let inClass = false
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') {
          j += 2
          continue
        }
        if (src[j] === '[') inClass = true
        else if (src[j] === ']') inClass = false
        else if (src[j] === '/' && !inClass) break
        j++
      }
      i = src[j] === '/' ? j + 1 : i + 1
      codeSeen = true
      continue
    }
    if (!/\s/.test(c)) codeSeen = true
    i++
  }
  return found
}

function jsComments(ts, ext, src, offset = 0) {
  return ts ? tsComments(ts, ext, src, offset) : lexComments(src, 'js', offset)
}

function markupComments(ts, ext, src) {
  const out = []
  for (const m of src.matchAll(/<!--([\s\S]*?)-->/g)) out.push({ line: lineAt(src, m.index), raw: m[0], body: m[1], header: false })
  const blocks = [...src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => ({ code: m[1], at: m.index + m[0].indexOf(m[1]) }))
  if (ext === '.astro') {
    const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (fm) blocks.push({ code: fm[1], at: fm[0].indexOf(fm[1]) })
  }
  for (const b of blocks) out.push(...jsComments(ts, '.ts', b.code, lineAt(src, b.at) - 1).map((c) => ({ ...c, header: false })))
  for (const m of src.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)) {
    const at = m.index + m[0].indexOf(m[2])
    out.push(...lexComments(m[2], /lang=["']?s[ac]ss/.test(m[1]) ? 'scss' : 'css', lineAt(src, at) - 1).map((c) => ({ ...c, header: false })))
  }
  return out
}

const LICENSE_START = /^(?:@license|@preserve|copyright\b|\(c\)|\u00a9|spdx-license-identifier|(?:the )?mit license|apache license|licensed under|permission is hereby granted)/i
const TOOL = /^(?:eslint(?:-disable(?:-next-line|-line)?|-enable)?\b|stylelint-(?:disable|enable)(?:-next-line|-line)?\b|@ts-(?:expect-error|ignore|nocheck|check)\b|prettier-ignore\b|deslop-ignore(?:-next-line|-file)?\b|istanbul ignore(?: next| else| if)?\b|[cv]8 ignore(?: next| start| stop)?\b|biome-ignore\b|@jsx\w*\b|@flow\b|webpack[A-Z]\w*\s*:|#__PURE__|@__PURE__|#__NO_SIDE_EFFECTS__|global(?=\s+[\w$]+(?:\s*,\s*[\w$]+)*\s*$)|@refresh reset|<reference\b.*\/>|@kept(?=\s*$)|@(?:type|satisfies|typedef|import)\s*\{[^\n]*\}(?:\s*[\w$]+)?(?=\s*$)|#(?:end)?region\b|@vite-ignore)/i
const CODE_LIKE = /^(?:import\s.+\sfrom\s|export\s|(?:const|let|var)\s+[\w${[]|return\b|await\s|<\/?[A-Za-z][\w.]*[\s/>])|[\w$\]]\(.*\)|=>|;\s*$/
const WORDS = /\p{L}[\p{L}\p{M}'\u2019-]*/gu
const TODO = /^(?:TODO|FIXME|HACK|XXX)\b/

function judge(comment) {
  const text = comment.body.replace(/^[ \t]*\*+/gm, ' ').replace(/^[\s!*/]+/, '').trim()
  if (!text) return null
  if (TODO.test(text)) return 'dk-07'
  if (comment.licensed) return null
  const tool = text.match(TOOL)
  const rest = tool
    ? text
        .slice(tool[0].length)
        .replace(/^[\s:]*[\w@$/.-]+(?:\s*,\s*[\w@$/.-]+)*/, (m) => (/^[\s:]*[a-z@][\w@$/.-]*[-/@]|^[\s:]*[\w$]+\s*,/.test(m) || tool[0].toLowerCase().startsWith('global') ? '' : m))
        .replace(/^\s*--\s*/, '')
        .trim()
    : text
  if (!rest) return null
  if (!tool && CODE_LIKE.test(rest)) return 'dk-05'
  return (rest.match(WORDS) ?? []).length >= 5 ? 'dk-05' : null
}

function commentHits(list, src) {
  const lines = src.split(/\r?\n/)
  const header = list.filter((c) => c.header)
  const licensed = header.length > 0 && (header[0].raw.startsWith('/*!') || LICENSE_START.test(header[0].body.replace(/^[ \t]*\*+/gm, ' ').replace(/^[\s!*/]+/, '').trim()))
  return list.flatMap((c) => {
    const id = judge({ ...c, licensed: licensed && c.header })
    return id ? [{ id, line: c.line, text: (lines[c.line - 1] ?? c.raw).trim(), from: 'gate' }] : []
  })
}

/* Structure */
const TRACKING = /\btracking-(?:wide|wider|widest|\[(?!-|0(?:\.0+)?[a-z%]*\]))/
const SPACING = /letterSpacing:\s*(?:[1-9]|0?\.\d*[1-9])/
const CARD_TAG = /(?:Card|Paper|Panel|Surface|Tile)$/
const CARD_STYLE = /\bstyles\.card\b|(?:^|["'`\s{])card(?:["'`\s}]|$)/
const CAPS = /^[A-Z0-9][A-Z0-9 \u00b7&'\u2019\-/:.]*$/
const SCREEN_PATH = /(?:^|\/)(?:app|pages|screens|views|routes|features|modules)\//
const PART_PATH = /(?:^|\/)components\//
const VALUE_EXEMPT = /(?:^|\/)(?:components\/ui|tokens)\/|(?:^|\/)globals\.css$|(?:^|\/)app\/(?:.*\/)?(?:manifest|(?:opengraph|twitter)-image\d*|(?:apple-)?icon\d*)\.[cm]?[jt]sx?$/
const NO_TOKENS_KEY = /^(?:themeColor|theme_color|background_color)$/
const HEX = String.raw`#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])`
const COLOR_FN = String.raw`\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*(?!var\()`
const MADE_UP = [
  String.raw`\b[a-z][\w-]*-\[-?(?:\d*\.)?\d+(?:px|rem|em)\]`,
  String.raw`(?:^|[\s"'\x60:])(?:min|max)-\[[^\]\s]+\]:`,
  String.raw`\bz-\[-?\d+\]`,
  String.raw`\b(?:duration|delay)-\[(?:\d*\.)?\d+m?s\]`,
  String.raw`\bease-\[`,
]
const RAW_IN_STRING = new RegExp([String.raw`^\s*${HEX}\s*$`, String.raw`(?:\[|\(|,|\b(?:solid|dashed|dotted|double|inset)|\d(?:px|rem|em|%)?)\s*${HEX}`, COLOR_FN, ...MADE_UP].join('|'))
const RAW_IN_CSS = new RegExp([String.raw`:[^{};]*?(?<![\w&/-])${HEX}`, COLOR_FN].join('|'))
const BREAKPOINTS = new Set(['640px', '768px', '1024px', '1280px', '1536px', '40rem', '48rem', '64rem', '80rem', '96rem', '40em', '48em', '64em', '80em', '96em'])
const madeUpWidth = (text) => /@(?:media|container)\b/.test(text) && (text.match(/\d*\.?\d+(?:px|rem|em)\b/g) ?? []).some((v) => !BREAKPOINTS.has(v))
const CONTROLS = new Set(['button', 'input', 'select', 'textarea'])
const NOT_STYLE_ATTR = /^(?:href|to|id|htmlFor|name|key|content|aria-[\w-]+|data-[\w-]+)$/

function typedCaps(text) {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t || !CAPS.test(t) || !/[A-Z]/.test(t)) return false
  return t.replace(/[^A-Z]/g, '').length >= 5 || t.split(' ').filter((w) => /[A-Z]{2,}/.test(w)).length >= 2
}

function jsxHits(ts, ext, src) {
  const sf = ts.createSourceFile(`x${ext}`, src, ts.ScriptTarget.Latest, true, scriptKind(ts, ext))
  const lines = src.split(/\r?\n/)
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  const styles = new Map()
  const readStyle = (obj) => {
    let spaced = false
    let upper = false
    for (const p of obj.properties) {
      if (!ts.isPropertyAssignment(p)) continue
      const key = p.name.getText(sf).replace(/['"]/g, '')
      if (key === 'letterSpacing' && ts.isNumericLiteral(p.initializer) && Number(p.initializer.text) > 0) spaced = true
      if (key === 'textTransform' && ts.isStringLiteral(p.initializer) && p.initializer.text === 'uppercase') upper = true
    }
    return { spaced, upper }
  }
  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
      let obj = node.initializer
      if (ts.isCallExpression(obj) && /StyleSheet\.create$/.test(obj.expression.getText(sf)) && obj.arguments[0]) obj = obj.arguments[0]
      if (ts.isObjectLiteralExpression(obj)) {
        for (const p of obj.properties) {
          if (ts.isPropertyAssignment(p) && ts.isObjectLiteralExpression(p.initializer)) styles.set(`${node.name.text}.${p.name.getText(sf).replace(/['"]/g, '')}`, readStyle(p.initializer))
        }
      }
    }
    ts.forEachChild(node, collect)
  }
  collect(sf)
  const attrText = (open, names) =>
    open.attributes.properties
      .filter((a) => ts.isJsxAttribute(a) && names.includes(a.name.getText(sf)) && a.initializer)
      .map((a) => a.initializer.getText(sf))
      .join(' ')
  const typography = (open) => {
    const style = attrText(open, ['style'])
    const cls = attrText(open, ['className', 'class'])
    let spaced = TRACKING.test(cls) || SPACING.test(style)
    let upper = /\buppercase\b/.test(cls) || /textTransform:\s*['"]uppercase['"]/.test(style)
    for (const m of style.matchAll(/\b([A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*)\b/g)) {
      const s = styles.get(m[1])
      if (s) {
        spaced ||= s.spaced
        upper ||= s.upper
      }
    }
    return { spaced, upper }
  }
  const strings = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text]
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isCallExpression(node)) return []
    const out = []
    ts.forEachChild(node, (child) => out.push(...strings(child)))
    return out
  }
  const texts = (el) => el.children.flatMap((ch) => (ts.isJsxText(ch) ? [ch.text] : ts.isJsxExpression(ch) && ch.expression ? strings(ch.expression) : []))
  const cardish = (open) => (ts.isIdentifier(open.tagName) && CARD_TAG.test(open.tagName.text)) || CARD_STYLE.test(attrText(open, ['style', 'className', 'class']))
  const hits = []
  const visit = (node, depth) => {
    let next = depth
    const open = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null
    if (open) {
      const line = lineOf(open)
      if (cardish(open)) {
        if (depth > 0) hits.push({ id: 'dk-06', line, text: (lines[line - 1] ?? '').trim(), from: 'gate' })
        next = depth + 1
      }
      const t = typography(open)
      if (t.spaced && (t.upper || (ts.isJsxElement(node) && texts(node).some(typedCaps)))) hits.push({ id: 'dk-04', line, text: (lines[line - 1] ?? '').trim(), from: 'gate' })
    }
    ts.forEachChild(node, (child) => visit(child, next))
  }
  visit(sf, 0)
  return hits
}

function jsonHits(src) {
  const lines = src.split(/\r?\n/)
  return lines.flatMap((text, i) =>
    COPY_TELLS.filter((t) => t.patterns.some((p) => new RegExp(p.source, p.flags.replace('g', '')).test(text))).map((t) => ({ id: t.id, line: i + 1, text: text.trim(), from: 'gate' })),
  )
}

/* Scanner */
function killAiSlop(root) {
  if (!existsSync(SCANNER)) throw new Error(`kill-ai-slop is missing at ${relative(DOCS, SCANNER)}; reinstall it with /sync`)
  const args = [SCANNER, root, '--json', `--rules=${RULES}`]
  if (SKIP.size) args.push(`--skip=${[...SKIP].join(',')}`)
  const run = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (run.status !== 0) throw new Error(`kill-ai-slop failed: ${(run.stderr || run.stdout).trim().slice(0, 300)}`)
  const report = JSON.parse(run.stdout)
  if (!Array.isArray(report.findings)) throw new Error('kill-ai-slop returned output in a shape this gate does not understand; run --self-test')
  return report.findings.flatMap((tell) => tell.hits.map((hit) => ({ id: tell.id, name: tell.name, fix: tell.fix, file: slash(hit.file), line: hit.line, text: hit.text, from: 'scanner' })))
}

function scanText(label, src) {
  const tmp = mkdtempSync(join(tmpdir(), 'slop-gate-'))
  try {
    writeFileSync(join(tmp, basename(label)), src)
    return killAiSlop(tmp)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

/* Analysis */
function uiImportHits(label, src) {
  if (/(^|\/)components\//.test(label)) return []
  return src.split(/\r?\n/).flatMap((text, i) => (UI_IMPORT.test(text) ? [{ id: 'dk-08', line: i + 1, text: text.trim(), from: 'gate' }] : []))
}
function mockImportHits(label, src) {
  if (/(^|\/)api\//.test(label)) return []
  return src.split(/\r?\n/).flatMap((text, i) => (MOCK_IMPORT.test(text) ? [{ id: 'dk-09', line: i + 1, text: text.trim(), from: 'gate' }] : []))
}
function rawHits(label, ts, ext, src) {
  const values = (SCREEN_PATH.test(label) || PART_PATH.test(label)) && !VALUE_EXEMPT.test(label)
  const controls = SCREEN_PATH.test(label) && !PART_PATH.test(label)
  if (!values && !controls) return []
  const lines = src.split(/\r?\n/)
  const hit = (id, line) => ({ id, line, text: (lines[line - 1] ?? '').trim(), from: 'gate' })
  if (STYLE.has(ext)) {
    if (!values) return []
    const blank = (m) => m.replace(/[^\n]/g, ' ')
    return src.replace(/\/\*[\s\S]*?\*\//g, blank).split(/\r?\n/).flatMap((text, i) => (RAW_IN_CSS.test(text) || madeUpWidth(text) ? [hit('dk-10', i + 1)] : []))
  }
  if (!JS.has(ext)) return []
  if (!ts) {
    return lines.flatMap((text, i) => {
      const out = []
      if (values && !/\b(?:themeColor|theme_color|background_color)\b/.test(text) && [...text.matchAll(/(?:([\w-]+)=)?(['"\x60])((?:(?!\2).)*)\2/g)].some((m) => !(m[1] && NOT_STYLE_ATTR.test(m[1])) && RAW_IN_STRING.test(m[3]))) out.push(hit('dk-10', i + 1))
      if (controls && /<(?:button|select|textarea)\b|<input\b(?![^>]*type=["']hidden["'])/.test(text)) out.push(hit('dk-11', i + 1))
      return out
    })
  }
  const sf = ts.createSourceFile(`x${ext}`, src, ts.ScriptTarget.Latest, true, scriptKind(ts, ext))
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  const out = []
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return
    if (ts.isJsxAttribute(node) && NOT_STYLE_ATTR.test(node.name.getText(sf))) return
    if (ts.isPropertyAssignment(node) && NO_TOKENS_KEY.test(node.name.getText(sf).replace(/['"]/g, ''))) return
    if (values && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && RAW_IN_STRING.test(node.text)) out.push(hit('dk-10', lineOf(node)))
    const open = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null
    if (controls && open && ts.isIdentifier(open.tagName) && CONTROLS.has(open.tagName.text)) {
      const hidden = open.tagName.text === 'input' && open.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'type' && a.initializer && ts.isStringLiteral(a.initializer) && a.initializer.text === 'hidden')
      if (!hidden) out.push(hit('dk-11', lineOf(open)))
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}
function own(label, src, abs) {
  const kind = kindOf(label)
  const ext = extname(label)
  if (kind === 'json') return { hits: jsonHits(src), jsx: false }
  if (kind !== 'code') return { hits: [], jsx: false }
  const ts = JS.has(ext) || MARKUP.has(ext) ? loadTs(abs) : null
  const list = JS.has(ext) ? jsComments(ts, ext, src) : MARKUP.has(ext) ? markupComments(ts, ext, src) : lexComments(src, ext === '.scss' ? 'scss' : 'css')
  const hits = [...commentHits(list, src), ...(JS.has(ext) ? [...uiImportHits(label, src), ...mockImportHits(label, src)] : []), ...rawHits(label, ts, ext, src)]
  if (ts && JSX.has(ext)) return { hits: [...hits, ...jsxHits(ts, ext, src)], jsx: true }
  return { hits, jsx: false }
}

function finish(label, src, scannerHits, mine) {
  const quiet = suppressor(src)
  const merged = [...scannerHits.filter((h) => !(mine.jsx && h.id === 'dk-06')), ...mine.hits.filter((h) => !SKIP.has(h.id) && !quiet(h.id, h.line))]
  const seen = new Set()
  return merged
    .filter((h) => {
      const k = `${h.id}:${h.line}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .map((h) => ({ ...h, file: label, name: META[h.id]?.name ?? h.name ?? h.id, fix: META[h.id]?.fix ?? h.fix ?? '' }))
}

function analyze(label, src, abs) {
  const errors = []
  let scanner = []
  if (['code', 'prose'].includes(kindOf(label))) {
    try {
      scanner = scanText(label, src)
    } catch (error) {
      errors.push(error.message)
    }
  }
  return { hits: finish(label, src, scanner, own(label, src, abs)), errors }
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (entry.isFile()) yield full
  }
}

function scanTree(root) {
  const errors = []
  const scanner = new Map()
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
    try {
      for (const h of killAiSlop(join(root, entry.name))) {
        const label = labelFor(join(root, entry.name, h.file))
        if (!scanner.has(label)) scanner.set(label, [])
        scanner.get(label).push(h)
      }
    } catch (error) {
      errors.push(error.message)
    }
  }
  const hits = []
  for (const abs of walk(root)) {
    const label = labelFor(abs)
    if (excluded(label) || !kindOf(label)) continue
    const src = readFileSync(abs, 'utf8')
    let fromScanner = scanner.get(label) ?? []
    if (dirname(abs) === root && ['code', 'prose'].includes(kindOf(label))) {
      try {
        fromScanner = scanText(label, src)
      } catch (error) {
        errors.push(error.message)
      }
    }
    hits.push(...finish(label, src, fromScanner, own(label, src, abs)))
  }
  return { hits, errors }
}

/* Hook */
const key = (h) => `${h.id}|${String(h.text).trim()}`

function againstBefore(label, before, abs, hits) {
  if (before === null) return { fresh: hits, older: [] }
  const counts = new Map()
  for (const h of analyze(label, before, abs).hits) counts.set(key(h), (counts.get(key(h)) ?? 0) + 1)
  const fresh = []
  const older = []
  for (const h of hits) {
    const n = counts.get(key(h)) ?? 0
    if (n > 0) {
      counts.set(key(h), n - 1)
      older.push(h)
    } else fresh.push(h)
  }
  return { fresh, older }
}

function split(input, abs, label, src, hits) {
  const tool = input.tool_name
  const ti = input.tool_input ?? {}
  if (tool === 'Edit' || tool === 'MultiEdit') {
    const news = (tool === 'Edit' ? [ti.new_string] : (ti.edits ?? []).map((e) => e?.new_string)).filter((s) => typeof s === 'string' && s.length)
    const ranges = []
    for (const s of news) {
      for (let from = 0, at = src.indexOf(s); at >= 0; from = at + s.length, at = src.indexOf(s, from)) {
        const start = lineAt(src, at)
        ranges.push([start, start + s.split('\n').length - 1])
      }
    }
    const fresh = (h) => ranges.some(([a, b]) => h.line >= a && h.line <= b)
    return { fresh: hits.filter(fresh), older: hits.filter((h) => !fresh(h)) }
  }
  if (tool === 'Write') return againstBefore(label, git(['show', `HEAD:./${basename(abs)}`], dirname(abs)), abs, hits)
  return { fresh: hits, older: [] }
}

const list = (xs) => xs.map((h) => `- line ${h.line}: ${h.name} (${h.id}). Fix: ${h.fix}. \`${String(h.text).slice(0, 90)}\``).join('\n')
const emit = (payload) => process.stdout.write(JSON.stringify(payload))
const block = (reason) => emit({ decision: 'block', reason })
const context = (text) => emit({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } })

function hook() {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  const file = input.tool_input?.file_path ?? input.tool_response?.filePath
  if (!file) return
  const abs = real(resolve(file))
  if (APP && inside(APP, abs) && !kitFile(labelFor(abs))) {
    const label = labelFor(abs)
    if (excluded(label) || !kindOf(label) || !existsSync(abs)) return
    const src = readFileSync(abs, 'utf8')
    const { hits, errors } = analyze(label, src, abs)
    if (errors.length) {
      block(`The slop gate could not fully check ${label}: ${errors.join('; ')}. Tell the user the gate needs attention (run node .designkit/scripts/slop-gate.mjs --self-test). Do not describe this file as checked.${hits.length ? `\nWhat it could check still found:\n${list(hits)}` : ''}`)
      return
    }
    if (!hits.length) return
    const { fresh, older } = split(input, abs, label, src, hits)
    const blocking = fresh.filter((h) => level(h) === 'block')
    const warning = fresh.filter((h) => level(h) === 'warn')
    const olderBlocking = older.filter((h) => level(h) === 'block')
    const note = olderBlocking.length
      ? `\nThis file also has ${olderBlocking.length} older finding(s) outside this change (lines ${[...new Set(olderBlocking.map((h) => h.line))].slice(0, 10).join(', ')}). Leave them unless the user asks; fix them when you next work on those lines.`
      : ''
    if (blocking.length) {
      block(
        [
          `Slop gate: ${label} has ${blocking.length} pattern(s) that are not allowed in app code. Fix them in place now, without rewriting the rest of the file:`,
          list(blocking),
          warning.length ? `\nAlso check these; fix them unless each is a deliberate choice:\n${list(warning)}` : '',
          note,
          '\ndk-05 and dk-07 have no exceptions: delete the comment, or cut it to a title of four words or fewer. For any other id that is genuinely intended, tell the user, then add deslop-ignore <id> to that line or the id to "skip" in .designkit/slop-policy.json.',
        ].join('\n'),
      )
      return
    }
    if (warning.length) context(`Slop gate warnings in ${label}. Fix them unless each is a deliberate choice:\n${list(warning)}${note}`)
    return
  }
  if (inside(join(DOCS, 'project'), abs) && PROSE.has(extname(abs)) && existsSync(abs)) {
    const em = TELLS.find((t) => t.id === 'dk-01').patterns[0]
    const lines = readFileSync(abs, 'utf8').split(/\r?\n/).flatMap((text, i) => (em.test(text) ? [i + 1] : []))
    if (lines.length) context(`Em dashes in ${slash(relative(DOCS, abs))}, lines ${lines.join(', ')}. Rewrite them unless they sit inside a quotation.`)
  }
}

/* Self-test */
function selfTest() {
  SKIP.clear()
  const cases = [
    ['dk-01', 'copy.ts', `export const a = 'Book now \u2014 seats are limited'\n`],
    ['dk-02', 'lorem.ts', `export const b = 'Lorem ipsum dolor sit amet'\n`],
    ['dk-03', 'image.ts', `export const c = 'https://picsum.photos/200'\n`],
    ['dk-04', 'caps.tsx', `const s = StyleSheet.create({ l: { textTransform: 'uppercase', letterSpacing: 1 } })\n`],
    ['dk-05', 'note.ts', `// This function formats the price for the checkout summary\nexport const d = 1\n`],
    ['dk-06', 'cards.tsx', `export const E = () => (\n  <Card>\n    <Card>x</Card>\n  </Card>\n)\n`],
    ['dk-07', 'todo.ts', `// TODO: wire this up\nexport const f = 1\n`],
    ['dk-08', 'features/Screen.tsx', `import { Button } from '@/components/ui/button'\nexport const S = () => <Button>Go</Button>\n`],
    [null, 'components/Button.tsx', `import { Button as Base } from '@/components/ui/button'\nexport const Button = () => <Base />\n`],
    ['dk-09', 'features/Rows.tsx', `import { flat } from '@/api/mock/flat'\nexport const R = () => <ul>{flat.people.map((p) => <li key={p}>{p}</li>)}</ul>\n`],
    [null, 'api/client.ts', `import { flat } from '@/api/mock/flat'\nexport const getFlat = async () => flat\n`],
    ['dk-10', 'features/Swatch.tsx', `export const S = () => <div className="bg-[#1a2b3c] p-4" />\n`],
    [null, 'tokens/colors.ts', `export const accent = '#1a2b3c'\n`],
    ['dk-11', 'features/Form.tsx', `export const F = () => <button type="submit">Save</button>\n`],
    [null, 'components/DSButton.tsx', `export const DSButton = (props: React.ComponentProps<'button'>) => <button {...props} />\n`],
    ['01', 'hero.tsx', `export const H = () => <section className="bg-gradient-to-r from-purple-500 to-pink-500">Hi</section>\n`],
    ['dk-01', 'README.md', `Prices are per night \u2014 taxes included.\n`],
    [null, 'clean.ts', `/* Fees */\nexport const g = 1\n`],
  ]
  let failed = 0
  for (const [want, name, src] of cases) {
    const { hits, errors } = analyze(`selftest/${name}`, src, null)
    const ids = [...new Set(hits.map((h) => h.id))]
    const ok = !errors.length && (want ? ids.includes(want) : ids.length === 0)
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(10)} expected ${want ?? 'nothing'}, got ${ids.join(' ') || 'nothing'}${errors.length ? `, error: ${errors.join('; ')}` : ''}`)
  }
  const ts = loadTs(null)
  console.log(`\ntypescript: ${ts ? `found (${ts.version}), comments and page structure read precisely` : 'not found, using the simpler comment check'}`)
  console.log(failed ? `\nself-test: ${failed} FAILED` : '\nself-test: all passed')
  process.exit(failed ? 1 : 0)
}

/* CLI */
function report(hits, errors, json, noFail) {
  hits.sort((a, b) => (level(a) === level(b) ? a.file.localeCompare(b.file) || a.line - b.line : level(a) === 'block' ? -1 : 1))
  const counts = { block: hits.filter((h) => level(h) === 'block').length, warn: hits.filter((h) => level(h) === 'warn').length }
  if (json) console.log(JSON.stringify({ counts, errors, hits: hits.map((h) => ({ ...h, level: level(h) })) }, null, 2))
  else {
    for (const h of hits) console.log(`${h.file}:${h.line}  [${level(h)}] ${h.id} ${h.name}  -> ${h.fix}\n    ${String(h.text).slice(0, 110)}`)
    for (const e of errors) console.error(`slop-gate: error: ${e}`)
    console.log(`\nslop-gate: ${counts.block} block, ${counts.warn} warn${errors.length ? `, ${errors.length} error(s)` : ''}`)
  }
  if (errors.length) process.exit(2)
  process.exit(counts.block && !noFail ? 1 : 0)
}

function staged(json, noFail, newOnly) {
  const top = git(['rev-parse', '--show-toplevel'], process.cwd())
  if (top === null) throw new Error('--staged needs to run inside a git repository')
  const root = top.trim()
  const names = (git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'], root) ?? '').split('\0').filter(Boolean)
  const hits = []
  const errors = []
  for (const f of names) {
    const abs = real(join(root, f))
    const label = labelFor(abs)
    if (excluded(label) || !kindOf(label)) continue
    const src = git(['show', `:${f}`], root)
    if (src === null) continue
    const r = analyze(label, src, abs)
    hits.push(...(newOnly ? againstBefore(label, git(['show', `HEAD:${f}`], root), abs, r.hits).fresh : r.hits))
    errors.push(...r.errors)
  }
  if (!names.length && !json) console.log('slop-gate: nothing staged to scan')
  report(hits, errors, json, noFail)
}

function cli(argv) {
  const json = argv.includes('--json')
  const noFail = argv.includes('--no-fail')
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--staged')) return staged(json, noFail, argv.includes('--new-only'))
  const targets = argv.filter((a) => !a.startsWith('--'))
  if (!targets.length && !APP) throw new Error('no path given and .designkit/workspace.json has no "app" entry')
  const roots = targets.length
    ? targets.map((t) => {
        const here = resolve(t)
        if (existsSync(here) || !APP) return here
        return resolve(APP, t)
      })
    : [APP]
  const hits = []
  const errors = []
  for (const root of roots) {
    const abs = real(root)
    if (statSync(abs).isDirectory()) {
      const r = scanTree(abs)
      hits.push(...r.hits)
      errors.push(...r.errors)
    } else {
      const label = labelFor(abs)
      if (excluded(label) || !kindOf(label)) continue
      const r = analyze(label, readFileSync(abs, 'utf8'), abs)
      hits.push(...r.hits)
      errors.push(...r.errors)
    }
  }
  report(hits, errors, json, noFail)
}

const hookMode = process.argv.includes('--hook')
try {
  if (loadError) throw loadError
  if (hookMode) hook()
  else cli(process.argv.slice(2))
} catch (error) {
  if (hookMode) block(`The slop gate crashed: ${error.message}. Tell the user the gate needs attention (run node .designkit/scripts/slop-gate.mjs --self-test). Do not describe the file as checked.`)
  else {
    console.error(`slop-gate: ${error.message}`)
    process.exit(2)
  }
}
