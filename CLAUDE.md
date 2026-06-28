# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` — local Next.js dev server (http://localhost:3000).
- `pnpm build` / `pnpm start` — production build / serve.
- `pnpm lint` / `pnpm lint:fix` — `next lint`.
- `pnpm prettier:check` / `pnpm prettier:write` — formatting. `pnpm format` runs both prettier write and lint fix.
- `pnpm test` — Jest in watch mode. `pnpm test:ci` for CI single-run. Run a single test with `pnpm exec jest path/to/file.test.ts` or `pnpm exec jest -t "test name"`.
- `pnpm test:integration` — API-integrasjonstester (`test/integration/`) mot en lokalt bygd Next-server (`next build` + `next start`) + PGlite (in-memory Postgres) via socket-server. Krever ikke Docker. Egen jest-konfig (`jest.integration.config.js`).
- `pnpm test:e2e` — Playwright e2e (`test/e2e/`) mot samme test-stack. Krever `pnpm exec playwright install chromium` først.
- `pnpm migrate` — `knex migrate:latest` against `PG_URI` (CockroachDB).
- CI (`.github/workflows/workflow.yaml`) runs lint, `test:ci`, and `prettier:check`; a separate `integration-test` job runs `test:integration` + `test:e2e`; pushes to `master` deploy to Vercel.

## Branch-arbeidsflyt

Når du allerede har commitet til en arbeidsbranch og skal fortsette på samme
oppgave senere: sjekk om branchen er merget til `main` først (f.eks.
`git log origin/main` — squash-merge dukker ikke opp i `git branch --merged`).
Er den merget, lag en **ny branch fra oppdatert `main`** i stedet for å bygge
videre på den merge-de branchen.

## Before every commit

Always run `pnpm format` (prettier write + lint fix) before committing. This prevents CI failures on formatting and lint.

Always run `pnpm exec tsc --noEmit` to check TypeScript compilation before committing. The integration-test CI job runs `next build` which includes a full type-check — TypeScript errors that slip through will break that job even if unit tests pass.

Always run `pnpm test:e2e` (Playwright e2e) before committing. The test-stacken bruker PGlite (in-memory Postgres), så det kreves ikke Docker.

## Language and naming

UI strings and many identifiers are Norwegian (e.g., `erIFørsteRunde`, `rundeTilTekst`, `brukere`, `sluttspill`, `regnUtScoreForKamp`). Match the existing language when adding code in a file — don't translate to English.

### Stavemåter som er bevisst inkonsistente

- `topscorer` (én p) er navnet på DB-kolonnen og det tilhørende type-feltet, av historiske
  grunner. I UI-strenger skal det norske ordet **toppscorer** (to p-er) brukes.
  Tilsvarende: `winner` (DB/type) ↔ «vinner» / «verdensmester» (UI).

### Vokabular i UI-strenger

Bruk disse ordene konsistent. Når du står mellom to alternativer i en ny streng,
sjekk her først.

| Konsept | Bruk | Ikke |
|---|---|---|
| Handling, verb | tippe | bette, gjette på |
| Et innsendt tipp (subst.) | tipset (bestemt form), tips (plural) | bet, bets, tippene |
| Kamp uten score satt | ikke tippet, utippet | utipsa, utippa, tippa, manglende bets |
| Spilte kamper-historikk | spilte kamper | tidligere kamper, gamle kamper |
| Liste over kommende kamper | "Tipp kampene" (lenke), "Tipp" (nav) | Mine kamper, Kamper |
| VM-vinner-tipset | vinner (UI), winner (DB/type) | — |
| Toppscorer-tipset | toppscorer (UI), topscorer (DB/type) | top scorer, målkonge |
| Bonus-doblet kamp | joker | wildcard, doubler |
| Lagrings-status | "Lagrer …" → "Lagret" | Saving, Saved |
| Lagre-feil | "Kunne ikke lagre — prøv igjen." | oops, noe gikk galt |
| Slå på/av en bryter | "Slå på" / "Slå av" | Skru på/av, Aktiver |
| Betalt (chip) | "Betalt" / "Ikke betalt" | OK / ⚠️, paid |
| Betalt (full setning) | "Du har betalt" / "Innbetaling mangler" | — |
| Logge ut | "Logg ut" | Logout |

Bokmål, ikke dialekt: `tippet` (ikke `tippa`/`tipsa`), `ikke tippet` (ikke `utipsa`/`utippa`).

## Architecture

This is a private betting pool for a football tournament (currently VM 2026; the active tournament-winner team is in `src/components/results/winner.ts` and top scorer in `topscorer.ts`).

### Stack

Next.js 16 pages router + React 19 + TypeScript, Tailwind v4 med eget brand-token-sett (se `src/styles/global.css` — `@theme`, `bp-card`/`bp-btn-*`/`bp-chip-*`/`bp-overline`/`bp-trophy-bg`) og en lokal shadcn-aktig komponent-mappe under `src/components/ui/` (Button, Switch, TextField, Table, LinkPanel — bygd på `class-variance-authority`). `@tanstack/react-query` for server state, Firebase Auth (Google sign-in) on the client, CockroachDB via `pg` Pool on the server, Knex only for migrations. Deployed to Vercel.

