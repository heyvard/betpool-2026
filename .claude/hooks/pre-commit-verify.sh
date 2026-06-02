#!/bin/bash
set -uo pipefail

# PreToolUse-hook (Bash): kjør de blokkerende sjekkene fra CLAUDE.md før enhver
# `git commit`. Feiler en sjekk, blokkeres commiten (exit 2) og feilen mates
# tilbake slik at den kan fikses. Kjører etter format-hooken.
#
#   1. pnpm exec tsc --noEmit   (type-feil knekker ellers `next build` i CI)
#   2. pnpm test:e2e            (Playwright e2e mot PGlite-stacken)

cmd="$(jq -r '.tool_input.command // ""' 2>/dev/null || true)"

# Bare når kommandoen faktisk committer.
case "$cmd" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0

# 1) TypeScript-type-sjekk (rask, ~5s)
if ! tsc_out="$(pnpm exec tsc --noEmit 2>&1)"; then
  {
    echo "Commit blokkert: TypeScript-feil (pnpm exec tsc --noEmit). Fiks og prøv igjen:"
    echo "$tsc_out"
  } >&2
  exit 2
fi

# 2) Playwright e2e (treg: next build + server + browser)
if ! e2e_out="$(pnpm test:e2e 2>&1)"; then
  {
    echo "Commit blokkert: e2e feilet (pnpm test:e2e). Siste linjer:"
    echo "$e2e_out" | tail -60
  } >&2
  exit 2
fi

exit 0
