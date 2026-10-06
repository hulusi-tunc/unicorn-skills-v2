# /setup, build

The helper's part: app skeleton, packages, the gate. Judgment stays in `SKILL.md` step 7.

### Scaffold
Generators reject capitals, non-empty folders and prompts, so: temp lowercase folder, every choice
as a flag, copy in.
```
slug=$(printf %s "<Name>" | tr '[:upper:]' '[:lower:]')
tmp=$(mktemp -d)
```
Web (Next.js; Tailwind is required by the UI library below):
```
npx create-next-app@latest "$tmp/$slug" --typescript --eslint --app --src-dir --use-npm --tailwind --no-react-compiler --import-alias "@/*" --no-agents-md --disable-git --skip-install --yes </dev/null
```
Vite only if behind a login and not needed on Google: `npm create vite@latest "$tmp/$slug" -- --template react-ts </dev/null`.
Mobile (Expo):
```
npx create-expo-app@latest "$tmp/$slug" --template blank-typescript --no-agents-md --no-install </dev/null
```
Then:
```
rsync -a --exclude .git "$tmp/$slug"/ <app>/ && rm -rf "$tmp"
cd <app> && npm install
```

### Gate (in the app)
```
npm install -D prettier prettier-plugin-organize-imports knip husky lint-staged
npm pkg set scripts.prepare=husky scripts.format="prettier --write ." scripts.dead=knip engines.node=">=22"
npx husky
```
(`npx husky`, never `husky init`: init overwrites `.husky/pre-commit`.) Write:
- `knip.json`: `{ "$schema": "https://unpkg.com/knip@latest/schema.json", "tags": ["-@kept"] }`
- `.prettierrc` if absent: `{ "semi": true, "singleQuote": false, "trailingComma": "all", "printWidth": 100, "plugins": ["prettier-plugin-organize-imports"] }`
  (Prettier's defaults, a 100 wide line and sorted imports: one format the dev team shares)
- `.lintstagedrc.json`: `{ "*.{ts,tsx,js,jsx,css,json,md}": "prettier --write" }` (own file: `npm pkg set` splits the key on dots)
- Each hook file below holds exactly its lines, nothing above them: husky 9 needs no `#!/bin/sh`
  or `husky.sh` line, and husky 10 refuses them.
- `.husky/pre-commit`, append these five lines:
  ```
  npx lint-staged
  d=$(git config --get designkit.docs) || exit 0
  [ -f "$d/.designkit/scripts/slop-gate.mjs" ] || { echo "slop gate: docs folder not found at $d. Point it at the docs folder with: git config designkit.docs <path>" >&2; exit 1; }
  node "$d/.designkit/scripts/slop-gate.mjs" --staged
  node "$d/.designkit/scripts/quick-check.mjs"
  ```
  Docs path lives in local git config, never a tracked file: blocks on the owner's machine, only
  formats in the dev team's clone.
- `.husky/commit-msg`:
  ```
  d=$(git config --get designkit.docs) || exit 0
  [ -f "$d/.designkit/scripts/commit-msg.mjs" ] || exit 0
  node "$d/.designkit/scripts/commit-msg.mjs" "$1"
  ```
- `.husky/pre-push`:
  ```
  d=$(git config --get designkit.docs) || exit 0
  [ -f "$d/.designkit/scripts/pre-push.mjs" ] || exit 0
  node "$d/.designkit/scripts/pre-push.mjs" "$@"
  ```
  The first removes AI signature lines from commit messages; the second refuses a push that would
  replace commits already on GitHub. Both do nothing in the dev team's clone.

### Lint
- Web: `npx shadcn@latest init -d -y -s` (writes `components.json`, `src/components/ui/` with a sample
  `button.tsx`, `src/lib/utils.ts`, and the library's theme variables in `globals.css`, which
  `/tokenize` points at the tokens). That library is the engine under the design system, used from
  the first part on, so the web `knip.json` also gets `"ignore": ["src/components/ui/**", "src/lib/utils.ts"]`
  and `"ignoreDependencies": ["@base-ui/react", "class-variance-authority", "cn", "lucide-react"]`;
  knip watches our code, the gate skips `src/components/ui/`.
- Web: `npm install -D eslint-plugin-jsx-a11y`; in `eslint.config.mjs` add
  `import jsxA11y from 'eslint-plugin-jsx-a11y'` and a rules-only entry
  `{ files: ['**/*.{jsx,tsx}'], rules: jsxA11y.flatConfigs.recommended.rules }` (`eslint-config-next`
  already registers the plugin). `next.config.ts`: `agentRules: false` (else `next dev` writes
  `AGENTS.md`/`CLAUDE.md` into the app).
- Expo (no linter in template): `npx expo install eslint eslint-config-expo -- --save-dev`, then
  `eslint.config.js`:
  ```
  const { defineConfig } = require('eslint/config')
  const expoConfig = require('eslint-config-expo/flat')
  module.exports = defineConfig([expoConfig, { ignores: ['dist/*'] }])
  ```
  `npm pkg set scripts.lint="expo lint"`. No React Native a11y lint runs on current ESLint: the main
  chat logs it and relies on `design-reviewer`. `npx expo install expo-system-ui` (template's
  `userInterfaceStyle` needs it). Add `"ignoreDependencies": ["expo-updates"]` to `knip.json`.
