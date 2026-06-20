import { PoolClient } from 'pg'

import { hentHovedligaData, sorterTabell } from './hovedligaData'
import { malEndring, malLederbytte, MalResultat } from './maler'
import { osloDato, osloGårsdagDato } from './tid'

export interface MorgenrapportResultat {
    postet: boolean
    grunn?: 'allerede_postet' | 'stille_dag' | 'ingen_baseline'
    scenario?: 'endring' | 'lederbytte'
    antallKamper?: number
}

interface SnapshotRad {
    user_id: string
    plass: number
    poeng: number
}

// Morgenrapport for hovedligaen (Æresligaen). Oppsummerer endringer i tabellen
// siden forrige (aktive) dag. Poster ingenting på stille dager (ingen kamper ble
// ferdige i går). Forutsetter at klokka allerede er sjekket til 08 i Oslo av
// cron-handleren — UNIQUE på dato hindrer dobbel-post uansett.
export async function genererMorgenrapport(client: PoolClient, now: Date = new Date()): Promise<MorgenrapportResultat> {
    const iDag = osloDato(now)
    const iGår = osloGårsdagDato(now)

    // Idempotent: allerede postet i dag?
    const finnes = await client.query(`SELECT 1 FROM feed_posts WHERE kind = 'morgenrapport' AND dato = $1`, [iDag])
    if (finnes.rowCount && finnes.rowCount > 0) return { postet: false, grunn: 'allerede_postet' }

    // Kamper som ble ferdige i går (Oslo-tid). Stille dag → ingen post.
    const ferdigeIGår = await client.query<{ antall: string }>(
        `SELECT count(*) AS antall
         FROM matches m
         JOIN match_scores ms ON ms.match_num = m.match_num
         WHERE ms.synced_home_ft IS NOT NULL
           AND ms.synced_away_ft IS NOT NULL
           AND (COALESCE(ms.score_synced_at, m.game_start) AT TIME ZONE 'Europe/Oslo')::date = $1`,
        [iGår],
    )
    const antallKamper = parseInt(ferdigeIGår.rows[0]?.antall ?? '0', 10)
    if (antallKamper === 0) return { postet: false, grunn: 'stille_dag' }

    // Dagens stilling.
    const { leaderboard, allBets } = await hentHovedligaData(client, now)
    const tabell = sorterTabell(leaderboard)
    if (tabell.length === 0) return { postet: false, grunn: 'stille_dag' }
    const navnMap = new Map(allBets.users.map((u) => [u.id, u.name]))
    const nyPlassMap = new Map(tabell.map((r, i) => [r.userid, i + 1]))

    // Forrige snapshot (siste dato før i dag).
    const forrigeDatoRes = await client.query<{ dato: string }>(
        `SELECT max(dato)::text AS dato FROM feed_standings_snapshot WHERE dato < $1`,
        [iDag],
    )
    const forrigeDato = forrigeDatoRes.rows[0]?.dato ?? null

    // Lagre dagens snapshot uansett (til neste morgen).
    const lagreSnapshot = async () => {
        for (const [userid, plass] of nyPlassMap) {
            const poeng = leaderboard.find((r) => r.userid === userid)?.poeng ?? 0
            await client.query(
                `INSERT INTO feed_standings_snapshot (dato, user_id, plass, poeng)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (dato, user_id) DO UPDATE SET plass = EXCLUDED.plass, poeng = EXCLUDED.poeng`,
                [iDag, userid, plass, poeng],
            )
        }
    }

    // Ingen baseline (første aktive dag) → kan ikke regne endring. Lagre snapshot,
    // men ikke post.
    if (!forrigeDato) {
        await lagreSnapshot()
        return { postet: false, grunn: 'ingen_baseline' }
    }

    const forrige = await client.query<SnapshotRad>(
        `SELECT user_id, plass, poeng FROM feed_standings_snapshot WHERE dato = $1`,
        [forrigeDato],
    )
    const forrigePlassMap = new Map(forrige.rows.map((r) => [r.user_id, r.plass]))
    const forrigeLederId = forrige.rows.find((r) => r.plass === 1)?.user_id ?? null
    const nyLederId = tabell[0].userid

    let scenario: 'endring' | 'lederbytte'
    let mal: MalResultat
    const data: Record<string, unknown> = { antallKamper }

    if (forrigeLederId && forrigeLederId !== nyLederId) {
        // lederbytte (prioritert)
        scenario = 'lederbytte'
        const luke = tabell.length > 1 ? Math.max(0, tabell[0].poeng - tabell[1].poeng) : tabell[0].poeng
        const dager = await tellDagerPåTopp(client, forrigeLederId, forrigeDato)
        const nyLeder = tabell[0].userName
        const gammelLeder = navnMap.get(forrigeLederId) ?? (await hentNavn(client, forrigeLederId))
        mal = malLederbytte({ nyLeder, gammelLeder, luke: String(luke), dager })
        const topp3 = tabell.slice(0, 3).map((r, i) => ({
            plass: i + 1,
            navn: r.userName,
            poeng: r.poeng,
            leder: i === 0,
        }))
        Object.assign(data, { nyLeder, gammelLeder, luke, dager, topp3 })
    } else {
        // endring
        scenario = 'endring'
        const bevegelser = tabell
            .filter((r) => forrigePlassMap.has(r.userid))
            .map((r) => {
                const nyPlass = nyPlassMap.get(r.userid)!
                const deltaPlass = forrigePlassMap.get(r.userid)! - nyPlass // positiv = klatret
                return { navn: r.userName, deltaPlass, nyPlass }
            })
            .filter((b) => b.deltaPlass !== 0)
            .sort((a, b) => Math.abs(b.deltaPlass) - Math.abs(a.deltaPlass))

        const klatrere = bevegelser.filter((b) => b.deltaPlass > 0).sort((a, b) => b.deltaPlass - a.deltaPlass)
        const fallere = bevegelser.filter((b) => b.deltaPlass < 0).sort((a, b) => a.deltaPlass - b.deltaPlass)
        const størsteKlatrer = klatrere[0]
            ? { navn: klatrere[0].navn, n: klatrere[0].deltaPlass, plass: klatrere[0].nyPlass }
            : null
        const størsteFaller = fallere[0]
            ? { navn: fallere[0].navn, n: Math.abs(fallere[0].deltaPlass), plass: fallere[0].nyPlass }
            : null

        // Endret topp 3?
        const nyTopp3Sett = tabell.slice(0, 3).map((r) => r.userid)
        const gammelTopp3Sett = forrige.rows
            .filter((r) => r.plass <= 3)
            .sort((a, b) => a.plass - b.plass)
            .map((r) => r.user_id)
        const nyTopp3 = JSON.stringify(nyTopp3Sett) !== JSON.stringify(gammelTopp3Sett)

        mal = malEndring({ antallKamper, størsteKlatrer, størsteFaller, nyTopp3 })
        Object.assign(data, { størsteKlatrer, størsteFaller, nyTopp3, delta: bevegelser.slice(0, 4) })
    }

    data.scenario = scenario

    await client.query(
        `INSERT INTO feed_posts (kind, scenario, dato, accent, tittel, body, data)
         VALUES ('morgenrapport', $1, $2, $3, $4, $5, $6)`,
        [scenario, iDag, mal.accent, mal.tittel, mal.body, JSON.stringify(data)],
    )

    await lagreSnapshot()

    return { postet: true, scenario, antallKamper }
}

// Antall sammenhengende (snapshot-)dager brukeren har ligget på topp, talt
// bakover fra og med `tomDato`.
async function tellDagerPåTopp(client: PoolClient, userId: string, tomDato: string): Promise<number> {
    const rader = await client.query<{ plass: number }>(
        `SELECT plass FROM feed_standings_snapshot
         WHERE user_id = $1 AND dato <= $2
         ORDER BY dato DESC`,
        [userId, tomDato],
    )
    let dager = 0
    for (const r of rader.rows) {
        if (r.plass === 1) dager++
        else break
    }
    return dager
}

async function hentNavn(client: PoolClient, userId: string): Promise<string> {
    const res = await client.query<{ name: string }>(
        `SELECT COALESCE(NULLIF(kallenavn, ''), name) AS name FROM users WHERE id = $1`,
        [userId],
    )
    return res.rows[0]?.name ?? 'ukjent'
}
