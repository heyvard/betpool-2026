# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` — local Next.js dev server (http://localhost:3000).
- `pnpm build` / `pnpm start` — production build / serve.
- `pnpm lint` / `pnpm lint:fix` — `next lint`.
- `pnpm prettier:check` / `pnpm prettier:write` — formatting. `pnpm format` runs both prettier write and lint fix.
- `pnpm test` — Jest in watch mode. `pnpm test:ci` for CI single-run. Run a single test with `pnpm exec jest path/to/file.test.ts` or `pnpm exec jest -t "test name"`.
- `pnpm test:integration` — API-integrasjonstester (`test/integration/`) mot en lokalt bygd Next-server (`next build` + `next start`) + Postgres i testcontainers. Krever Docker. Egen jest-konfig (`jest.integration.config.js`).
- `pnpm test:e2e` — Playwright e2e (`test/e2e/`) mot samme test-stack. Krever `pnpm exec playwright install chromium` først.
- `pnpm migrate` — `knex migrate:latest` against `PG_URI` (CockroachDB).
- CI (`.github/workflows/workflow.yaml`) runs lint, `test:ci`, and `prettier:check`; a separate `integration-test` job runs `test:integration` + `test:e2e`; pushes to `master` deploy to Vercel.

## Language and naming

UI strings and many identifiers are Norwegian (e.g., `erIFørsteRunde`, `rundeTilTekst`, `brukere`, `sluttspill`, `regnUtScoreForKamp`). Match the existing language when adding code in a file — don't translate to English.

## Architecture

This is a private betting pool for a football tournament (currently VM 2026; the active tournament-winner team is in `src/components/results/winner.ts` and top scorer in `topscorer.ts`).

### Stack

Next.js 14 pages router + React 18 + TypeScript, Tailwind + `@navikt/ds-react` (NAV's Aksel design system) for UI, `@tanstack/react-query` for server state, Firebase Auth (Google sign-in) on the client, CockroachDB via `pg` Pool on the server, Knex only for migrations. Deployed to Vercel.

### Request flow

1. Client signs in via Firebase (`src/auth/clientApp.ts`), then sends an ID token in `Authorization: Bearer …` headers from React Query hooks in `src/queries/`.
2. Every `/api/v1/*` handler in `src/pages/api/v1/` wraps its function with `auth(...)` from `src/auth/authHandler.ts`. `auth` verifies the JWT against Google's JWKS (`verifiserIdToken.ts`, audience/issuer pinned to `betpool-2026`), opens a pooled Postgres client, looks up the user row by `firebase_user_id`, and passes `{ req, res, jwtPayload, client, user }` (`ApiHandlerOpts`) to the handler.
3. Pool is process-wide singleton with `max: 1` (Vercel serverless).
4. `NEXT_PUBLIC_MOCK=true` (`erMock()`) makes `auth` bypass JWT/DB entirely and inject a fake `Testy` user — used for local UI work without Firebase/DB.
5. `NEXT_PUBLIC_TEST_AUTH=true` (`erTestAuth()`) enables test-auth mode: `auth` skips JWT verification but keeps the real DB client, resolving the user from an `x-test-user` header or a `betpool_test_user` cookie. The client (`useSession`/`useAuthedFetch`) skips Firebase, and a dev-only `<TestUserSwitcher />` lets you pick which user you are. Powers `test:integration` and `test:e2e`. Never set in production.

### Domain model

Tables (defined in `migrations/`): `users` (with role flags `superadmin`, `paymentadmin`, `scoreadmin`, plus `paid`, `winner`, `topscorer`), `matches` (round, teams, scheduled `game_start`, final score), `bets` (user_id + match_id + predicted home/away score), `chat`. UUIDs everywhere; CockroachDB with `uuid_generate_v4()`.

### Scoring (`src/components/results/`)

The interesting business logic. Per match, `regnUtScoreForKamp` looks at all users' bets vs. the actual result and computes a payout where rarer correct answers are worth more:
- Base weighting (`finnVekting`) by tournament round: groups = 1, R16/QF = 2, SF = 3, F = 4 (bronze final = 3).
- "Riktig utfall" (correct H/U/B outcome) pays `vekting * 2` if fewer than 20% of bettors got it, else `vekting`.
- "Riktig resultat" (exact score) pays `vekting * 3` if <15% got it, `vekting * 2` if <30%, else `vekting`.
- `calculateAllBetsExtended` then attaches per-bet point totals AND computes tournament-long bonuses: `winnerPoints` and `topscorerPoints` are awarded by comparing user picks against `winner.ts`/`topscorer.ts`, with a scarcity formula `min(ceil(users*3/correct), 15)`.
- `calculateLeaderboard` (`calculateAllScores.ts`) sums per-bet poeng + winner + topscorer bonuses.

`erIFørsteRunde()` (`src/utils/isInFirstRound.ts`) gates whether other users' `winner`/`topscorer` picks are visible — picks are hidden from other users until the cutoff date in that file.

### Conventions

- API routes are thin: SQL via `client.query(...)` directly, no ORM layer. Handlers return JSON via `res.json(...)`.
- Server data on the client always goes through a hook in `src/queries/` (`useUser`, `useMatches`, `useAllBets`, etc.) that calls `getIdToken()` and fetches the v1 API.
- Tests live next to the code they cover (e.g. `matchScoreCalculator.test.ts`, `leaderboard.test.ts`); only the scoring layer is unit-tested. `vm22testdata.ts` is a large fixture from the previous tournament used in tests.
- Admin UI surfaces (`/sluttspill`, `/resultatservice`, `/brukere`) are gated in `_app.tsx` by `scoreadmin` / `superadmin` / `paymentadmin` flags from the user row.

### Environment

`PG_URI`, `VM` (optional), `NEXT_PUBLIC_MOCK` (optional), `NEXT_PUBLIC_TEST_AUTH` (optional, test/e2e only — see request flow point 5), and `NEXT_PUBLIC_FIREBASE_*` (apiKey, authDomain, storageBucket, messagingSenderId, appId).

### Integration & e2e tests

`test/support/testStack.ts` spins up Postgres in testcontainers, runs the knex migrations against it, then `next build`s the app and starts a local `next start` server — both with `NEXT_PUBLIC_TEST_AUTH=true` (a `NEXT_PUBLIC_*` var, so it must be set at build time, not just at runtime). `next dev` is deliberately avoided: its Turbopack compiler-worker farm spawns hundreds of node processes under the test load and OOMs the machine. `test/integration/` holds jest API tests (HTTP against that server, identity via the `x-test-user` header); `test/e2e/` holds Playwright tests (identity via the `betpool_test_user` cookie). Both share `test/support/db.ts` for seeding. Requires Docker.
