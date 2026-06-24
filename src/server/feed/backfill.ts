import { PoolClient } from 'pg'

import { hentHovedligaData, sorterTabell } from './hovedligaData'
import { FerdigKampRow, insertKamppost, lagKamppost } from './genererKamppost'
import {
    beregnJokerStatistikk,
    hentFerdigeKampnumre,
    hentNavn,
    insertMorgenrapport,
    lagreSnapshot,
    RAPPORT_VINDU_TIMER,
    SnapshotRad,
    tellDagerPåTopp,
    velgMorgenScenario,
} from './morgenrapport'
import { osloDagFør, osloDato, osloInstant } from './tid'

// Full backfill av feeden: fyller på med kamp-poster og morgenrapporter for HELE
// turneringen — fra første ferdigspilte kamp til i dag — i én kjøring. Hver post
// får et historisk korrekt `created_at`, og standings beregnes som-av tidspunktet
// eventet skulle vært fra (slik at «leder med X poeng» reflekterer stillingen da,
// ikke nå).
//
// Trygt å kjøre flere ganger, også når feeden allerede er delvis fylt: kamp-poster
// har UNIQUE på (kind, scenario, match_num) og hentes kun når de mangler post,
// morgenrapporter har UNIQUE på dato — eksisterende poster røres ikke. Dvs.
// dedup på kamp (match_num) og dato.

const TIME_MS = 60 * 60 * 1000

export interface BackfillResultat {
    fraDato: string | null
    tilDato: string
    dager: number
    kampposter: number
    morgenrapporter: number
}

interface BackfillKampRow extends FerdigKampRow {
    game_start: string
}

// Tidspunktet en kamp regnes som ferdig: kampstart + 120 minutter (full kamp).
// Vi bruker bevisst IKKE score_synced_at: de fleste resultatene ble bulk-synket
// 13. juni, så det tidspunktet sier ingenting om når kampen faktisk ble avgjort.
// game_start + 120 min gir en historisk korrekt tidslinje for backfillen.
function sluttidspunkt(row: BackfillKampRow): Date {
    return new Date(new Date(row.game_start).getTime() + 2 * TIME_MS)
}

export async function backfillFeed(client: PoolClient, now: Date = new Date()): Promise<BackfillResultat> {
    const kampposter = await backfillKampposter(client, now)
    const { morgenrapporter, fraDato, dager } = await backfillMorgenrapporter(client, now)
    return { fraDato, tilDato: osloDato(now), dager, kampposter, morgenrapporter }
}

// ── Kamp-poster ────────────────────────────────────────────────────────────

// Alle ferdigspilte hovedliga-kamper som ennå mangler en feed-post — uten
// tidsvindu. Dedup på match_num via NOT EXISTS, så allerede-postede kamper hoppes
// over. Eldste først, slik at created_at-rekkefølgen i feeden blir kronologisk.
async function backfillKampposter(client: PoolClient, now: Date): Promise<number> {
    const ferdige = await client.query<BackfillKampRow>(
        `SELECT m.match_num, m.round, m.home_team, m.away_team,
                ms.home_score, ms.away_score,
                ms.home_team_override, ms.away_team_override,
                ms.synced_home_ft, ms.synced_away_ft, ms.use_manual,
                m.game_start::text AS game_start
         FROM matches m
         JOIN match_scores ms ON ms.match_num = m.match_num
         WHERE m.status IN ('FINISHED', 'AWARDED')
           AND ms.synced_home_ft IS NOT NULL
           AND ms.synced_away_ft IS NOT NULL
           AND NOT EXISTS (
               SELECT 1 FROM feed_posts fp WHERE fp.kind = 'kamp' AND fp.match_num = m.match_num
           )
         ORDER BY m.game_start ASC`,
    )

    let postet = 0
    for (const kamp of ferdige.rows) {
        const T = sluttidspunkt(kamp)
        if (T.getTime() > now.getTime()) continue // skulle ikke kunne skje, men vær trygg
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

// Oslo-datoen til den første ferdigspilte kampen — backfillens startpunkt. Alt før
// dette er stille (ingen kamper), så det er ingen vits i å bygge snapshots der.
// Sluttidspunkt = kampstart + 120 min (se `sluttidspunkt`), ikke score_synced_at.
async function finnFørsteKampdato(client: PoolClient): Promise<string | null> {
    const res = await client.query<{ start: string | null }>(
        `SELECT min(m.game_start + interval '120 minutes')::text AS start
         FROM matches m
         JOIN match_scores ms ON ms.match_num = m.match_num
         WHERE m.status IN ('FINISHED', 'AWARDED')
           AND ms.synced_home_ft IS NOT NULL
           AND ms.synced_away_ft IS NOT NULL`,
    )
    const start = res.rows[0]?.start ?? null
    return start ? osloDato(new Date(start)) : null
}

async function backfillMorgenrapporter(
    client: PoolClient,
    now: Date,
): Promise<{ morgenrapporter: number; fraDato: string | null; dager: number }> {
    const iDag = osloDato(now)
    const fraDato = await finnFørsteKampdato(client)
    if (!fraDato) return { morgenrapporter: 0, fraDato: null, dager: 0 }

    // Alle Oslo-datoer fra første kampdag til i dag, stigende. Den eldste er kun
    // baseline (morgenen før første kampslate avgjøres).
    const datoer: string[] = []
    for (let d = iDag; d >= fraDato; d = osloDagFør(d)) {
        datoer.unshift(d)
        if (d === fraDato) break
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
        if (finnes.rowCount && finnes.rowCount > 0) continue // dedup på dato

        // Vindu: siste RAPPORT_VINDU_TIMER t fram til 08:00 norsk tid på rapportdagen.
        const fra = new Date(inst.getTime() - RAPPORT_VINDU_TIMER * 60 * 60 * 1000)
        const ferdigeKampnumre = await hentFerdigeKampnumre(client, fra, inst, 'kampstart')
        const antallKamper = ferdigeKampnumre.length
        if (antallKamper === 0) continue // stille dag

        const { leaderboard, allBets, extended } = await hentHovedligaData(client, inst)
        const tabell = sorterTabell(leaderboard)
        if (tabell.length === 0) continue
        const navnMap = new Map(allBets.users.map((u) => [u.id, u.name]))
        const jokerStatistikk = beregnJokerStatistikk(extended, new Set(ferdigeKampnumre))

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

        // Deterministisk frø (datoen) — backfill skal være reproduserbar og
        // idempotent, så samme dag gir samme tekstvariant ved re-kjøring.
        const valg = velgMorgenScenario({
            tabell,
            navnMap,
            forrigeRader: forrige.rows,
            antallKamper,
            dager: dagerTopp,
            jokerStatistikk,
            frø: dato,
        })
        if (!valg) continue
        if (await insertMorgenrapport(client, { dato, valg, createdAt: inst })) postet++
    }
    return { morgenrapporter: postet, fraDato, dager: datoer.length }
}
