#!/usr/bin/env bash
set -uo pipefail

kit="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
sandbox="$(cd "$(mktemp -d)" && pwd -P)"
trap 'rm -rf "$sandbox"' EXIT
export HOME="$sandbox/home"
new="$HOME/design-kit/bin/new-project"
passed=0
failed=0

check() {
  if eval "$2"; then
    passed=$((passed + 1)); echo "  ok    $1"
  else
    failed=$((failed + 1)); echo "  FAIL  $1"
  fi
}

echo "Sandbox home with a copy of the kit and a stand-in for Claude Code (needs the network once)..."
mkdir -p "$HOME/.local/bin" "$HOME/Projects"
rsync -a --exclude .git --exclude node_modules --exclude dev "$kit/" "$HOME/design-kit/"
cat >"$HOME/.local/bin/claude" <<'SH'
#!/usr/bin/env bash
case "${1:-}" in
  --version) echo "$(cat "$HOME/claude-version") (Claude Code)" ;;
  update)
    [ ! -f "$HOME/claude-broken" ] || exit 1
    [ ! -f "$HOME/claude-next" ] || mv "$HOME/claude-next" "$HOME/claude-version"
    ;;
esac
SH
printf '#!/usr/bin/env bash\nexit 1\n' >"$HOME/.local/bin/brew"
chmod +x "$HOME/.local/bin/claude" "$HOME/.local/bin/brew"
echo 1.0.0 >"$HOME/claude-version"
echo 1.0.1 >"$HOME/claude-next"

echo
echo "Install"
bash "$HOME/design-kit/bin/install" </dev/null >"$sandbox/install.log" 2>&1
status=$?
check "finishes" '[ $status -eq 0 ] && grep -q "Ready. To start a project" "$sandbox/install.log"'
check "updates Claude Code and says so" 'grep -q "updated from 1.0.0 to 1.0.1" "$sandbox/install.log"'
check "gate parser installed in the kit" '[ -d "$HOME/design-kit/.designkit/scripts/node_modules/typescript" ]'
bash "$HOME/design-kit/bin/install" </dev/null >"$sandbox/install2.log" 2>&1
status=$?
check "running again is safe and says up to date" '[ $status -eq 0 ] && grep -q "up to date (1.0.1)" "$sandbox/install2.log"'
touch "$HOME/claude-broken"
bash "$HOME/design-kit/bin/install" </dev/null >"$sandbox/install3.log" 2>&1
check "a failed update check is reported, not hidden" 'grep -q "could not check for an update" "$sandbox/install3.log"'
mv "$HOME/.local/bin/claude" "$HOME/claude-stub"
printf '#!/usr/bin/env bash\nexit 0\n' >"$HOME/.local/bin/codex" && chmod +x "$HOME/.local/bin/codex"
bare="$HOME/.local/bin:$(dirname "$(command -v node)"):/usr/bin:/bin"
if PATH="$bare:/opt/homebrew/bin:/usr/local/bin" command -v claude >/dev/null 2>&1; then
  echo "  skip  another agent already installed (a real Claude Code is on the bare PATH)"
else
  PATH="$bare" bash "$HOME/design-kit/bin/install" </dev/null >"$sandbox/install-other.log" 2>&1
  check "another agent already installed: no other is added" 'grep -q "AI agent: codex is installed" "$sandbox/install-other.log" && ! grep -q "Installing Claude Code" "$sandbox/install-other.log"'
fi
rm "$HOME/.local/bin/codex" && mv "$HOME/claude-stub" "$HOME/.local/bin/claude"
check "touches nothing else in the home folder" '[ ! -e "$HOME/.zshrc" ] && [ ! -e "$HOME/.bash_profile" ] && [ ! -e "$HOME/.local/bin/new-project" ]'
mkdir -p "$HOME/Projects/Older/.claude" && printf '{"name":"Older","app":"Older-app"}\n' >"$HOME/Projects/Older/.claude/workspace.json"
(cd "$HOME/Projects/Older" && bash "$HOME/design-kit/bin/install" </dev/null >"$sandbox/install-old.log" 2>&1)
check "run from a project on the old layout, it says how to move it" 'grep -q "older kit" "$sandbox/install-old.log" && grep -q "bin/update-project" "$sandbox/install-old.log"'

