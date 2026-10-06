#!/usr/bin/env bash
set -uo pipefail

kit="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
sandbox="$(mktemp -d)"
trap 'rm -rf "$sandbox"' EXIT
export HOME="$sandbox"
passed=0
failed=0

check() {
  if eval "$2"; then
    passed=$((passed + 1)); echo "  ok    $1"
  else
    failed=$((failed + 1)); echo "  FAIL  $1"
  fi
}

echo "Setting up a sandbox with a fake upstream change to kill-ai-slop (needs the network)..."
rsync -a --exclude .git --exclude node_modules --exclude dev "$kit/" "$HOME/design-kit/"
mkdir -p "$HOME/origins" "$HOME/.cache/design-kit"
k="$HOME/origins/yetone__kill-ai-slop"
git clone -q https://github.com/yetone/kill-ai-slop.git "$k" || { echo "could not clone yetone/kill-ai-slop"; exit 2; }
git -C "$k" config user.email upstream@example.com
git -C "$k" config user.name Upstream
printf '\nNew tell: fake testimonials.\n' >> "$k/skill/SKILL.md"
git -C "$k" add -A && git -C "$k" commit -qm "feat: new tell"
git clone -q --no-checkout "$k" "$HOME/.cache/design-kit/yetone__kill-ai-slop"

bash "$HOME/design-kit/bin/new-project" "$HOME/projects/Probe" >/dev/null
cd "$HOME/projects/Probe" || exit 2
gate() { node .designkit/scripts/check-upstream.mjs "$@" 2>&1; }

echo
echo "Report"
out="$(gate)"
check "watches the six borrowed skills only" "grep -q 'Watching the 6 borrowed skills' <<<\"\$out\""
check "reports the changed skill" "grep -q '=== kill-ai-slop' <<<\"\$out\""
check "shows the upstream commit and the change" "grep -q 'feat: new tell' <<<\"\$out\" && grep -q 'New tell: fake testimonials' <<<\"\$out\""
check "stays quiet about an unchanged skill" "! grep -q '=== frontend-design' <<<\"\$out\""
check "records the date of the check in both copies" "grep -q '\"checked\"' .designkit/upstream.json && grep -q '\"checked\"' '$HOME/design-kit/.designkit/upstream.json'"

echo
echo "Skip"
gate --skip kill-ai-slop >/dev/null
out="$(gate)"
check "a skipped change stays quiet" "grep -q 'Declined earlier, nothing new since: kill-ai-slop' <<<\"\$out\" && ! grep -q '=== kill-ai-slop' <<<\"\$out\""
check "the skip is recorded in the kit and the project" "grep -q 'kill-ai-slop' '$HOME/design-kit/.designkit/upstream.json' && grep -A2 declined .designkit/upstream.json | grep -q kill-ai-slop"
printf '\nAnother tell.\n' >> "$k/skill/SKILL.md"
git -C "$k" add -A && git -C "$k" commit -qm "feat: another tell"
out="$(gate)"
check "a further upstream change is reported again" "grep -q '=== kill-ai-slop' <<<\"\$out\""

echo
echo "Apply (fetches the real skill with the skills CLI)"
out="$(gate --apply kill-ai-slop)"
status=$?
check "apply refreshes the kit and the project" "[ $status -eq 0 ] && grep -q 'kill-ai-slop: refreshed in the kit and here' <<<\"\$out\""
check "apply ends with the gate self-test" "grep -q 'slop gate self-test: passed' <<<\"\$out\""
check "the skill is present in both copies" "[ -f .agents/skills/kill-ai-slop/SKILL.md ] && [ -f '$HOME/design-kit/.agents/skills/kill-ai-slop/SKILL.md' ] && [ -L .claude/skills/kill-ai-slop ]"
out="$(gate)"
check "after apply, everything is current" "grep -q 'Everything is current' <<<\"\$out\""
out="$(gate --apply nope)"
status=$?
check "an unknown name is refused" "[ $status -ne 0 ] && grep -q 'nope: not a watched skill' <<<\"\$out\""

echo
echo "Offline"
git -C "$HOME/.cache/design-kit/yetone__kill-ai-slop" remote set-url origin /nonexistent/repo
out="$(gate)"
check "an unreachable source is reported, not fatal" "grep -q 'Could not check' <<<\"\$out\" && grep -q 'yetone/kill-ai-slop' <<<\"\$out\""

echo
echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
