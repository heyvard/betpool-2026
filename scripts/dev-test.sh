#!/usr/bin/env bash
# Kjør appen lokalt i test-auth-modus mot en lokal Postgres i Docker.
#
# Bruker `next build` + `next start` — IKKE `next dev`. Det er samme oppsett
# som test-stacken (test/support/testStack.ts) og er den eneste måten som er
# kjent stabil i dette repoet: `next dev` (Turbopack) spawner en kompilator-
# worker-farm som spiser minne. `next start` er én produksjonsprosess.
# I tillegg bakes `NEXT_PUBLIC_TEST_AUTH` inn ved BUILD-tid, så den MÅ settes
# før `next build`.
#
# Lar `pnpm dev` være helt urørt — denne setter bare env for sin egen økt.
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

echo "[dev-test] seeder testbruker (hvis den mangler) …"
docker exec -i "$CONTAINER" psql -U postgres -q <<'SQL'
INSERT INTO users (firebase_user_id, name, email, active, scoreadmin, superadmin, paymentadmin, paid, winner)
VALUES ('test-admin', 'Test Admin', 'admin@test.local', true, true, true, true, true, '')
ON CONFLICT (firebase_user_id) DO NOTHING;
SQL

echo "[dev-test] bygger appen (next build — NEXT_PUBLIC_TEST_AUTH bakes inn her) …"
pnpm exec next build

echo "[dev-test] starter «next start» i test-auth-modus på http://localhost:${APP_PORT}"
pnpm exec next start -p "$APP_PORT"
