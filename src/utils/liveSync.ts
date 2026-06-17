// Hvor ofte den klient-trigget live-synken maks treffer football-data.org.
// Brukes både som DB-throttle-vindu (src/pages/api/v1/matches.ts) og som
// klientens refetch-intervall (src/queries/useMatches.ts) — derfor i en egen,
// dependency-fri modul som er trygg å importere både på server og klient.
export const LIVE_SYNC_INTERVAL_SEKUNDER = 15
