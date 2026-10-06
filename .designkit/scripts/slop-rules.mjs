const POSITIVE_SPACING = String.raw`letterSpacing:\s*(?:[1-9]|0?\.\d*[1-9])`
const POSITIVE_TRACKING = String.raw`tracking-(?:wide|wider|widest|\[(?!-|0(?:\.0+)?[a-z%]*\]))`
const CSS_SPACING = String.raw`letter-spacing:\s*(?:[1-9]|0?\.\d*[1-9])`
const BRACES = String.raw`(?:[^>{}]|\{(?:[^{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*\})*`
const CARD = String.raw`(?<![\w$.)\]])<(Card|Paper|Panel|Surface|Tile)(?=[\s/>])${BRACES}(?<!\/)>(?:(?!<\/\1>)[\s\S]){0,2000}?(?<![\w$.)\]])<\1(?=[\s/>])`

export default [
  { id: 'dk-01', group: 'copy', name: 'em dash in text', fix: 'comma, colon, full stop or parentheses', copy: true,
    patterns: [/[\p{L}\p{N})}][ \u00a0]?\u2014|\u2014[ \u00a0]?[\p{L}\p{N}($\{]/u] },
  { id: 'dk-02', group: 'copy', name: 'placeholder copy', fix: 'write the real words', copy: true,
    patterns: [/\blorem ipsum\b/i, /\bdolor sit amet\b/i] },
  { id: 'dk-03', group: 'assets', name: 'stock placeholder image service', fix: 'a real asset or an honest empty state', copy: true,
    patterns: [/(?:picsum\.photos|source\.unsplash\.com|unsplash\.com\/random|via\.placeholder\.com|placehold\.co|placeholder\.com|dummyimage\.com|placekitten\.com|loremflickr\.com)/i] },
  { id: 'dk-04', group: 'type', name: 'all-caps letter-spaced text', fix: 'sentence case, no extra letter spacing',
    patterns: [
      new RegExp(String.raw`textTransform:\s*['"]uppercase['"][^}]{0,160}${POSITIVE_SPACING}|${POSITIVE_SPACING}[^}]{0,160}textTransform:\s*['"]uppercase['"]`),
      new RegExp(String.raw`\buppercase\b[^\n"'\x60]{0,80}\b${POSITIVE_TRACKING}|\b${POSITIVE_TRACKING}[^\n"'\x60]{0,80}\buppercase\b`),
      new RegExp(String.raw`text-transform:\s*uppercase;?[^}]{0,160}${CSS_SPACING}|${CSS_SPACING}[^}]{0,160}text-transform:\s*uppercase`),
    ] },
  { id: 'dk-06', group: 'layout', name: 'card inside a card', fix: 'one surface per region; hairlines inside',
    patterns: [new RegExp(CARD)] },
]

export const gateRules = [
  { id: 'dk-05', name: 'explanation or commented-out code in a code file', fix: 'delete it; the why goes in the commit body or the docs repo' },
  { id: 'dk-07', name: 'TODO left in code', fix: 'do it now, or write it down in the docs repo' },
  { id: 'dk-08', name: 'screen imports the UI library directly', fix: 'import the design-system part from src/components; only files under src/components import components/ui' },
  { id: 'dk-09', name: 'screen reaches into the mock data', fix: 'ask the door instead: import the call from @/api; sample data lives only in src/api/mock' },
  { id: 'dk-10', name: 'raw colour or made-up size in a screen or part', fix: 'use a token from src/tokens: a colour, spacing, height, z-index, motion or breakpoint' },
  { id: 'dk-11', name: 'raw control in a screen', fix: 'use the design-system part from src/components (DSButton, DSInput...)' },
  { id: 'dk-12', name: 'something a user touches has no test ID', fix: 'add data-testid (web) or testID (React Native): screen-element in English, never translated, e.g. checkout-pay-button' },
]
