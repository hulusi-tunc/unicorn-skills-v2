const list = (title, lines) => `## ${title}\n${lines.map((line) => `- ${line}\n`).join('')}`

export function parseStatus(text) {
  const status = { last: null, lastDate: null, marker: null, open: [], kept: [] }
  let section = null
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const last = line.match(/^Last review: (.+)$/)
    const marker = line.match(/^Reviewed up to: (\S+)$/)
    if (last) {
      status.last = last[1]
      status.lastDate = last[1].match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null
    } else if (marker) status.marker = marker[1] === 'none' ? null : marker[1]
    else if (line === '## Open') section = 'open'
    else if (line === '## Left on purpose') section = 'kept'
    else if (line.startsWith('#')) section = null
    else if (section && line.startsWith('- ')) status[section].push(line.slice(2))
  }
  return status
}

export const renderStatus = (s) =>
  `# Status\n\nLast review: ${s.last ?? 'none yet'}\nReviewed up to: ${s.marker ?? 'none'}\n\n${list('Open', s.open)}\n${list('Left on purpose', s.kept)}`

export function mergeStatus(base, github, local) {
  const b = parseStatus(base)
  const g = parseStatus(github)
  const l = parseStatus(local)
  const [newer, older] = (l.lastDate ?? '') > (g.lastDate ?? '') ? [l, g] : [g, l]
  const add = (mine, theirs, was) => [...new Set([...mine, ...theirs.filter((line) => !was.includes(line))])]
  return renderStatus({ ...newer, open: add(newer.open, older.open, b.open), kept: add(newer.kept, older.kept, b.kept) })
}
