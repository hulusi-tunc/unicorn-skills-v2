const DIRS = ['project/', '.claude/', '.designkit/', '.agents/', '.codex/', '.cursor/', '.gemini/', '.opencode/', '.github/agents/', '.github/hooks/']
const FILES = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', 'opencode.json', '.mcp.json']

export const isKitPath = (file) => FILES.includes(file) || DIRS.some((dir) => file.startsWith(dir))
