#!/bin/bash
set -uo pipefail

# PreToolUse-hook (Bash): kjør tsc type-sjekk fra CLAUDE.md før enhver
# `git commit`. Feiler sjekken, blokkeres commiten (exit 2) og feilen mates
# tilbake slik at den kan fikses. Kjører etter format-hooken.

cmd="$(jq -r '.tool_input.command // ""' 2>/dev/null || true)"

# Bare når kommandoen faktisk committer.
case "$cmd" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0

# TypeScript-type-sjekk (rask, ~5s)
if ! tsc_out="$(pnpm exec tsc --noEmit 2>&1)"; then
  {
    echo "Commit blokkert: TypeScript-feil (pnpm exec tsc --noEmit). Fiks og prøv igjen:"
    echo "$tsc_out"
  } >&2
  exit 2
fi

exit 0