### Request flow

1. Client signs in via Firebase (`src/auth/clientApp.ts`), then sends an ID token in `Authorization: Bearer …` headers from React Query hooks in `src/queries/`.
2. Every `/api/v1/*` handler in `src/pages/api/v1/` wraps its function with `auth(...)` from `src/auth/authHandler.ts`. `auth` verifies the JWT against Google's JWKS (`verifiserIdToken.ts`, audience/issuer pinned to `betpool-2026`), opens a pooled Postgres client, looks up the user row by `firebase_user_id`, and passes `{ req, res, jwtPayload, client, user }` (`ApiHandlerOpts`) to the handler.
3. Pool is process-wide singleton with `max: 1` (Vercel serverless).
4. `NEXT_PUBLIC_MOCK=true` (`erMock()`) makes `auth` bypass JWT/DB entirely and inject a fake `Testy` user — used for local UI work without Firebase/DB.
5. `NEXT_PUBLIC_TEST_AUTH=true` (`erTestAuth()`) enables test-auth mode: `auth` skips JWT verification but keeps the real DB client, resolving the user from an `x-test-user` header or a `betpool_test_user` cookie. The client (`useSession`/`useAuthedFetch`) skips Firebase, and a dev-only `<TestUserSwitcher />` lets you pick which user you are. Powers `test:integration` and `test:e2e`. Never set in production.

### Domain model

Tables (defined in `migrations/`): `users` (with role flags `superadmin`, `paymentadmin`, `scoreadmin`, plus `paid`, `winner`, `topscorer`), `matches` (kampoppsett: `match_num` = football-data.org sin match-id, `round`, `home_team`/`away_team` som tre-bokstavskode/tla, `game_start`, `group`, `stage`), `match_scores` (faktisk resultat + team-override per `match_num`), `bets` (user_id + match_num + predicted home/away score), `chat`. UUIDs på de fleste tabeller; CockroachDB.

Kampoppsettet seedes inn i `matches` av migreringen (fra `src/data/footballDataFixtures.json`) og holdes oppdatert av `/api/cron/sync-matches` (→ `src/server/syncMatches.ts`) som henter fra football-data.org. Vercel free tier tillater bare én cron (brukt til `send-reminders`), så synken trigges av en GitHub Actions-cron (`.github/workflows/sync-matches.yaml`) som POST-er til endepunktet med `CRON_SECRET` (krever repo-secrets `APP_BASE_URL` + `CRON_SECRET`). Lag identifiseres med tre-bokstavskoden (tla); visningsnavn/flagg slås opp i `src/utils/lag.ts` via `landNorsk`/`landFransk`/`landFlagg` (alle nøklet på tla). Sluttspill-lag er tomme i datasettet til de er avgjort — `scoreadmin` setter dem via `home_team_override` i `/sluttspill`. Server-kode leser kamper async via `hentKamper(client)` o.l. i `src/data/matches.ts`; klienten henter via `/api/v1/matches`.

### Scoring (`src/components/results/`)

The interesting business logic. Per match, `regnUtScoreForKamp` looks at all users' bets vs. the actual result and computes a payout where rarer correct answers are worth more:
- Base weighting (`finnVekting`) by tournament round: groups = 1, R16/QF = 2, SF = 3, F = 4 (bronze final = 3).
- "Riktig utfall" (correct H/U/B outcome) pays `vekting * 2` if fewer than 20% of bettors got it, else `vekting`.
- "Riktig resultat" (exact score) pays `vekting * 3` if <15% got it, `vekting * 2` if <30%, else `vekting`.
- `calculateAllBetsExtended` then attaches per-bet point totals AND computes tournament-long bonuses: `winnerPoints` and `topscorerPoints` are awarded by comparing user picks against `winner.ts`/`topscorer.ts`, with a scarcity formula `min(ceil(users*3/correct), 15)`.
- `calculateLeaderboard` (`calculateAllScores.ts`) sums per-bet poeng + winner + topscorer bonuses.

`erIFørsteRunde()` (`src/utils/isInFirstRound.ts`) gates whether other users' `winner`/`topscorer` picks are visible — picks are hidden from other users until the cutoff date in that file.

### Brand-tokens og UI-konvensjoner

`src/styles/global.css` definerer hele design-systemet via Tailwind v4 `@theme` + `@layer components`:

