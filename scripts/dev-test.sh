#!/usr/bin/env bash
# Kjør appen lokalt i test-auth-modus mot en lokal Postgres i Docker.
#
# Bruker `next dev` — du får hot reload. Lar `pnpm dev` være helt urørt;
# denne setter bare env for sin egen økt.
#
#   ./scripts/dev-test.sh
#
# Stopp og rydd opp DB-en når du er ferdig:
#   docker rm -f betpool-pg

set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER=betpool-pg
DB_PORT=5433
APP_PORT=3000
export POSTGRES_URL_NON_POOLING="postgres://postgres:postgres@localhost:${DB_PORT}/postgres"
export NEXT_PUBLIC_TEST_AUTH=true
export NEXT_PUBLIC_MOCK=false

# Port-vakt: hvis 3000 allerede er i bruk (f.eks. en vanlig `pnpm dev`), ville
# `next dev` stille startet på 3001 — og localhost:3000 ville fortsatt truffet
# den andre serveren uten test-auth. Stopp heller med en tydelig feilmelding.
if lsof -ti ":${APP_PORT}" >/dev/null 2>&1; then
    echo "[dev-test] FEIL: port ${APP_PORT} er allerede i bruk."
    echo "           Stopp den andre serveren (f.eks. en vanlig 'pnpm dev') og prøv igjen:"
    echo "             lsof -ti :${APP_PORT} | xargs kill"
    exit 1
fi

if ! docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    echo "[dev-test] starter Postgres-container ($CONTAINER) …"
    docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres -p "${DB_PORT}:5432" postgres:16 >/dev/null
elif [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" != "true" ]; then
    echo "[dev-test] starter eksisterende container ($CONTAINER) …"
    docker start "$CONTAINER" >/dev/null
else
    echo "[dev-test] container ($CONTAINER) kjører allerede"
fi

echo "[dev-test] venter på at Postgres er klar …"
until docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; do sleep 0.5; done

echo "[dev-test] kjører migrasjoner …"
pnpm migrate

echo "[dev-test] seeder testbrukere, bets og resultater …"
node scripts/seed-dev.mjs

echo "[dev-test] starter «next dev» i test-auth-modus på http://localhost:${APP_PORT}"
echo "[dev-test] NB: første sidelast kompilerer on-demand (Turbopack) — gi den noen sekunder."
exec pnpm exec next dev -p "$APP_PORT"
