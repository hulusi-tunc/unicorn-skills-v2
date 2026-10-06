#!/usr/bin/env node
// testids: read-only check that every element a user touches carries a test ID.
// Web and React Native (JSX/TSX), Flutter (Dart) and SwiftUI. No dependencies.
// Usage: node testids.mjs <project> [--list] [--json]
//   --list  print the test IDs found (the content of qa/testids.md)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const root = process.argv[2] || '.'
const flags = new Set(process.argv.slice(3))
const SKIP = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.expo', 'ios', 'android', '.dart_tool', 'Pods', 'coverage', '.turbo', 'out'])
const files = []
const walk = (d) => { for (const n of readdirSync(d)) { if (SKIP.has(n) || n.startsWith('.')) continue; const p = join(d, n); const s = statSync(p); if (s.isDirectory()) walk(p); else if (/\.(tsx|jsx|dart|swift)$/.test(n) && !/\.(test|spec|stories)\./.test(n)) files.push(p) } }
walk(root)

const TEST_ATTR = /\b(data-testid|data-test-id|data-test|data-cy|testID|nativeID)\s*=/
// interactive by tag; lower case = DOM, capitalised = React Native or design-system parts
const DOM = new Set(['button', 'a', 'input', 'select', 'textarea', 'summary'])
const COMP = /^(Button|IconButton|Link|Input|TextInput|TextField|Textarea|Select|Checkbox|Radio|RadioGroup|Switch|Toggle|Slider|Tab|TabsTrigger|MenuItem|DropdownMenuItem|Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|DS\w*(Button|Input|Select|Checkbox|Radio|Switch|Toggle|Link|Tab|Field|Textarea|TextArea|Slider|MenuItem))$/
const HANDLER = /\b(onClick|onPress|onLongPress|onChange|onChangeText|onSubmit|onValueChange)\s*=/

// reads JSX opening tags with their attributes, tracking braces and strings so arrows (=>) don't end a tag
function* jsxTags(src) {
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '<' || !/[A-Za-z]/.test(src[i + 1] || '')) continue
    let j = i + 1; while (/[\w.]/.test(src[j])) j++
    const name = src.slice(i + 1, j)
    let depth = 0, quote = null, k = j
    for (; k < src.length; k++) {
      const c = src[k]
      if (quote) { if (c === quote && src[k - 1] !== '\\') quote = null; continue }
      if (c === '"' || c === "'" || c === '`') { if (depth > 0 || c !== '`') quote = c; continue }
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
      else if (c === '<' && depth === 0 && k > j) { k = -1; break } // a comparison, not a tag
    }
    if (k < 0) continue
    yield { name, attrs: src.slice(j, k), line: src.slice(0, i).split('\n').length }
    i = k
  }
}

const found = [], missing = [], ids = new Set()
let total = 0
for (const f of files) {
  const src = readFileSync(f, 'utf8'), rel = relative(root, f), ext = extname(f)
  const idsIn = (re) => { for (const m of src.matchAll(re)) ids.add(m[1]) }
  if (ext === '.tsx' || ext === '.jsx') {
    idsIn(/\b(?:data-testid|testID)\s*=\s*["'`{]+([\w${}.\-/]+)/g)
    for (const t of jsxTags(src)) {
      const interactive = DOM.has(t.name) || COMP.test(t.name) || HANDLER.test(t.attrs) || /role\s*=\s*["']button["']/.test(t.attrs)
      if (!interactive) continue
      if (t.name === 'a' && !/\bhref\s*=/.test(t.attrs) && !HANDLER.test(t.attrs)) continue
      if (t.name === 'input' && /type\s*=\s*["']hidden["']/.test(t.attrs)) continue
      total++
      if (TEST_ATTR.test(t.attrs)) found.push({ file: rel, line: t.line, tag: t.name })
      else missing.push({ file: rel, line: t.line, tag: t.name, spreads: /\{\s*\.\.\./.test(t.attrs) })
    }
  } else if (ext === '.dart') {
    idsIn(/(?:ValueKey|Key)\(\s*['"]([\w\-.]+)['"]\s*\)/g); idsIn(/identifier:\s*['"]([\w\-.]+)['"]/g)
    for (const m of src.matchAll(/\b(ElevatedButton|TextButton|OutlinedButton|FilledButton|IconButton|FloatingActionButton|GestureDetector|InkWell|TextField|TextFormField|Checkbox|Switch|Radio|Slider|DropdownButton)\s*\(/g)) {
      total++
      const window = src.slice(Math.max(0, m.index - 160), m.index + 220)
      const ok = /\bkey:\s*(const\s+)?(Value)?Key\(|identifier:/.test(window)
      ;(ok ? found : missing).push({ file: rel, line: src.slice(0, m.index).split('\n').length, tag: m[1] })
    }
  } else if (ext === '.swift') {
    idsIn(/\.accessibilityIdentifier\(\s*"([\w\-.]+)"\s*\)/g)
    for (const m of src.matchAll(/\b(Button|TextField|SecureField|Toggle|Picker|Slider|Stepper|NavigationLink|Menu)\s*[({]/g)) {
      total++
      const after = src.slice(m.index, m.index + 600)
      const ok = /\.accessibilityIdentifier\(/.test(after.split(/\n\s*(Button|TextField|Toggle|NavigationLink)\b/)[0])
      ;(ok ? found : missing).push({ file: rel, line: src.slice(0, m.index).split('\n').length, tag: m[1] })
    }
  }
}

const pct = total ? Math.round((found.length / total) * 100) : 100
if (flags.has('--json')) { console.log(JSON.stringify({ root, files: files.length, total, withId: found.length, coverage: pct, ids: [...ids].sort(), missing }, null, 2)); process.exit(0) }
if (flags.has('--list')) { console.log(`# Test IDs\n\n${[...ids].sort().map((i) => `- \`${i}\``).join('\n') || '(none yet)'}`); process.exit(0) }

const byFile = new Map()
for (const m of missing) byFile.set(m.file, (byFile.get(m.file) || 0) + 1)
console.log(`testids · ${root}\n${files.length} files scanned · ${total} elements a user touches · ${found.length} have a test ID · coverage ${pct}%\nread-only: nothing was changed\n`)
if (missing.length) {
  console.log('Most missing, by file:')
  for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${String(n).padStart(4)}  ${f}`)
  const spreads = missing.filter((m) => m.spreads).length
  if (spreads) console.log(`\n${spreads} of the missing spread props ({...props}); they get an ID if the caller passes one.`)
  console.log(`\nFirst ones to fix:`)
  for (const m of missing.slice(0, 10)) console.log(`  ${m.file}:${m.line}  <${m.tag}>`)
}
