import { PoolClient } from 'pg'

import { hentHovedligaData, sorterTabell } from './hovedligaData'
import { FerdigKampRow, insertKamppost, lagKamppost } from './genererKamppost'
import {
    hentNavn,
    insertMorgenrapport,
    lagreSnapshot,
    SnapshotRad,
    tellDagerPåTopp,
    tellFerdigeKamper,
    velgMorgenScenario,
} from './morgenrapport'
import { osloDagFør, osloDato, osloInstant } from './tid'

// Engangs-backfill av feeden: fyller på med kamp-poster og morgenrapporter for de
// siste `dager` dagene. Hver post får et historisk korrekt `created_at`, og
// standings beregnes som-av tidspunktet eventet skulle vært fra (slik at
// «leder med X poeng» reflekterer stillingen da, ikke nå).
//
// Trygt å kjøre flere ganger: kamp-poster har UNIQUE på match_num, morgenrapporter
// UNIQUE på dato — eksisterende poster røres ikke.

const TIME_MS = 60 * 60 * 1000

export interface BackfillResultat {
    dager: number
    kampposter: number
    morgenrapporter: number
}

interface BackfillKampRow extends FerdigKampRow {
    score_synced_at: string | null
    game_start: string
}

// Tidspunktet en kamp ble ferdig: synket-tidspunkt om vi har det, ellers
// kampstart + ~2 timer (full kamp).
function sluttidspunkt(row: BackfillKampRow): Date {
    if (row.score_synced_at) return new Date(row.score_synced_at)
    return new Date(new Date(row.game_start).getTime() + 2 * TIME_MS)
}

export async function backfillFeed(client: PoolClient, dager = 2, now: Date = new Date()): Promise<BackfillResultat> {
    const kampposter = await backfillKampposter(client, dager, now)
    const morgenrapporter = await backfillMorgenrapporter(client, dager, now)
    return { dager, kampposter, morgenrapporter }
}

// ── Kamp-poster ────────────────────────────────────────────────────────────

async function backfillKampposter(client: PoolClient, dager: number, now: Date): Promise<number> {
    const vinduStart = new Date(now.getTime() - dager * 24 * TIME_MS)
    const ferdige = await client.query<BackfillKampRow>(
        `SELECT m.match_num, m.round, m.home_team, m.away_team,
                ms.home_score, ms.away_score,
                ms.home_team_override, ms.away_team_override,
                ms.synced_home_ft, ms.synced_away_ft, ms.use_manual,
                ms.score_synced_at::text AS score_synced_at, m.game_start::text AS game_start
         FROM matches m
         JOIN match_scores ms ON ms.match_num = m.match_num
         WHERE m.status IN ('FINISHED', 'AWARDED')
           AND ms.synced_home_ft IS NOT NULL
           AND ms.synced_away_ft IS NOT NULL
           AND COALESCE(ms.score_synced_at, m.game_start + interval '2 hours') >= $1
           AND COALESCE(ms.score_synced_at, m.game_start + interval '2 hours') <= $2
           AND NOT EXISTS (
               SELECT 1 FROM feed_posts fp WHERE fp.kind = 'kamp' AND fp.match_num = m.match_num
           )
         ORDER BY COALESCE(ms.score_synced_at, m.game_start) ASC`,
        [vinduStart.toISOString(), now.toISOString()],
    )

    let postet = 0
    for (const kamp of ferdige.rows) {
        const T = sluttidspunkt(kamp)
        // Standings som-av kampens slutt: hentHovedligaData filtrerer bort kamper
        // som startet etter T, så vi får den historiske stillingen.
        const hd = await hentHovedligaData(client, T)
        const post = lagKamppost(kamp, hd)
        if (!post) continue
        if (await insertKamppost(client, kamp.match_num, post, T)) postet++
    }
    return postet
}

// ── Morgenrapporter ────────────────────────────────────────────────────────

async function backfillMorgenrapporter(client: PoolClient, dager: number, now: Date): Promise<number> {
    const iDag = osloDato(now)

    // Datoer fra (i dag − dager) til i dag, stigende. Den eldste er kun baseline.
    const datoer: string[] = []
    let d = iDag
    for (let i = 0; i <= dager; i++) {
        datoer.unshift(d)
        d = osloDagFør(d)
    }

    // Pass 1: bygg snapshot-kjeden ved å beregne stillingen kl 08:00 hver dag.
    for (const dato of datoer) {
        const inst = osloInstant(dato, 8)
        if (inst.getTime() > now.getTime()) continue // morgenen har ikke kommet ennå
        const { leaderboard } = await hentHovedligaData(client, inst)
        await lagreSnapshot(client, dato, sorterTabell(leaderboard))
    }

    // Pass 2: lag rapporter for de siste rapport-datoene (alle unntatt eldste baseline).
    let postet = 0
    for (const dato of datoer.slice(1)) {
        const inst = osloInstant(dato, 8)
        if (inst.getTime() > now.getTime()) continue

        const finnes = await client.query(`SELECT 1 FROM feed_posts WHERE kind = 'morgenrapport' AND dato = $1`, [dato])
        if (finnes.rowCount && finnes.rowCount > 0) continue

        const iGår = osloDagFør(dato)
        const antallKamper = await tellFerdigeKamper(client, iGår)
        if (antallKamper === 0) continue // stille dag

        const { leaderboard, allBets } = await hentHovedligaData(client, inst)
        const tabell = sorterTabell(leaderboard)
        if (tabell.length === 0) continue
        const navnMap = new Map(allBets.users.map((u) => [u.id, u.name]))

        const forrigeDatoRes = await client.query<{ dato: string }>(
            `SELECT max(dato)::text AS dato FROM feed_standings_snapshot WHERE dato < $1`,
            [dato],
        )
        const forrigeDato = forrigeDatoRes.rows[0]?.dato ?? null
        if (!forrigeDato) continue // ingen baseline

        const forrige = await client.query<SnapshotRad>(
            `SELECT user_id, plass, poeng FROM feed_standings_snapshot WHERE dato = $1`,
            [forrigeDato],
        )
        const forrigeLederId = forrige.rows.find((r) => r.plass === 1)?.user_id ?? null
        if (forrigeLederId && !navnMap.has(forrigeLederId)) {
            navnMap.set(forrigeLederId, await hentNavn(client, forrigeLederId))
        }
        const dagerTopp = forrigeLederId ? await tellDagerPåTopp(client, forrigeLederId, forrigeDato) : 0

        const valg = velgMorgenScenario({ tabell, navnMap, forrigeRader: forrige.rows, antallKamper, dager: dagerTopp })
        if (!valg) continue
        if (await insertMorgenrapport(client, { dato, valg, createdAt: inst })) postet++
    }
    return postet
}
