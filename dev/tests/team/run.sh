#!/usr/bin/env bash
set -uo pipefail

kit="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
sandbox="$(cd "$(mktemp -d)" && pwd -P)"
trap 'rm -rf "$sandbox"' EXIT
export HOME="$sandbox/home"
export GIT_CONFIG_GLOBAL="$HOME/.gitconfig"
passed=0
failed=0

check() {
  if eval "$2"; then
    passed=$((passed + 1)); echo "  ok    $1"
  else
    failed=$((failed + 1)); echo "  FAIL  $1"
    [ -z "${out:-}" ] || sed 's/^/        | /' <<<"$out"
  fi
}

mkdir -p "$HOME/github"
rsync -a --exclude .git --exclude node_modules --exclude dev "$kit/" "$HOME/design-kit/"
git config --global user.name Nobody
git config --global user.email nobody@example.com
git init -q --bare -b main "$HOME/github/Tally-docs.git"
git init -q --bare -b main "$HOME/github/Tally-app.git"
sync() { node .designkit/scripts/team-sync.mjs "$@" 2>&1; }
as() { git -C "$1" config user.name "$2"; git -C "$1" config user.email "$(tr '[:upper:]' '[:lower:]' <<<"$2")@example.com"; }
today="$(date +%Y-%m-%d)"

echo "Alice starts the project and shares it (no network needed)"
alice="$HOME/alice/Tally"
bash "$HOME/design-kit/bin/new-project" "$alice" </dev/null >/dev/null 2>&1
as "$alice" Alice; as "$alice/Tally-app" Alice
git -C "$alice" remote add origin "$HOME/github/Tally-docs.git"
git -C "$alice/Tally-app" remote add origin "$HOME/github/Tally-app.git"
mkdir -p "$alice/Tally-app/src" && printf 'export const title = "Balances"\nexport const rows = 10\n' >"$alice/Tally-app/src/screen.ts"
git -C "$alice/Tally-app" add src/screen.ts && git -C "$alice/Tally-app" commit -qm "feat: first screen"
out="$(cd "$alice" && sync --share)"
check "first share pushes both repos" "grep -q 'Shared 1 change(s) to GitHub from the app' <<<\"\$out\" && git -C '$HOME/github/Tally-app.git' rev-parse main >/dev/null 2>&1 && git -C '$HOME/github/Tally-docs.git' rev-parse main >/dev/null 2>&1"
check "the app's GitHub home is recorded and shared" "git -C '$HOME/github/Tally-docs.git' show main:.designkit/workspace.json | grep -q 'Tally-app.git'"
out="$(cd "$alice" && sync --start)"
check "a fresh start with nothing new is quiet" "[ -z \"\$out\" ]"

echo
echo "Bob joins from the link"
bob="$HOME/bob/Tally"
bash "$HOME/design-kit/bin/join-project" "$HOME/github/Tally-docs.git" "$bob" </dev/null >"$sandbox/join.log" 2>&1
status=$?
check "join finishes and says the project is set up" "[ $status -eq 0 ] && grep -q 'no /setup to run' '$sandbox/join.log'"
check "join clones the design folder and the app inside it" "[ -f '$bob/AGENTS.md' ] && [ -f '$bob/Tally-app/src/screen.ts' ] && [ \"\$(git -C '$bob/Tally-app' config designkit.docs)\" = .. ]"
check "join refuses a folder that already has a project" "! bash '$HOME/design-kit/bin/join-project' '$HOME/github/Tally-docs.git' '$bob' </dev/null >/dev/null 2>&1"
as "$bob" Bob; as "$bob/Tally-app" Bob

