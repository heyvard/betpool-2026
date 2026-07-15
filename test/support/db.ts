import { Client } from 'pg'

// Direkte DB-tilgang mot test-containeren — for seeding og asserts.
// Brukes av både jest-integrasjonstestene og Playwright-e2e.

export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: process.env.TEST_DB_URL })
    await client.connect()
    try {
        return await fn(client)
    } finally {
        await client.end()
    }
}

export async function truncateAll(): Promise<void> {
    await withDb(async (c) => {
        await c.query(
            'TRUNCATE users, bets, chat, feedback, match_scores, leagues, league_members, players, feed_posts CASCADE',
        )
        // tournament_result er et singleton-mønster (rad-id 'current' seedes av
        // migreringen) — TRUNCATE ville fjernet raden og gjort UPDATE ... WHERE id
        // = 'current' i tournament-result.ts til en no-op. Nullstill i stedet.
        // tournament_topscorers tømmes automatisk via players-CASCADE-en over.
        await c.query(`UPDATE tournament_result SET winner_team_tla = null WHERE id = 'current'`)
    })
}

// Et reelt match_num fra `matches`-tabellen (football-data sin id). `match_num`
// er ikke lenger 1..N, så testene må slå opp en faktisk id.
export async function førsteMatchNum(): Promise<number> {
    return withDb(async (c) => {
        const r = await c.query<{ match_num: number }>(`SELECT match_num FROM matches ORDER BY game_start ASC LIMIT 1`)
        return r.rows[0].match_num
    })
}

export interface SeedUser {
    firebase_user_id: string
    name: string
    email: string
    picture: string | null
    active: boolean
    scoreadmin: boolean
    paymentadmin: boolean
    superadmin: boolean
    paid: boolean
    winner: string
    topscorer: string | null
    topscorer_player_id: number | null
    i_hovedliga: boolean
    notif_reminders: boolean
}

// Legger en spiller rett i players-tabellen (football-data sin player-id som primærnøkkel).
export async function seedPlayer(p: { id: number; name: string; team_tla: string }): Promise<void> {
    await withDb((c) =>
        c.query(`INSERT INTO players (id, name, team_tla) VALUES ($1, $2, $3)`, [p.id, p.name, p.team_tla]),
    )
}

export interface SeedBet {
    user_id: string
    match_num: number
    home_score: number
    away_score: number
    joker?: boolean
}

// Legger et tips rett i bets-tabellen — uten å gå via API-et, så det virker
// uavhengig av test-klokka (API-et avviser tips etter kampstart).
export async function seedBet(b: SeedBet): Promise<void> {
    await withDb((c) =>
        c.query(
            `INSERT INTO bets (user_id, match_num, home_score, away_score, joker)
             VALUES ($1,$2,$3,$4,$5)`,
            [b.user_id, b.match_num, b.home_score, b.away_score, b.joker ?? false],
        ),
    )
}

// Setter kampstatus direkte (football-data-status). Brukes til å simulere en
// kamp som pågår (IN_PLAY) uten å kjøre synken.
export async function setMatchStatus(matchNum: number, status: string): Promise<void> {
    await withDb((c) => c.query(`UPDATE matches SET status = $1 WHERE match_num = $2`, [status, matchNum]))
}

// Legger inn et synket (live) delresultat i match_scores — som om synken hentet
// det fra football-data. use_manual blir false, så dette er et live synket
// resultat (ikke admin-satt), og poengene regnes som foreløpige.
export async function seedSyncedScore(matchNum: number, home: number, away: number): Promise<void> {
    await withDb((c) =>
        c.query(
            `INSERT INTO match_scores (match_num, synced_home_ft, synced_away_ft, use_manual, score_synced_at, created_at, updated_at)
             VALUES ($1,$2,$3,false,now(),now(),now())
             ON CONFLICT (match_num) DO UPDATE SET
               synced_home_ft = EXCLUDED.synced_home_ft,
               synced_away_ft = EXCLUDED.synced_away_ft,
               use_manual = false,
               score_synced_at = now(),
               updated_at = now()`,
            [matchNum, home, away],
        ),
    )
}