echo
echo "New project from the designer's folder"
p="$HOME/Projects/Streakly"
mkdir -p "$p/.claude"
printf '{"permissions":{"allow":["Bash(git clone *)"]}}\n' >"$p/.claude/settings.local.json"
(cd "$p" && bash "$new" </dev/null >"$sandbox/new.log" 2>&1)
status=$?
check "finishes and points to /setup" '[ $status -eq 0 ] && grep -q "Next: /setup" "$sandbox/new.log"'
check "says it is in start mode" 'head -3 "$sandbox/new.log" | grep -q "Start mode"'
check "the folder itself holds the kit" '[ -f "$p/AGENTS.md" ] && [ "$(cat "$p/CLAUDE.md")" = "@AGENTS.md" ] && [ -f "$p/.claude/settings.json" ] && [ -d "$p/project/brief" ]'
check "no kit-only parts copied" '[ ! -e "$p/bin" ] && [ ! -e "$p/dev" ]'
check "app is inside, its own repo" '[ -d "$p/Streakly-app/.git" ]'
check "workspace points at the app inside" 'grep -q "\"app\": \"Streakly-app\"" "$p/.designkit/workspace.json"'
check "app knows where the docs are" '[ "$(git -C "$p/Streakly-app" config designkit.docs)" = ".." ]'
check "docs repo ignores the app" '[ -z "$(git -C "$p" status --porcelain)" ] && git -C "$p" check-ignore -q Streakly-app'
check "one starting commit" '[ "$(git -C "$p" rev-list --count HEAD)" = 1 ]'
check "the design folder's commits are checked for AI signatures and forced pushes" '[ "$(git -C "$p" config core.hooksPath)" = ".designkit/hooks" ] && [ -x "$p/.designkit/hooks/commit-msg" ]'
check "Claude's own local settings kept, not committed" 'grep -q "git clone" "$p/.claude/settings.local.json" && ! git -C "$p" ls-files --error-unmatch .claude/settings.local.json >/dev/null 2>&1'
(cd "$p" && bash "$new" </dev/null >"$sandbox/again.log" 2>&1)
status=$?
check "running again only says it is set up" '[ $status -eq 0 ] && grep -q "already a Design Kit project" "$sandbox/again.log" && [ "$(git -C "$p" rev-list --count HEAD)" = 1 ]'

b="$HOME/Projects/Brief Test"
mkdir -p "$b/refs"
printf 'the brief\n' >"$b/brief.txt"
printf 'mine\n' >"$b/README.md"
printf 'x\n' >"$b/refs/one.png"
bash "$new" "$b" </dev/null >"$sandbox/brief.log" 2>&1
check "brief files move to project/brief and are kept" '[ -f "$b/project/brief/brief.txt" ] && [ "$(cat "$b/project/brief/README.md")" = mine ] && [ -f "$b/project/brief/refs/one.png" ]'
check "kit README not replaced by the designer's" 'grep -q "Design Kit" "$b/README.md"'
check "says the files moved" 'grep -q "3 file(s) already here moved to project/brief" "$sandbox/brief.log"'
check "a name with a space becomes a safe app folder" '[ -d "$b/Brief-Test-app/.git" ] && grep -q "\"name\": \"Brief-Test\"" "$b/.designkit/workspace.json"'
bash "$new" "$HOME/Projects/Fresh" </dev/null >/dev/null 2>&1
check "a folder that does not exist yet is made" '[ -d "$HOME/Projects/Fresh/Fresh-app/.git" ]'