echo
echo "Claims"
out="$(cd "$bob" && sync --claim Balances)"
check "Bob claims Balances and the team can see it" "grep -q 'Claimed Balances for Bob; the team can see it' <<<\"\$out\" && git -C '$HOME/github/Tally-docs.git' show main:project/WORKING.md | grep -q 'Balances: Bob, since $today'"
out="$(cd "$alice" && sync --claim balances)"
status=$?
check "Alice is told Balances is Bob's" "[ $status -eq 1 ] && grep -q 'claimed by Bob since $today' <<<\"\$out\""
out="$(cd "$alice" && sync --claim Settings)"
check "Alice claims another screen and hears about Bob's" "grep -q 'Claimed Settings for Alice' <<<\"\$out\" && grep -q 'Balances: Bob' <<<\"\$out\""
check "both claims are on GitHub" "git -C '$HOME/github/Tally-docs.git' show main:project/WORKING.md | grep -q 'Balances: Bob' && git -C '$HOME/github/Tally-docs.git' show main:project/WORKING.md | grep -q 'Settings: Alice'"
out="$(cd "$bob" && sync --start)"
check "Bob's next start reports what arrived and who works on what" "grep -q 'Alice: chore: claim Settings' <<<\"\$out\" && grep -q 'Settings: Alice, since $today' <<<\"\$out\""
for i in $(seq 1 12); do printf 'export const step = %s\n' "$i" >"$alice/Tally-app/src/step.ts"; git -C "$alice/Tally-app" add src/step.ts; git -C "$alice/Tally-app" commit -qm "feat: step $i"; done
(cd "$alice" && sync --share >/dev/null)
out="$(cd "$bob" && sync --start)"
check "a long list of arrivals stops at the ten newest" "grep -q 'Alice: feat: step 12' <<<\"\$out\" && ! grep -q 'Alice: feat: step 2\$' <<<\"\$out\" && grep -q 'and 2 more' <<<\"\$out\""
printf -- '- Profile: Bob, since %s\n' "$today" >>"$bob/project/WORKING.md"
git -C "$bob" commit -qam "chore: claim Profile"
(cd "$alice" && sync --claim Help >/dev/null)
out="$(cd "$bob" && sync --share)"
list="$(git -C "$HOME/github/Tally-docs.git" show main:project/WORKING.md)"
check "claims made at the same moment both survive" "grep -q 'Help: Alice' <<<\"\$list\" && grep -q 'Profile: Bob' <<<\"\$list\" && grep -q 'Balances: Bob' <<<\"\$list\" && ! grep -q 'Overlapping' <<<\"\$out\""
grep -v 'Profile' "$bob/project/WORKING.md" >"$sandbox/w" && cp "$sandbox/w" "$bob/project/WORKING.md"
git -C "$bob" commit -qam "chore: release Profile"
(cd "$alice" && sync --claim Search >/dev/null)
(cd "$bob" && sync --share >/dev/null)
list="$(git -C "$HOME/github/Tally-docs.git" show main:project/WORKING.md)"
check "a release at the same moment as a claim: both stick" "grep -q 'Search: Alice' <<<\"\$list\" && ! grep -q 'Profile' <<<\"\$list\""
git -C "$alice" config user.name >/dev/null
noname="$HOME/noname/Tally"
bash "$HOME/design-kit/bin/join-project" "$HOME/github/Tally-docs.git" "$noname" </dev/null >/dev/null 2>&1
git -C "$noname" config --unset user.name 2>/dev/null; git config --global --unset user.name
out="$(cd "$noname" && sync --claim Profile)"
status=$?
check "no name set: asks for the designer's name, claims nothing" "[ $status -eq 2 ] && grep -q 'No name set' <<<\"\$out\""
git config --global user.name Nobody

echo
echo "Overlapping work: first pushed wins, nothing lost"
printf 'export const title = "Balances and debts"\nexport const rows = 10\n' >"$alice/Tally-app/src/screen.ts"
git -C "$alice/Tally-app" commit -qam "feat: longer title"
(cd "$alice" && sync --share >/dev/null)
printf 'export const title = "What you owe"\nexport const rows = 10\n' >"$bob/Tally-app/src/screen.ts"
printf 'export const note = "settle monthly"\n' >"$bob/Tally-app/src/note.ts"
git -C "$bob/Tally-app" add src/screen.ts src/note.ts && git -C "$bob/Tally-app" commit -qm "feat: friendlier title and a note"
out="$(cd "$bob" && sync --share)"
check "Bob's share reports the overlap and where his version is" "grep -q \"GitHub's version stands\" <<<\"\$out\" && grep -q 'src/screen.ts: project/reviews/conflicts/$today/app/src/screen.ts' <<<\"\$out\""
check "Alice's version stands in Bob's app" "grep -q 'Balances and debts' '$bob/Tally-app/src/screen.ts' && ! grep -q 'What you owe' '$bob/Tally-app/src/screen.ts'"
check "Bob's version is saved in his design folder and shared" "grep -q 'What you owe' '$bob/project/reviews/conflicts/$today/app/src/screen.ts' && git -C '$HOME/github/Tally-docs.git' show main:project/reviews/conflicts/$today/app/src/screen.ts | grep -q 'What you owe'"
check "the rest of Bob's commit still went to GitHub, on top of Alice's" "git -C '$HOME/github/Tally-app.git' show main:src/note.ts | grep -q 'settle monthly' && git -C '$HOME/github/Tally-app.git' log --format=%s main | sed -n 2p | grep -q 'longer title'"
check "no rebase left half done" "! [ -d '$bob/Tally-app/.git/rebase-merge' ] && [ -z \"\$(git -C '$bob/Tally-app' status --porcelain)\" ]"

