#!/bin/bash
set -euo pipefail

# PreToolUse-hook (Bash): kjør `pnpm format` (prettier write + lint fix) før
# enhver `git commit`, og re-stage filene som allerede var staget slik at
# formateringen havner i selve commiten. Hindrer at uformatert kode committes
# og knekker `prettier:check` i CI.

cmd="$(jq -r '.tool_input.command // ""' 2>/dev/null || true)"

# Bare når kommandoen faktisk committer.
case "$cmd" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0

# Husk hvilke filer som var staget, formater, og re-stage bare de samme filene
# (NUL-separert, så filnavn med mellomrom håndteres riktig).
staged="$(mktemp)"
git diff --cached --name-only --diff-filter=ACM -z > "$staged" 2>/dev/null || true
pnpm format > /dev/null 2>&1 || true
if [ -s "$staged" ]; then
  git add --pathspec-from-file="$staged" --pathspec-file-nul || true
fi
rm -f "$staged"
exit 0
