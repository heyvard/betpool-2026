#!/bin/bash
set -euo pipefail

# Bare nødvendig i Claude Code på web (remote-container). Lokalt antar vi at
# utvikleren allerede har kjørt pnpm install / playwright install selv.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Installer node-avhengigheter. pnpm install (ikke --frozen-lockfile) gjør at
# containeren kan caches og at gjentatte kjøringer er raske/idempotente.
corepack enable
pnpm install

# Last ned Chromium til Playwright slik at pnpm test:e2e er klar med en gang.
pnpm exec playwright install chromium