echo
echo "Different parts merge by themselves"
(cd "$alice" && sync --start >/dev/null)
printf 'export const title = "Balances and debts"\nexport const rows = 20\n' >"$alice/Tally-app/src/screen.ts"
git -C "$alice/Tally-app" commit -qam "feat: more rows"
(cd "$alice" && sync --share >/dev/null)
printf 'export const owner = "flat"\n' >"$bob/Tally-app/src/owner.ts"
git -C "$bob/Tally-app" add src/owner.ts && git -C "$bob/Tally-app" commit -qm "feat: owner"
out="$(cd "$bob" && sync --share)"
check "both changes end up together, no overlap reported" "! grep -q 'Overlapping' <<<\"\$out\" && grep -q 'rows = 20' '$bob/Tally-app/src/screen.ts' && git -C '$HOME/github/Tally-app.git' show main:src/owner.ts >/dev/null 2>&1"

echo
echo "Status file changed by two people"
st=project/reviews/STATUS.md
status_file() {
  printf '# Status\n\nLast review: %s, READY, 5 min, report: check-%s.md\nReviewed up to: %s\n\n## Open\n' "$1" "$1" "$2"
  shift 2
  for line in "$@"; do printf -- '- %s\n' "$line"; done
  printf '\n## Left on purpose\n'
}
(cd "$alice" && sync --start >/dev/null)
status_file 2026-10-05 aaaaaaa shared >"$alice/$st"
git -C "$alice" add "$st" && git -C "$alice" commit -qm "docs(reviews): review up to aaaaaaa"
(cd "$alice" && sync --share >/dev/null)
(cd "$bob" && sync --start >/dev/null)
status_file 2026-10-06 bbbbbbb shared alice-found >"$alice/$st"
git -C "$alice" commit -qam "docs(reviews): review up to bbbbbbb"
(cd "$alice" && sync --share >/dev/null)
status_file 2026-10-07 ccccccc bob-found >"$bob/$st"
git -C "$bob" commit -qam "docs(reviews): review up to ccccccc"
out="$(cd "$bob" && sync --share)"
merged="$(git -C "$HOME/github/Tally-docs.git" show "main:$st")"
check "a status clash keeps the later review's marker" "grep -q 'Reviewed up to: ccccccc' <<<\"\$merged\""
check "a status clash keeps what both sides found" "grep -q -- '- alice-found' <<<\"\$merged\" && grep -q -- '- bob-found' <<<\"\$merged\""
check "a line the later review fixed stays gone, and no overlap is reported" "! grep -q -- '- shared' <<<\"\$merged\" && ! grep -q 'Overlapping' <<<\"\$out\""

echo
echo "One repository (a joined project)"
one="$HOME/one/Folio"
mkdir -p "$one/.designkit/scripts"
cp "$HOME/design-kit/.designkit/scripts/team-sync.mjs" "$HOME/design-kit/.designkit/scripts/status.mjs" "$one/.designkit/scripts/"
printf '{"name":"Folio","app":".","joined":true}\n' >"$one/.designkit/workspace.json"
git init -q --bare -b main "$HOME/github/Folio.git"
git -C "$one" init -q -b main && as "$one" Solo
git -C "$one" add .designkit && git -C "$one" commit -qm "chore: start"
git -C "$one" remote add origin "$HOME/github/Folio.git"
printf '#!/bin/sh\nexit 1\n' >"$one/.git/hooks/pre-commit" && chmod +x "$one/.git/hooks/pre-commit"
out="$(cd "$one" && sync --claim Home)"
status=$?
check "a claim the commit check refuses is reported, and leaves nothing behind" "[ $status -ne 0 ] && grep -q 'Could not save the claim' <<<\"\$out\" && [ -z \"\$(git -C '$one' status --porcelain)\" ]"
rm "$one/.git/hooks/pre-commit"
out="$(cd "$one" && sync --claim About)"
check "joined, not uploading: a claim says it is here only" "grep -q 'Claimed About for Solo, here only' <<<\"\$out\""
out="$(cd "$one" && sync --start)"
check "joined: the first chat uploads nothing" "! git -C '$HOME/github/Folio.git' rev-parse -q --verify main >/dev/null 2>&1"
out="$(cd "$one" && sync --share)"
check "joined: a commit stays here until the designer says so, and says so" "! git -C '$HOME/github/Folio.git' rev-parse -q --verify main >/dev/null 2>&1 && grep -q 'only when the designer says so' <<<\"\$out\""
out="$(cd "$one" && sync --share --now)"
check "joined: shared once, as the project, when the designer asks" "[ \"\$(grep -c 'Shared' <<<\"\$out\")\" = 1 ] && grep -q 'from the project' <<<\"\$out\" && git -C '$HOME/github/Folio.git' rev-parse main >/dev/null 2>&1"
check "no app home is recorded for a single repository" "! grep -q appRemote '$one/.designkit/workspace.json'"
printf '{"name":"Folio","app":".","joined":true,"share":true}\n' >"$one/.designkit/workspace.json"
git -C "$one" commit -qam "chore: share after each commit"
out="$(cd "$one" && sync --share)"
check "joined, after a yes: each commit is shared" "grep -q 'Shared 1 change(s) to GitHub from the project' <<<\"\$out\" && [ \"\$(git -C '$HOME/github/Folio.git' log -1 --format=%s main)\" = 'chore: share after each commit' ]"