echo
echo "Refusals"
refused() {
  bash "$new" "$@" </dev/null >"$sandbox/refused.log" 2>&1 && return 1
  return 0
}
check "the kit itself" '(cd "$HOME/design-kit" && refused) && [ ! -e "$HOME/design-kit/project/brief/bin" ]'
check "a new folder inside the kit, and it is removed again" 'refused "$HOME/design-kit/Oops" && [ ! -e "$HOME/design-kit/Oops" ]'
check "the home folder" '(cd "$HOME" && refused) && [ ! -e "$HOME/CLAUDE.md" ] && [ ! -e "$HOME/AGENTS.md" ]'
check "Documents" 'mkdir -p "$HOME/Documents" && refused "$HOME/Documents" && [ ! -e "$HOME/Documents/CLAUDE.md" ] && [ ! -e "$HOME/Documents/AGENTS.md" ]'
mkdir -p "$HOME/Projects/Cloned" && rsync -a --exclude .git --exclude node_modules "$HOME/design-kit/" "$HOME/Projects/Cloned/design-kit/"
check "a folder with a copy of the kit inside, and says where it goes" 'refused "$HOME/Projects/Cloned" && grep -q "Move it to ~/design-kit" "$sandbox/refused.log"'
mkdir -p "$HOME/Projects/Busy" && for i in $(seq 1 25); do touch "$HOME/Projects/Busy/f$i"; done
check "a folder with many files in it" 'refused "$HOME/Projects/Busy" && [ -f "$HOME/Projects/Busy/f1" ] && [ ! -e "$HOME/Projects/Busy/CLAUDE.md" ]'

echo
echo "Start mode in an empty repository"
e="$HOME/Projects/Empty"
git init -q -b main "$e" && git -C "$e" remote add origin https://example.com/empty.git
DESIGNKIT_VISIBILITY=private bash "$new" "$e" </dev/null >"$sandbox/empty.log" 2>&1
check "an empty private repository starts a new project, keeps its GitHub link, uploads nothing yet" '[ -f "$e/CLAUDE.md" ] && [ -d "$e/Empty-app/.git" ] && [ "$(git -C "$e" remote get-url origin)" = https://example.com/empty.git ] && grep -q "Start mode" "$sandbox/empty.log" && grep -q "\"share\": false" "$e/.designkit/workspace.json"'
printf '#!/usr/bin/env bash\nexit 1\n' >"$HOME/.local/bin/gh" && chmod +x "$HOME/.local/bin/gh"
ep="$HOME/Projects/EmptyPublic"
git init -q -b main "$ep" && git -C "$ep" remote add origin https://example.com/public-empty.git
check "an empty public, or unknown, repository is refused before anything is copied" 'PATH="$HOME/.local/bin:$PATH" refused "$ep" && grep -q "public" "$sandbox/refused.log" && [ ! -e "$ep/CLAUDE.md" ]'