// Legger inn et synket sluttspill-resultat som gikk forbi ordinær tid — som om
// football-data meldte ordinær tid (rt), ekstraomganger (et), straffer (pen) og
// hvem som gikk videre (winner). `ft` er totalen (inkl. straffer), men det er rt
// som er tippe-resultatet.
export async function seedSyncedKnockoutScore(args: {
    matchNum: number
    ftHome: number
    ftAway: number
    rtHome: number
    rtAway: number
    etHome?: number | null
    etAway?: number | null
    penHome?: number | null
    penAway?: number | null
    duration: string
    winner: string
}): Promise<void> {
    await withDb((c) =>
        c.query(
            `INSERT INTO match_scores
               (match_num, synced_home_ft, synced_away_ft, synced_home_rt, synced_away_rt,
                synced_home_et, synced_away_et, synced_home_pen, synced_away_pen,
                synced_duration, synced_winner, use_manual, score_synced_at, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,now(),now(),now())
             ON CONFLICT (match_num) DO UPDATE SET
               synced_home_ft = EXCLUDED.synced_home_ft,
               synced_away_ft = EXCLUDED.synced_away_ft,
               synced_home_rt = EXCLUDED.synced_home_rt,
               synced_away_rt = EXCLUDED.synced_away_rt,
               synced_home_et = EXCLUDED.synced_home_et,
               synced_away_et = EXCLUDED.synced_away_et,
               synced_home_pen = EXCLUDED.synced_home_pen,
               synced_away_pen = EXCLUDED.synced_away_pen,
               synced_duration = EXCLUDED.synced_duration,
               synced_winner = EXCLUDED.synced_winner,
               use_manual = false,
               score_synced_at = now(),
               updated_at = now()`,
            [
                args.matchNum,
                args.ftHome,
                args.ftAway,
                args.rtHome,
                args.rtAway,
                args.etHome ?? null,
                args.etAway ?? null,
                args.penHome ?? null,
                args.penAway ?? null,
                args.duration,
                args.winner,
            ],
        ),
    )
}

// Legger inn en manuelt satt score i match_scores — som om en scoreadmin satte
// resultatet for hånd. use_manual blir true. På en pågående kamp skal poengene
// fortsatt regnes som foreløpige (live).
export async function seedManualScore(matchNum: number, home: number, away: number): Promise<void> {
    await withDb((c) =>
        c.query(
            `INSERT INTO match_scores (match_num, home_score, away_score, use_manual, created_at, updated_at)
             VALUES ($1,$2,$3,true,now(),now())
             ON CONFLICT (match_num) DO UPDATE SET
               home_score = EXCLUDED.home_score,
               away_score = EXCLUDED.away_score,
               use_manual = true,
               updated_at = now()`,
            [matchNum, home, away],
        ),
    )
}

export async function seedUser(overrides: Partial<SeedUser> = {}): Promise<SeedUser & { id: string }> {
    const fid = overrides.firebase_user_id ?? `user-${Math.random().toString(36).slice(2, 8)}`
    const u: SeedUser = {
        firebase_user_id: fid,
        name: overrides.name ?? fid,
        email: overrides.email ?? `${fid}@test.local`,
        picture: overrides.picture ?? null,
        active: overrides.active ?? true,
        scoreadmin: overrides.scoreadmin ?? false,
        paymentadmin: overrides.paymentadmin ?? false,
        superadmin: overrides.superadmin ?? false,
        paid: overrides.paid ?? false,
        winner: overrides.winner ?? '',
        topscorer: overrides.topscorer ?? null,
        topscorer_player_id: overrides.topscorer_player_id ?? null,
        i_hovedliga: overrides.i_hovedliga ?? true,
        notif_reminders: overrides.notif_reminders ?? true,
    }
    return withDb(async (c) => {
        const r = await c.query(
            `INSERT INTO users
               (firebase_user_id, name, email, picture, active, scoreadmin, paymentadmin, superadmin, paid, winner, topscorer, topscorer_player_id, i_hovedliga, notif_reminders, onboarded_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, NOW())
             RETURNING *`,
            [
                u.firebase_user_id,
                u.name,
                u.email,
                u.picture,
                u.active,
                u.scoreadmin,
                u.paymentadmin,
                u.superadmin,
                u.paid,
                u.winner,
                u.topscorer,
                u.topscorer_player_id,
                u.i_hovedliga,
                u.notif_reminders,
            ],
        )
        return r.rows[0]
    })
}

// Oppretter en privat liga direkte i DB-et. Returnerer liga-id-en.
export async function seedLeague(opts: {
    name: string
    owner_user_id: string
    innsats?: number | null
}): Promise<{ id: string; invite_token: string }> {
    return withDb(async (c) => {
        const r = await c.query<{ id: string; invite_token: string }>(
            `INSERT INTO leagues (name, owner_user_id, innsats)
             VALUES ($1, $2, $3) RETURNING id, invite_token`,
            [opts.name, opts.owner_user_id, opts.innsats ?? null],
        )
        return r.rows[0]
    })
}

// Melder en bruker inn i en liga. Status default 'medlem'.
export async function seedLeagueMember(opts: {
    league_id: string
    user_id: string
    status?: 'invitert' | 'medlem'
    paid?: boolean
}): Promise<void> {
    await withDb((c) =>
        c.query(
            `INSERT INTO league_members (league_id, user_id, status, paid)
             VALUES ($1, $2, $3, $4)`,
            [opts.league_id, opts.user_id, opts.status ?? 'medlem', opts.paid ?? false],
        ),
    )
}
