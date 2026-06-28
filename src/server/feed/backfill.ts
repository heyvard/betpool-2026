import { PoolClient } from 'pg'

import { hentHovedligaData, sorterTabell } from './hovedligaData'
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

// Full backfill av feeden: fyller på med morgenrapporter for HELE turneringen —
// fra første ferdigspilte kamp til i dag — i én kjøring. Hver post får et historisk
// korrekt `created_at`, og standings beregnes som-av tidspunktet rapporten skulle
// vært fra (slik at «leder med X poeng» reflekterer stillingen da, ikke nå).
//
// Trygt å kjøre flere ganger, også når feeden allerede er delvis fylt:
// morgenrapporter har UNIQUE på dato — eksisterende poster røres ikke (dedup på dato).

export interface BackfillResultat {
    fraDato: string | null
    tilDato: string
    dager: number
    morgenrapporter: number
}

export async function backfillFeed(client: PoolClient, now: Date = new Date()): Promise<BackfillResultat> {
    const { morgenrapporter, fraDato, dager } = await backfillMorgenrapporter(client, now)
    return { fraDato, tilDato: osloDato(now), dager, morgenrapporter }
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
