#!/bin/bash
set -uo pipefail

# PreToolUse-hook (Bash): kjør Playwright e2e fra CLAUDE.md før enhver
# `git push`. Feiler e2e, blokkeres pushen (exit 2) og feilen mates tilbake.
# Lagt på push i stedet for commit fordi e2e er treg (next build + server +
# browser) — da slipper man å betale for den på hver eneste commit.

cmd="$(jq -r '.tool_input.command // ""' 2>/dev/null || true)"

# Bare når kommandoen faktisk pusher.
case "$cmd" in
  *"git push"*) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0

# Playwright e2e (treg: next build + server + browser)
if ! e2e_out="$(pnpm test:e2e 2>&1)"; then
  {
    echo "Push blokkert: e2e feilet (pnpm test:e2e). Siste linjer:"
    echo "$e2e_out" | tail -60
  } >&2
  exit 2
fi

exit 0