two="$HOME/one2/Folio"
git clone -q "$HOME/github/Folio.git" "$two" && as "$two" Other
mkdir -p "$one/src" && printf 'export const a = "mine"\n' >"$one/src/a.ts"
git -C "$one" add src/a.ts && git -C "$one" commit -qm "feat: a" && (cd "$one" && sync --share >/dev/null)
(cd "$two" && sync --start >/dev/null)
printf 'export const a = "one"\n' >"$one/src/a.ts" && git -C "$one" commit -qam "feat: one's a" && (cd "$one" && sync --share >/dev/null)
printf 'export const a = "two"\n' >"$two/src/a.ts" && git -C "$two" commit -qam "feat: two's a"
out="$(cd "$two" && sync --share)"
check "joined: an overlapping copy is kept as text, not as code the site builds" "[ -f '$two/project/reviews/conflicts/$today/project/src/a.ts.txt' ] && [ ! -e '$two/project/reviews/conflicts/$today/project/src/a.ts' ] && grep -q 'a.ts.txt' <<<\"\$out\""
three="$HOME/one3/Folio"
bash "$HOME/design-kit/bin/join-project" "$HOME/github/Folio.git" "$three" </dev/null >"$sandbox/join-one.log" 2>&1
status=$?
check "a teammate joins a joined project: one folder, the checks find the gate" "[ $status -eq 0 ] && ! grep -q 'app folder here is empty' '$sandbox/join-one.log' && [ \"\$(git -C '$three' config designkit.docs)\" = . ] && git -C '$three' check-ignore -q .designkit/state/review.json && [ -f '$three/src/a.ts' ]"

echo
echo "Unsaved work and no GitHub home"
printf 'export const draft = 1\n' >>"$bob/Tally-app/src/owner.ts"
printf 'export const later = 1\n' >"$alice/Tally-app/src/later.ts"
git -C "$alice/Tally-app" add src/later.ts && git -C "$alice/Tally-app" commit -qm "feat: later" && (cd "$alice" && sync --share >/dev/null)
before="$(git -C "$bob/Tally-app" rev-parse HEAD)"
out="$(cd "$bob" && sync --start)"
check "unsaved work: says so and pulls nothing over it" "grep -q 'unsaved work from last time' <<<\"\$out\" && [ \"\$(git -C '$bob/Tally-app' rev-parse HEAD)\" = '$before' ] && grep -q 'draft' '$bob/Tally-app/src/owner.ts'"
(cd "$bob" && sync --release Balances >/dev/null)
check "release removes the claim, for the team too" "! grep -q 'Balances' '$bob/project/WORKING.md' && ! git -C '$HOME/github/Tally-docs.git' show main:project/WORKING.md | grep -q 'Balances'"
check "release leaves unsaved app work alone" "grep -q 'draft' '$bob/Tally-app/src/owner.ts'"
check "claim and release refuse to run in the kit" "! (cd '$HOME/design-kit' && node .designkit/scripts/team-sync.mjs --claim X >/dev/null 2>&1) && [ ! -e '$HOME/design-kit/project/WORKING.md' ]"
local_only="$HOME/solo/Solo"
bash "$HOME/design-kit/bin/new-project" "$local_only" </dev/null >/dev/null 2>&1
as "$local_only" Solo
check "no GitHub home: start says so" "grep -q 'no GitHub home yet' <<<\"\$(cd '$local_only' && sync --start)\""
check "no GitHub home: share keeps commits here" "grep -q 'stay on this Mac' <<<\"\$(cd '$local_only' && sync --share)\""
check "no GitHub home: claim is local" "grep -q 'here only' <<<\"\$(cd '$local_only' && sync --claim Today)\""
check "in the kit itself, start is silent" "[ -z \"\$(cd '$HOME/design-kit' && node .designkit/scripts/team-sync.mjs --start 2>&1)\" ]"

echo
echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
