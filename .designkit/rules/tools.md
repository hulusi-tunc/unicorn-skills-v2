# Tools on demand

- Outside tools are listed, pinned and checked in `.designkit/tools.lock.json`; none ship inside the
  kit. At these moments run `node .designkit/scripts/tools.mjs --suggest <moment>` and offer what it
  prints in one yes or no line: `auth`, `payments`, `user-data`, `supabase` (the screen or feature
  touches them), `capture`, `ready-for-qa`, `before-uat`, `before-release`, `before-handover`,
  `simplify`, `bug-hunt`. Yes: `--pull <name>`, then use the skill. No: `--decline <name> <moment>`.
- Never install a tool's plugin, hooks or settings, only its skill; never move a pin by hand.
