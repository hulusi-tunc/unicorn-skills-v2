#!/usr/bin/env bash
set -uo pipefail

kit="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
sandbox="$(cd "$(mktemp -d)" && pwd -P)"
trap '[ -n "${KEEP:-}" ] && echo "kept: $sandbox" || rm -rf "$sandbox"' EXIT
export HOME="$sandbox/home"
OLD_COMMIT=0b6743e
old="$HOME/old-kit"
new="$HOME/design-kit"
update="$new/bin/update-project"
passed=0
failed=0

check() {
  if eval "$2"; then
    passed=$((passed + 1)); echo "  ok    $1"
  else
    failed=$((failed + 1)); echo "  FAIL  $1"
  fi
}
commit_all() { git -C "$1" add -A && git -C "$1" commit -qm "$2"; }

echo "Sandbox: the kit as it was at $OLD_COMMIT, and the kit as it is now (with its history)..."
mkdir -p "$old" "$HOME/Projects"
git -C "$kit" archive "$OLD_COMMIT" | tar -x -C "$old"
rsync -a --exclude node_modules --exclude dev "$kit/" "$new/"
git config --global user.name Nobody
git config --global user.email nobody@example.com
(cd "$new/.designkit/scripts" && npm ci --no-audit --no-fund --silent >/dev/null 2>&1) || echo "  (offline: the gate runs its simpler checks)"

