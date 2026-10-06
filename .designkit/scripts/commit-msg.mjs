#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PRODUCT = String.raw`(?:claude(?: code| (?:opus|sonnet|haiku|fable)[\w .-]*)?|openai codex|codex(?: cli)?|chatgpt|cursor(?: ?agent)?|(?:github )?copilot|gemini(?: cli| code assist)?|jules|opencode|devin|aider|amp|cline|windsurf)`
const AI_NAME = new RegExp(`^${PRODUCT}$`, 'i')
const AI_MAIL = /@(?:anthropic\.com|openai\.com|cursor\.com|sourcegraph\.com)>?$|copilot@users\.noreply\.github\.com|\[bot\]@users\.noreply\.github\.com|jules@google\.com/i
const TRAILER = /^\s*co-authored-by:\s*(.*?)\s*(<[^>]*>)?\s*$/i
const GENERATED = new RegExp(String.raw`^\s*(?:\p{Extended_Pictographic}️?\s*)?(?:generated|created|written|made) (?:with|by|using) \[?${PRODUCT}\]?(?:\(\S*\))?\.?\s*$`, 'iu')
const SESSION = /^\s*https:\/\/(?:claude\.ai\/code|chatgpt\.com\/codex|cursor\.com\/(?:agents|background-agent))\S*\s*$/i

const signed = (line) => {
  const trailer = line.match(TRAILER)
  if (trailer) return AI_NAME.test(trailer[1]) || AI_MAIL.test(trailer[2] ?? '')
  return GENERATED.test(line) || SESSION.test(line)
}

const workspace = (() => {
  try {
    return JSON.parse(readFileSync(join(resolve(dirname(fileURLToPath(import.meta.url)), '../..'), '.designkit/workspace.json'), 'utf8'))
  } catch {
    return {}
  }
})()

let after = ''
try {
  const file = process.argv[2]
  const before = readFileSync(file, 'utf8')
  const kept = before.split('\n').filter((line) => !signed(line))
  after = `${kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
  if (kept.length !== before.split('\n').length) writeFileSync(file, after)
} catch {}

const key = workspace.jira
const subject = after.split('\n').find((l) => l.trim() && !l.startsWith('#')) ?? ''
if (key && after && !/^(Merge|Revert|fixup!|squash!)/.test(subject) && !new RegExp(`^Jira: ${key}-\\d+\\s*$`, 'm').test(after)) {
  console.error(`commit refused: this project links every commit to its Jira ticket. Add a last line "Jira: ${key}-123" with the ticket this change belongs to.`)
  process.exit(1)
}