echo
echo "Joining a project that already has code"
git config --global user.name Nobody
git config --global user.email nobody@example.com
f="$HOME/Projects/Folio"
mkdir -p "$f/src" "$f/.claude/agents"
printf '{"name":"folio","scripts":{"lint":"true"}}\n' >"$f/package.json"
printf '# Folio\n\nKeep the deck CSS in one file.\n' >"$f/CLAUDE.md"
printf 'mine\n' >"$f/.claude/agents/bug-hunter.md"
printf 'export const a = 1\n' >"$f/src/a.ts"
git -C "$f" init -q -b main && git -C "$f" add -A && git -C "$f" commit -qm "feat: the site"
(cd "$f" && bash "$new" </dev/null >"$sandbox/join.log" 2>&1)
status=$?
check "joins instead of refusing, and says it is in join mode" '[ $status -eq 0 ] && head -3 "$sandbox/join.log" | grep -q "Join mode" && grep -q "now has the design kit" "$sandbox/join.log"'
check "the project's code is untouched" '[ "$(cat "$f/src/a.ts")" = "export const a = 1" ] && git -C "$f" diff --quiet HEAD~1 HEAD -- src package.json'
check "CLAUDE.md keeps its words and loads the kit" 'grep -q "Keep the deck CSS" "$f/CLAUDE.md" && grep -qx "@.designkit/rules.md" "$f/CLAUDE.md" && [ -f "$f/.designkit/rules.md" ] && grep -q "designkit/rules.md" "$f/AGENTS.md"'
check "a file the project already has is kept, and named" '[ "$(cat "$f/.claude/agents/bug-hunter.md")" = mine ] && grep -q ".claude/agents/bug-hunter.md" "$sandbox/join.log" && [ -f "$f/.claude/agents/design-reviewer.md" ]'
check "one repository, marked joined" 'grep -q "\"app\": \".\"" "$f/.designkit/workspace.json" && grep -q "\"joined\": true" "$f/.designkit/workspace.json" && [ ! -e "$f/Folio-app" ]'
check "a joined project gets the dev list" '[ -f "$f/project/DEV.md" ]'
check "joined: uploads to GitHub only when the designer says so" 'grep -q "\"share\": false" "$f/.designkit/workspace.json"'
check "one kit commit, nothing left unsaved" '[ "$(git -C "$f" rev-list --count HEAD)" = 2 ] && [ "$(git -C "$f" log -1 --format=%s)" = "chore: add the design kit" ] && [ -z "$(git -C "$f" status --porcelain)" ]'
check "the commit check finds the gate through ." '[ "$(git -C "$f" config designkit.docs)" = . ]'
check "the kit's own test files stay out of the project's test runs" '[ ! -e "$f/.agents/skills/kill-ai-slop/scripts/scan.test.mjs" ] && [ -f "$f/.agents/skills/kill-ai-slop/scripts/scan.mjs" ] && [ -L "$f/.claude/skills/kill-ai-slop" ]'
check "local state stays out of git" 'git -C "$f" check-ignore -q .designkit/state/review.json'
(cd "$f" && bash "$new" </dev/null >"$sandbox/join2.log" 2>&1)
check "running again only says it is set up" 'grep -q "already a Design Kit project" "$sandbox/join2.log" && [ "$(git -C "$f" rev-list --count HEAD)" = 2 ]'
ag="$HOME/Projects/OnlyAgents"
mkdir -p "$ag" && printf '{"name":"onlyagents"}\n' >"$ag/package.json" && printf '# Rules\n\nTabs, never spaces.\n' >"$ag/AGENTS.md"
git -C "$ag" init -q -b main && git -C "$ag" add -A && git -C "$ag" commit -qm first
(cd "$ag" && bash "$new" </dev/null >/dev/null 2>&1)
check "a project with only AGENTS.md: Claude Code still reads it, both load the kit" '[ "$(sed -n 1p "$ag/CLAUDE.md")" = "@AGENTS.md" ] && grep -qx "@.designkit/rules.md" "$ag/CLAUDE.md" && grep -q "Tabs, never spaces" "$ag/AGENTS.md" && grep -q "designkit/rules.md" "$ag/AGENTS.md"'
tw="$HOME/Projects/Styled"
mkdir -p "$tw/app"
printf '{"name":"styled","devDependencies":{"tailwindcss":"^4"}}\n' >"$tw/package.json"
printf '@import "tailwindcss";\n@import "./deck.css";\n\nbody { margin: 0; }\n' >"$tw/app/globals.css"
git -C "$tw" init -q -b main && git -C "$tw" add -A && git -C "$tw" commit -qm "feat: styled site"
(cd "$tw" && bash "$new" </dev/null >"$sandbox/styled.log" 2>&1)
check "Tailwind 4: the kit's folders are kept out of the stylesheet, after the imports" '[ "$(sed -n 3,6p "$tw/app/globals.css")" = "$(printf "@source not \"../.claude\";\n@source not \"../.agents\";\n@source not \"../.designkit\";\n@source not \"../project\";")" ] && [ "$(sed -n 1,2p "$tw/app/globals.css")" = "$(printf "@import \"tailwindcss\";\n@import \"./deck.css\";")" ]'
check "Tailwind 4: its own commit, and the designer is told" '[ "$(git -C "$tw" log -1 --format=%s)" = "chore(styles): keep the design kit out of the stylesheet" ] && grep -q "stylesheet" "$sandbox/styled.log" && [ -z "$(git -C "$tw" status --porcelain)" ]'
u="$HOME/Projects/Unsaved"
mkdir -p "$u" && printf '{}\n' >"$u/package.json"
git -C "$u" init -q -b main && git -C "$u" add -A && git -C "$u" commit -qm first
printf '{"x":1}\n' >"$u/package.json"
check "unsaved changes: refuses and changes nothing" 'refused "$u" && grep -q "unsaved changes" "$sandbox/refused.log" && [ ! -e "$u/.claude" ]'
n="$HOME/Projects/NoHistory"
mkdir -p "$n/node_modules/x" && printf '{"name":"nohistory"}\n' >"$n/package.json" && printf 'KEY=secret\n' >"$n/.env.local" && printf 'x\n' >"$n/node_modules/x/index.js"
bash "$new" "$n" </dev/null >/dev/null 2>&1
check "code without history gets its first commit, then the kit" '[ "$(git -C "$n" rev-list --count HEAD)" = 2 ] && git -C "$n" log --format=%s | grep -q "as it was before the design kit"'
check "that first commit leaves out secrets and installed packages" '! git -C "$n" ls-files | grep -q -e "^.env.local$" -e "^node_modules/"'
mono="$HOME/Projects/Mono"
mkdir -p "$mono/apps/web" && printf '{}\n' >"$mono/apps/web/package.json"
git -C "$mono" init -q -b main && git -C "$mono" add -A && git -C "$mono" commit -qm first
check "a folder inside another repository, and says where to open Claude" 'refused "$mono/apps/web" && grep -q "$mono" "$sandbox/refused.log" && [ ! -e "$mono/apps/web/.git" ] && [ ! -e "$mono/apps/web/CLAUDE.md" ]'
check "the app folder of a kit project, so the kit never lands in the developers' code" 'refused "$p/Streakly-app" && grep -q "app folder" "$sandbox/refused.log" && [ ! -e "$p/Streakly-app/CLAUDE.md" ]'
hk="$HOME/Projects/Hooked"
mkdir -p "$hk" && printf '{"name":"hooked"}\n' >"$hk/package.json" && printf '# Hooked\n' >"$hk/CLAUDE.md"
git -C "$hk" init -q -b main && git -C "$hk" add -A && git -C "$hk" commit -qm first
printf '#!/bin/sh\necho "lint failed here" >&2\nexit 1\n' >"$hk/.git/hooks/pre-commit" && chmod +x "$hk/.git/hooks/pre-commit"
(cd "$hk" && bash "$new" </dev/null >"$sandbox/hooked.log" 2>&1)
status=$?
check "the project's own commit check refuses the join: says why, leaves no trace" '[ $status -ne 0 ] && grep -q "lint failed here" "$sandbox/hooked.log" && ! grep -q "now has the design kit" "$sandbox/hooked.log" && [ ! -e "$hk/.designkit/workspace.json" ] && [ "$(cat "$hk/CLAUDE.md")" = "# Hooked" ] && [ ! -e "$hk/AGENTS.md" ] && [ -z "$(git -C "$hk" status --porcelain)" ]'
rm "$hk/.git/hooks/pre-commit"
(cd "$hk" && bash "$new" </dev/null >"$sandbox/hooked2.log" 2>&1)
check "once that check passes, joining again works" 'grep -q "now has the design kit" "$sandbox/hooked2.log" && [ "$(git -C "$hk" log -1 --format=%s)" = "chore: add the design kit" ]'
pub="$HOME/Projects/Public"
mkdir -p "$pub" && printf '{}\n' >"$pub/package.json"
git -C "$pub" init -q -b main && git -C "$pub" add -A && git -C "$pub" commit -qm first
git -C "$pub" remote add origin https://example.com/public.git
printf '#!/usr/bin/env bash\nexit 1\n' >"$HOME/.local/bin/gh" && chmod +x "$HOME/.local/bin/gh"
(cd "$pub" && PATH="$HOME/.local/bin:$PATH" bash "$new" </dev/null >"$sandbox/public.log" 2>&1)
check "public, or unknown: the kit's files stay out of history" '[ -z "$(git -C "$pub" ls-files .claude)" ] && [ -z "$(git -C "$pub" ls-files .designkit)" ] && [ -f "$pub/.claude/agents/bug-hunter.md" ] && [ -f "$pub/.claude/settings.local.json" ] && [ -z "$(git -C "$pub" status --porcelain)" ] && grep -q "stay on this Mac" "$sandbox/public.log"'
dv="$HOME/Projects/Shared"
mkdir -p "$dv/src" && git init -q -b main "$dv"
printf '# Shared\n' >"$dv/README.md" && printf 'export const a = 1\n' >"$dv/src/a.ts"
git -C "$dv" add README.md src/a.ts && git -C "$dv" -c user.name=Dev -c user.email=dev@example.com commit -qm "feat: start"
(cd "$dv" && DESIGNKIT_VISIBILITY=private bash "$new" </dev/null >"$sandbox/devrepo.log" 2>&1)
check "a repo a dev works in: no kit file and no design note in its history" '[ -z "$(git -C "$dv" ls-files .agents .designkit .claude project)" ] && [ -f "$dv/.agents/skills/no-slop/SKILL.md" ] && [ -f "$dv/project/DEV.md" ] && [ -z "$(git -C "$dv" status --porcelain)" ] && grep -q "\"devRepo\": true" "$dv/.designkit/workspace.json" && grep -q "developer works in" "$sandbox/devrepo.log"'
check "a designer's own repo still carries the kit" '[ -n "$(git -C "$f" ls-files .agents)" ] && ! grep -q devRepo "$f/.designkit/workspace.json"'
own="$HOME/Projects/Mine"
mkdir -p "$own/src" && git init -q -b main "$own"
printf 'export const a = 1\n' >"$own/src/a.ts"
git -C "$own" add src/a.ts && git -C "$own" -c user.email=12345+nobody@users.noreply.github.com commit -qm "feat: start on GitHub"
printf 'export const b = 2\n' >"$own/src/b.ts"
git -C "$own" add src/b.ts && git -C "$own" -c "user.name=dependabot[bot]" -c "user.email=49699333+dependabot[bot]@users.noreply.github.com" commit -qm "chore: bump"
(cd "$own" && DESIGNKIT_VISIBILITY=private bash "$new" </dev/null >"$sandbox/mine.log" 2>&1)
check "a designer's own repo with a web edit and a bot's commit still carries the kit" '[ -n "$(git -C "$own" ls-files .agents)" ] && ! grep -q devRepo "$own/.designkit/workspace.json"'

