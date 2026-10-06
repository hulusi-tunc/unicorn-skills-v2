import { spawn } from 'node:child_process'

const SCRIPT = '.designkit/scripts/hook.mjs'

function run(cwd, event, payload) {
  return new Promise((done) => {
    const child = spawn('node', [SCRIPT, event, '--tool', 'opencode'], { cwd })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', () => done({ code: 0, stdout: '', stderr: '' }))
    child.on('close', (code) => done({ code: code ?? 0, stdout, stderr }))
    child.stdin.on('error', () => {})
    child.stdin.end(JSON.stringify(payload))
  })
}

export const DesignKit = async ({ directory, worktree }) => {
  const root = worktree && worktree !== '/' ? worktree : directory
  const started = new Map()
  const helpers = new Set()
  const start = (id) => {
    if (!started.has(id)) started.set(id, run(root, 'session-start', { session_id: id }))
    return started.get(id)
  }
  return {
    event: async ({ event }) => {
      if (event.type !== 'session.created') return
      const { id, parentID } = event.properties.info
      if (parentID) helpers.add(id)
      else start(id)
    },
    'experimental.chat.system.transform': async (input, output) => {
      if (!input.sessionID || helpers.has(input.sessionID)) return
      const text = (await start(input.sessionID)).stdout.trim()
      if (text) output.system.push(text)
    },
    'tool.execute.before': async (input, output) => {
      const payload = input.tool === 'bash' ? { command: String(output.args?.command ?? '') } : /figma/i.test(input.tool) ? { tool: input.tool } : null
      if (!payload) return
      const result = await run(root, 'before-command', payload)
      if (result.code === 2) throw new Error(result.stderr.trim() || 'Refused by the design kit')
    },
    'tool.execute.after': async (input, output) => {
      const files = input.tool === 'write' || input.tool === 'edit' ? [input.args?.filePath] : input.tool === 'apply_patch' ? (output.metadata?.files ?? []).map((file) => file.movePath ?? file.filePath) : []
      for (const file of files.filter(Boolean)) {
        const text = (await run(root, 'after-edit', { file })).stdout.trim()
        if (text && typeof output.output === 'string') output.output += `\n\n${text}`
      }
    },
  }
}