echo
echo "A project made by the old kit"
p="$HOME/Projects/Tally"
bash "$old/bin/new-project" "$p" >/dev/null 2>&1
app="$p/Tally-app"
mkdir -p "$app/.husky" "$app/src"
printf 'npx lint-staged\nd=$(git config --get designkit.docs) || exit 0\n[ -f "$d/.claude/scripts/slop-gate.mjs" ] || { echo "slop gate: docs folder not found at $d." >&2; exit 1; }\nnode "$d/.claude/scripts/slop-gate.mjs" --staged\nnode "$d/.claude/scripts/quick-check.mjs"\n' >"$app/.husky/pre-commit"
printf 'export const a = 1\n' >"$app/src/a.ts"
commit_all "$app" "feat: first screen"
node -e 'const fs=require("fs");const f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.skip.push("12");fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$p/.claude/slop-policy.json"
printf '# Tally\n\nA tally counter.\n' >"$p/project/PROJECT.md"
commit_all "$p" "docs: set up Tally"
denies_before="$(grep -c 'Bash(git' "$p/.claude/settings.json")"
commits_before="$(git -C "$p" rev-list --count HEAD)"
(cd "$p" && bash "$update" </dev/null >"$sandbox/update.log" 2>&1)
status=$?
check "finishes and says the project moved" '[ $status -eq 0 ] && grep -q "now uses the kit'"'"'s current layout" "$sandbox/update.log"'
check "the workspace file moved, unchanged but for the kit's address" '[ ! -e "$p/.claude/workspace.json" ] && grep -q "\"app\": \"Tally-app\"" "$p/.designkit/workspace.json"'
check "the project's own gate settings moved with it" 'grep -q "\"12\"" "$p/.designkit/slop-policy.json" && [ ! -e "$p/.claude/slop-policy.json" ]'
check "the scripts are in the new folder and the gate works" '(cd "$p" && node .designkit/scripts/slop-gate.mjs --self-test >/dev/null 2>&1)'
check "skills moved, linked for Claude Code; commands are skills" '[ -f "$p/.agents/skills/no-slop/SKILL.md" ] && [ -L "$p/.claude/skills/no-slop" ] && [ -f "$p/.agents/skills/setup/SKILL.md" ] && [ ! -e "$p/.claude/commands" ]'
check "skills are no longer ignored" '! git -C "$p" check-ignore -q .agents/skills/no-slop/SKILL.md'
check "the kit's own rules file is replaced by the new pair" '[ "$(cat "$p/CLAUDE.md")" = "@AGENTS.md" ] && grep -q "## Working together" "$p/AGENTS.md"'
check "the hooks call the new script, nothing calls the old paths" 'grep -q "designkit/scripts/hook.mjs" "$p/.claude/settings.json" && ! grep -q "claude/scripts" "$p/.claude/settings.json"'
check "no refusal was dropped from the settings" '[ "$(grep -c "Bash(git" "$p/.claude/settings.json")" -ge "$denies_before" ]'
printf '// TODO: tidy this up later\nexport const b = 2\n' >"$app/src/todo.ts"
old_out="$(cd "$p" && printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}}' "$app/src/todo.ts" | node .claude/scripts/slop-gate.mjs --hook)"
check "a chat still open on the old paths gets the same block" 'grep -q "\"decision\":\"block\"" <<<"$old_out"'
check "the app's commit check points at the new folder" 'grep -q "designkit/scripts/slop-gate.mjs" "$app/.husky/pre-commit" && ! grep -q "claude/scripts" "$app/.husky/pre-commit"'
check "the app gains the commit message and push checks" 'grep -q "commit-msg.mjs" "$app/.husky/commit-msg" && grep -q "pre-push.mjs" "$app/.husky/pre-push"'
git -C "$app" add src/todo.ts
(cd "$app" && node "$(git config --get designkit.docs)/.designkit/scripts/slop-gate.mjs" --staged >/dev/null 2>&1)
check "the commit check still refuses a TODO" '[ $? -eq 1 ]'
git -C "$app" reset -q && rm "$app/src/todo.ts"
check "the design folder's commits are checked too" '[ "$(git -C "$p" config core.hooksPath)" = ".designkit/hooks" ]'
check "the project's own documents are untouched" '[ "$(cat "$p/project/PROJECT.md")" = "$(printf "# Tally\n\nA tally counter.")" ]'
check "an older project gains the dev list" '[ -f "$p/project/DEV.md" ]'
check "nothing was committed: the designer's agent reviews first" '[ "$(git -C "$p" rev-list --count HEAD)" = "$commits_before" ] && [ -n "$(git -C "$p" status --porcelain)" ]'
commit_all "$p" "chore(kit): move to the current layout"
commit_all "$app" "chore: point the commit checks at the kit's new folder"
(cd "$p" && bash "$update" </dev/null >"$sandbox/update2.log" 2>&1)
check "running it again changes nothing" '[ -z "$(git -C "$p" status --porcelain)" ] && [ -z "$(git -C "$app" status --porcelain)" ] && grep -q "already current" "$sandbox/update2.log"'
hexp="$HOME/Projects/Hexed"
bash "$old/bin/new-project" "$hexp" >/dev/null 2>&1
mkdir -p "$hexp/Hexed-app/src/features/today"
git -C "$hexp/Hexed-app" init -q -b main
printf 'export const Today = () => <p className="text-[#1a2b3c]">Today</p>\n' >"$hexp/Hexed-app/src/features/today/Today.tsx"
commit_all "$hexp/Hexed-app" "feat: today"
(cd "$hexp" && bash "$update" </dev/null >"$sandbox/hexed.log" 2>&1)
check "a new rule the app already breaks waits as a warning, and says so" '! grep -q "\"dk-10\"" "$hexp/.designkit/slop-policy.json" && grep -q "\"dk-11\"" "$hexp/.designkit/slop-policy.json" && grep -q "dk-10" "$sandbox/hexed.log" && grep -q "warns until" "$sandbox/hexed.log"'
check "a new rule the app passes is on at once" 'grep -q "\"dk-10\"" "$p/.designkit/slop-policy.json" && grep -q "\"dk-11\"" "$p/.designkit/slop-policy.json"'
dvr="$HOME/Projects/DevOwned"
mkdir -p "$dvr/src" && git init -q -b main "$dvr"
printf 'export const a = 1\n' >"$dvr/src/a.ts"
git -C "$dvr" add src/a.ts && git -C "$dvr" -c user.name=Dev -c user.email=dev@example.com commit -qm "feat: start"
(cd "$dvr" && DESIGNKIT_VISIBILITY=private bash "$new/bin/new-project" </dev/null >/dev/null 2>&1)
(cd "$dvr" && bash "$update" </dev/null >"$sandbox/devowned.log" 2>&1)
check "a developer's repo stays clean after an update: the kit and the notes still out of it" 'grep -q "\"devRepo\": true" "$dvr/.designkit/workspace.json" && [ -z "$(git -C "$dvr" status --porcelain)" ] && [ -z "$(git -C "$dvr" ls-files .agents .designkit .claude project)" ]'
fresh="$HOME/Projects/Fresh"
bash "$new/bin/new-project" "$fresh" >/dev/null 2>&1
list() { (cd "$1" && find . \( -name .git -o -name node_modules -o -name "*-app" -o -name project -o -name state \) -prune -o \( -type f -o -type l \) -print | grep -v -e '^./.claude/scripts/' -e '^./.designkit/workspace.json$' -e '^./.gitignore$' | sort); }
check "a moved project holds the same kit files as a new one" '[ "$(list "$p")" = "$(list "$fresh")" ]'
git -C "$fresh" add -A >/dev/null 2>&1; git -C "$fresh" commit -qm "docs: start" >/dev/null 2>&1
(cd "$fresh" && node .designkit/scripts/skills-for.mjs web >/dev/null) && git -C "$fresh" add -A >/dev/null 2>&1 && git -C "$fresh" commit -qm "chore: web guides only" >/dev/null 2>&1
(cd "$fresh" && bash "$update" </dev/null >"$sandbox/fresh.log" 2>&1)
check "an update leaves out the guides the project's platform does not use" '[ ! -e "$fresh/.agents/skills/vercel-react-native-skills" ] && [ ! -e "$fresh/.claude/skills/vercel-react-native-skills" ] && [ -f "$fresh/.agents/skills/shadcn-ui/SKILL.md" ]'
(cd "$fresh" && bash "$new/bin/new-project" </dev/null >"$sandbox/fresh-again.log" 2>&1)
check "new-project in a current project only says it is set up" 'grep -q "already a Design Kit project" "$sandbox/fresh-again.log"'

