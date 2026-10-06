#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'

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

try {
  const file = process.argv[2]
  const before = readFileSync(file, 'utf8')
  const kept = before.split('\n').filter((line) => !signed(line))
  const after = `${kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
  if (kept.length !== before.split('\n').length) writeFileSync(file, after)
} catch {}