echo
echo "Slop gate with the app inside the project"
mkdir -p "$p/Streakly-app/src"
printf 'export const a = 1\n' >"$p/Streakly-app/src/clean.ts"
printf '// TODO: tidy this up later\nexport const b = 2\n' >"$p/Streakly-app/src/todo.ts"
hook_out="$(cd "$p" && printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}}' "$p/Streakly-app/src/todo.ts" | node .designkit/scripts/slop-gate.mjs --hook)"
check "save hook blocks a TODO in the app" 'grep -q "\"decision\":\"block\"" <<<"$hook_out" && grep -q "dk-07" <<<"$hook_out"'
mkdir -p "$p/.claude" && cp -R "$HOME/design-kit/.claude/scripts" "$p/.claude/scripts"
old_out="$(cd "$p" && printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}}' "$p/Streakly-app/src/todo.ts" | node .claude/scripts/slop-gate.mjs --hook)"
check "a chat that still calls the old gate path gets the same block" 'grep -q "\"decision\":\"block\"" <<<"$old_out" && grep -q "dk-07" <<<"$old_out"'
rm -rf "$p/.claude/scripts"
clean_out="$(cd "$p" && printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}}' "$p/Streakly-app/src/clean.ts" | node .designkit/scripts/slop-gate.mjs --hook)"
check "save hook passes clean app code" '[ -z "$clean_out" ]'
mkdir -p "$p/project/screens" && printf 'Today \xe2\x80\x94 the first screen\n' >"$p/project/screens/today.md"
docs_out="$(cd "$p" && printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}}' "$p/project/screens/today.md" | node .designkit/scripts/slop-gate.mjs --hook)"
check "docs files get the em dash note, not the app rules" 'grep -q "Em dashes in project/screens/today.md" <<<"$docs_out" && ! grep -q "\"decision\"" <<<"$docs_out"'
(cd "$p" && node .designkit/scripts/slop-gate.mjs --json --no-fail >"$sandbox/scan.json" 2>&1)
check "a scan from the project folder covers the app, labels relative to it" 'grep -q "\"src/todo.ts\"" "$sandbox/scan.json" && ! grep -q "Streakly-app/src" "$sandbox/scan.json"'
git -C "$p/Streakly-app" add src/todo.ts
(cd "$p/Streakly-app" && node "$(git config --get designkit.docs)/.designkit/scripts/slop-gate.mjs" --staged >/dev/null 2>&1)
status=$?
check "commit check from the app finds the docs through .. and refuses" '[ $status -eq 1 ]'

echo
echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