echo
echo "A project that wrote its own rules and changed kit files (as the first real project did)"
h="$HOME/Projects/Penny"
bash "$old/bin/new-project" "$h" >/dev/null 2>&1
printf '# Penny\n\nNever run Prettier here.\nGate: `node .claude/scripts/slop-gate.mjs`; the app is named in `.claude/workspace.json`.\nScreens: follow `.claude/commands/design-screen.md` and `.claude/skills/no-slop/SKILL.md`.\n' >"$h/CLAUDE.md"
rm "$h/README.md" "$h/THIRD-PARTY-NOTICES.md"
printf '\nOur own rule: no orange.\n' >>"$h/.claude/skills/no-slop/SKILL.md"
printf 'mine\n' >"$h/.claude/agents/bug-hunter.md"
commit_all "$h" "docs: our own rules"
printf 'x\n' >>"$h/project/.keep-dirty" && git -C "$h" add project/.keep-dirty && git -C "$h" commit -qm wip && printf 'y\n' >>"$h/project/.keep-dirty"
(cd "$h" && bash "$update" </dev/null >"$sandbox/dirty.log" 2>&1)
check "unsaved changes: refuses and changes nothing" '[ $? -ne 0 ] && grep -q "unsaved changes" "$sandbox/dirty.log" && [ -f "$h/.claude/workspace.json" ]'
git -C "$h" checkout -q -- project/.keep-dirty
(cd "$h" && bash "$new/bin/new-project" </dev/null >"$sandbox/penny.log" 2>&1)
check "new-project in an old project moves it" 'grep -q "now uses the kit'"'"'s current layout" "$sandbox/penny.log"'
check "hand-written rules kept, only the kit's paths in them fixed" 'grep -q "Never run Prettier here." "$h/CLAUDE.md" && grep -q "node .designkit/scripts/slop-gate.mjs" "$h/CLAUDE.md" && grep -q ".designkit/workspace.json" "$h/CLAUDE.md" && ! grep -q "@AGENTS.md" "$h/CLAUDE.md"'
check "hand-written rules no longer point at the old commands or skills folders" 'grep -q ".agents/skills/design-screen/SKILL.md" "$h/CLAUDE.md" && grep -q ".agents/skills/no-slop/SKILL.md" "$h/CLAUDE.md" && ! grep -q ".claude/commands" "$h/CLAUDE.md"'
check "other agents are pointed at those rules" 'grep -q "CLAUDE.md" "$h/AGENTS.md" && [ "$(wc -l <"$h/AGENTS.md")" -le 2 ]'
check "files the project deleted on purpose stay deleted" '[ ! -e "$h/README.md" ] && [ ! -e "$h/THIRD-PARTY-NOTICES.md" ]'
check "a skill the project changed stays as it is for Claude Code, and is named" '[ ! -L "$h/.claude/skills/no-slop" ] && grep -q "no orange" "$h/.claude/skills/no-slop/SKILL.md" && [ -f "$h/.agents/skills/no-slop/SKILL.md" ] && grep -q ".claude/skills/no-slop" "$sandbox/penny.log"'
check "a reviewer the project rewrote is kept, and named" '[ "$(cat "$h/.claude/agents/bug-hunter.md")" = mine ] && grep -q ".claude/agents/bug-hunter.md" "$sandbox/penny.log"'

