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

echo "[dev-test] seeder testbrukere, bets og resultater (hvis de mangler) …"
docker exec -i "$CONTAINER" psql -U postgres -q <<'SQL'
-- Admin-bruker — kan redigere resultater/sluttspill/brukere.
INSERT INTO users (firebase_user_id, name, email, active, scoreadmin, superadmin, paymentadmin, paid, winner)
VALUES ('test-admin', 'Test Admin', 'admin@test.local', true, true, true, true, true, '')
ON CONFLICT (firebase_user_id) DO NOTHING;

-- 5 vanlige bettere med varierte mesterskaps-tips.
INSERT INTO users (firebase_user_id, name, email, active, paid, winner, topscorer) VALUES
  ('test-user-1', 'Anne Bettelin', 'anne@test.local',  true, true,  'Brazil',    'Vinicius Junior'),
  ('test-user-2', 'Bjørn Tipster', 'bjorn@test.local', true, true,  'France',    'Kylian Mbappé'),
  ('test-user-3', 'Carl Odds',     'carl@test.local',  true, false, 'Argentina', 'Lionel Messi'),
  ('test-user-4', 'Dina Spår',     'dina@test.local',  true, true,  'Brazil',    'Kylian Mbappé'),
  ('test-user-5', 'Even Lykke',    'even@test.local',  true, true,  'Spain',     'Lamine Yamal')
ON CONFLICT (firebase_user_id) DO NOTHING;

-- Bets på kamp 1–5 for hver betterne. Tippene er bevisst varierte: noen treffer
-- eksakt resultat, noen kun riktig utfall, noen bommer — så scoring-logikken vises.
INSERT INTO bets (user_id, match_num, home_score, away_score)
SELECT u.id, t.match_num, t.home_score, t.away_score
FROM (VALUES
  ('test-user-1', 1, 2, 1), ('test-user-1', 2, 1, 0), ('test-user-1', 3, 0, 1), ('test-user-1', 4, 2, 2), ('test-user-1', 5, 0, 0),
  ('test-user-2', 1, 1, 0), ('test-user-2', 2, 0, 0), ('test-user-2', 3, 2, 1), ('test-user-2', 4, 1, 1), ('test-user-2', 5, 2, 1),
  ('test-user-3', 1, 0, 2), ('test-user-3', 2, 1, 1), ('test-user-3', 3, 1, 2), ('test-user-3', 4, 0, 0), ('test-user-3', 5, 1, 1),
  ('test-user-4', 1, 2, 1), ('test-user-4', 2, 0, 0), ('test-user-4', 3, 0, 3), ('test-user-4', 4, 3, 1), ('test-user-4', 5, 2, 2),
  ('test-user-5', 1, 3, 0), ('test-user-5', 2, 2, 2), ('test-user-5', 3, 1, 1), ('test-user-5', 4, 2, 2), ('test-user-5', 5, 0, 1)
) AS t(fid, match_num, home_score, away_score)
JOIN users u ON u.firebase_user_id = t.fid
ON CONFLICT (user_id, match_num) DO NOTHING;

-- Ferdige resultater for kamp 1–5, så leaderboard viser poeng så snart
-- test-klokka flyttes forbi dem.
INSERT INTO match_scores (match_num, home_score, away_score) VALUES
  (1, 2, 1), (2, 0, 0), (3, 1, 2), (4, 2, 2), (5, 1, 1)
ON CONFLICT (match_num) DO NOTHING;
SQL

echo "[dev-test] starter «next dev» i test-auth-modus på http://localhost:${APP_PORT}"
echo "[dev-test] NB: første sidelast kompilerer on-demand (Turbopack) — gi den noen sekunder."
exec pnpm exec next dev -p "$APP_PORT"