- **Farger** — `gold-50/100/300/500/700/900` (primær aksent), `brand-pitch`/`brand-pitch-light` (fotballbane-grønn), `brand-royal`/`brand-royal-deep` (premie/splash). `stone-*` brukes som nøytral base over hele appen. Bruk tokens, ikke ad-hoc amber/emerald.
- **Komponent-klasser** (`bp-*`) — gjenbrukbare. Foretrekk disse fremfor å bygge mønsteret på nytt:
  - `bp-card` — `rounded-xl bg-white p-4 shadow-xs ring-1 ring-stone-200/70`. Standard hvit kort-overflate. Pakk med `divide-y` eller `space-y-*` ved behov.
  - `bp-btn-primary` / `bp-btn-gold` / `bp-btn-ghost` — knapper. **Bruk `<Button>` fra `src/components/ui/button.tsx`** (cva-variantene `default`/`accent`/`outline`/`ghost` følger samme tokens og legger til `loading`, `icon`, `size`). `bp-btn-*` brukes bare ved ad-hoc lenker som ikke kan være knapp-element.
  - `bp-chip-gold` / `bp-chip-blue` / `bp-chip-green` / `bp-chip-live` — pills/badges. Felles base via gruppert selector.
  - `bp-overline` — seksjons-overskrifter (`text-[11px] font-bold tracking-[0.18em] uppercase text-stone-500`).
  - `bp-tabular` — `font-variant-numeric: tabular-nums`. Bruk på score, poeng og kr-kolonner.
  - `bp-trophy-bg` — royal-radial bakgrunn til splash/premie-modaler. Brukt i `LoadingScreen.tsx`.
- **Loading-animasjoner** — `@layer utilities` har `ls-bar`, `ls-rise`, `ls-spin`, `ls-pulse-ring`, `ls-stamp`, `ls-confetti`, `ls-roll`, `ls-pulse-soft` keyframes. Bruk `animate-[ls-name_…]` i Tailwind i stedet for runtime style-injection (gammelt mønster, ikke gjenta).
- **App-ikon** — `public/favicon.svg` er kilden (Mono VM26-design). PNG-størrelsene (180/192/310/512) i `public/manifest.json` regenereres fra SVG med `rsvg-convert`; `favicon.ico` lages av Python `PIL` fra 16/32/48-rasteriseringer.
- **Hva som *ikke* skal brukes** — ingen `@navikt/ds-react` lenger (alle Aksel-imports er borte). Ikke introduser nytt komponent-bibliotek uten å diskutere.

Den fulle design-handoff-pakken (med prototyper og 6 ikon-/5 loading-screen-varianter) lå i `design_handoff_branding 2/` og ble slettet etter implementasjon — F (Mono VM26) og A (Pokal fylles) er valgt.

### Conventions

- API routes are thin: SQL via `client.query(...)` directly, no ORM layer. Handlers return JSON via `res.json(...)`.
- Server data on the client always goes through a hook in `src/queries/` (`useUser`, `useMatches`, `useAllBets`, etc.) that calls `getIdToken()` and fetches the v1 API.
- Tests live next to the code they cover (e.g. `matchScoreCalculator.test.ts`, `leaderboard.test.ts`); only the scoring layer is unit-tested. `vm22testdata.ts` is a large fixture from the previous tournament used in tests.
- Admin UI surfaces (`/sluttspill`, `/resultatservice`, `/brukere`) are gated in `_app.tsx` by `scoreadmin` / `superadmin` / `paymentadmin` flags from the user row.

### Environment

`PG_URI`, `VM` (optional), `NEXT_PUBLIC_MOCK` (optional), `NEXT_PUBLIC_TEST_AUTH` (optional, test/e2e only — see request flow point 5), `NEXT_PUBLIC_FIREBASE_*` (apiKey, authDomain, storageBucket, messagingSenderId, appId), `CRON_SECRET` (Bearer-token for `/api/cron/*`), `FOOTBALL_DATA_TOKEN` (football-data.org API-token for kamp-synk — `scripts/hent-fixtures-football-data.mjs` og `/api/cron/sync-matches`), and `ANTHROPIC_API_KEY` (Claude API-nøkkel for den AI-genererte morgenrapporten — `src/server/feed/morgenrapportAi.ts`, dry run via `/api/v1/admin/cron/morning-report-ai`).

### Integration & e2e tests

`test/support/testStack.ts` starter PGlite (in-memory Postgres) og legger en socket-server (`@electric-sql/pglite-socket`) foran den, kjører knex-migrasjonene mot den over TCP, og `next build`er så appen og starter en lokal `next start`-server — begge med `NEXT_PUBLIC_TEST_AUTH=true` (a `NEXT_PUBLIC_*` var, so it must be set at build time, not just at runtime). PGlite eksponeres over socket nettopp fordi tre separate prosesser (next-serveren, jest-workerne og Playwright) alle trenger DB-en over en connection-string; `maxConnections`-multiplexeren (PGlite v0.4+) lar dem dele den ene instansen. Migrering og seeding går alltid over TCP, aldri via `db.query()` direkte (socket-serveren holder en eksklusiv lås på instansen). `next dev` is deliberately avoided: its Turbopack compiler-worker farm spawns hundreds of node processes under the test load and OOMs the machine. `test/integration/` holds jest API tests (HTTP against that server, identity via the `x-test-user` header); `test/e2e/` holds Playwright tests (identity via the `betpool_test_user` cookie). Both share `test/support/db.ts` for seeding. Krever ikke Docker.