echo
echo "A project the old kit joined (code that already existed)"
j="$HOME/Projects/Folio"
mkdir -p "$j/src"
printf '{"name":"folio","scripts":{"lint":"true"}}\n' >"$j/package.json"
printf '# Folio\n\nKeep the deck CSS in one file.\n' >"$j/CLAUDE.md"
printf 'export const a = 1\n' >"$j/src/a.ts"
git -C "$j" init -q -b main && commit_all "$j" "feat: the site"
(cd "$j" && DESIGNKIT_VISIBILITY=private bash "$old/bin/new-project" </dev/null >/dev/null 2>&1)
printf '#!/bin/sh\nd=$(git config --get designkit.docs) || exit 0\nnode "$d/.claude/scripts/slop-gate.mjs" --staged --new-only || exit 1\nnode "$d/.claude/scripts/quick-check.mjs"\n' >"$j/.git/hooks/pre-commit" && chmod +x "$j/.git/hooks/pre-commit"
(cd "$j" && bash "$update" </dev/null >"$sandbox/joined.log" 2>&1)
status=$?
check "moves a joined project" '[ $status -eq 0 ] && grep -q "\"joined\": true" "$j/.designkit/workspace.json"'
check "its rules file keeps its words and loads the kit from the new place" 'grep -q "Keep the deck CSS" "$j/CLAUDE.md" && grep -qx "@.designkit/rules.md" "$j/CLAUDE.md" && ! grep -q "claude/design-kit.md" "$j/CLAUDE.md" && [ -f "$j/.designkit/rules.md" ] && [ ! -e "$j/.claude/design-kit.md" ] && grep -q "designkit/rules.md" "$j/AGENTS.md"'
check "its own commit hook now calls the new folder" 'grep -q "designkit/scripts/slop-gate.mjs" "$j/.git/hooks/pre-commit" && ! grep -q "claude/scripts" "$j/.git/hooks/pre-commit"'
check "local state stays out of git at its new place" 'git -C "$j" check-ignore -q .designkit/state/review.json'
check "the project's code is untouched" 'git -C "$j" diff --quiet HEAD -- src package.json'
mkdir -p "$j/.agents/skills/brandkit" && git -C "$new" show d520e83^:.agents/skills/brandkit/SKILL.md >"$j/.agents/skills/brandkit/SKILL.md"
git -C "$new" show 53558f4^:.agents/skills/vercel-react-best-practices/AGENTS.md >"$j/.agents/skills/vercel-react-best-practices/AGENTS.md"
mkdir -p "$j/.agents/skills/folio-deck" && printf -- '---\nname: folio-deck\ndescription: the deck\n---\n' >"$j/.agents/skills/folio-deck/SKILL.md"
git -C "$j" add -A >/dev/null 2>&1; git -C "$j" commit -qm "chore: kit files" >/dev/null 2>&1
(cd "$j" && bash "$update" </dev/null >"$sandbox/retired.log" 2>&1)
check "a skill the kit retired leaves, the project's own skill stays" '[ ! -e "$j/.agents/skills/brandkit" ] && [ ! -e "$j/.claude/skills/brandkit" ] && [ -f "$j/.agents/skills/folio-deck/SKILL.md" ] && [ ! -e "$j/.agents/skills/vercel-react-best-practices/AGENTS.md" ]'

echo
echo "A public project the old kit joined"
pub="$HOME/Projects/Public"
mkdir -p "$pub" && printf '{}\n' >"$pub/package.json"
git -C "$pub" init -q -b main && commit_all "$pub" first
(cd "$pub" && DESIGNKIT_VISIBILITY=public bash "$old/bin/new-project" </dev/null >/dev/null 2>&1)
(cd "$pub" && bash "$update" </dev/null >"$sandbox/public.log" 2>&1)
check "the kit's files still stay out of its history" '[ -z "$(git -C "$pub" ls-files .designkit .agents .codex .cursor .gemini .opencode .claude)" ] && [ -z "$(git -C "$pub" status --porcelain --untracked-files=all | grep -v -e " CLAUDE.md$" -e " AGENTS.md$" -e " project/DEV.md$")" ]'

echo
echo "Refusals"
mkdir -p "$HOME/Projects/Plain"
(cd "$HOME/Projects/Plain" && bash "$update" </dev/null >"$sandbox/plain.log" 2>&1)
check "a folder that is not a project" '[ $? -ne 0 ] && grep -q "not a Design Kit project" "$sandbox/plain.log"'
bare="$HOME/bare-kit"
rsync -a --exclude .git --exclude node_modules --exclude dev "$kit/" "$bare/"
u="$HOME/Projects/NoHistory"
bash "$old/bin/new-project" "$u" >/dev/null 2>&1
(cd "$u" && bash "$bare/bin/update-project" </dev/null >"$sandbox/bare.log" 2>&1)
check "a kit without its history cannot tell its files from the project's, and says so" '[ $? -ne 0 ] && grep -q "history" "$sandbox/bare.log" && [ -f "$u/.claude/workspace.json" ]'

echo
echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
