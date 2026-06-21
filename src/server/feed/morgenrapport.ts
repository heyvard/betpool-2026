import { PoolClient } from 'pg'

import { LeaderBoard } from '../../components/results/calculateAllScores'
import { hentHovedligaData, sorterTabell } from './hovedligaData'
import { malEndring, malLederbytte, malLederHolder, MalResultat, MorgenScenario } from './maler'
import { osloDato, osloInstant } from './tid'

// Hvor langt bakover morgenrapporten ser etter ferdige kamper, fram til 08:00
// norsk tid på rapportdagen. 24 t dekker hele forrige døgns kampslate.
export const RAPPORT_VINDU_TIMER = 24

export interface MorgenrapportResultat {
    postet: boolean
    grunn?: 'allerede_postet' | 'stille_dag' | 'ingen_baseline'
    scenario?: MorgenScenario
    antallKamper?: number
}

export interface SnapshotRad {
    user_id: string
    plass: number
    poeng: number
}

export interface MorgenScenarioValg {
    scenario: MorgenScenario
    mal: MalResultat
    data: Record<string, unknown>
}

// Konkurranseplassering («delt plass»): like poeng gir samme plass, og neste
// distinkte poengsum hopper til index+1 — samme «1224»-logikk som ledertavla
// (finnFaktiskPlass i leaderboard.tsx). Uten dette ville morgenrapporten vist
// rå radnummer (13, 14, 15 …) der ledertavla viser delte plasser (13, 13, 13,
// 16 …), så plasseringer og endringer ikke stemte overens. `tabell` må være
// ferdigsortert (synkende poeng).
export function beregnPlasseringer(tabell: { userid: string; poeng: number }[]): Map<string, number> {
    const map = new Map<string, number>()
    for (let i = 0; i < tabell.length; i++) {
        const r = tabell[i]
        const delerMedForrige = i > 0 && tabell[i - 1].poeng === r.poeng
        map.set(r.userid, delerMedForrige ? map.get(tabell[i - 1].userid)! : i + 1)
    }
    return map
}

// Velger morgenrapport-scenario ut fra dagens tabell og forrige snapshot. Ren
// funksjon (ingen DB) så den kan gjenbrukes av både live-cronen og backfillen.
// `dager` = antall sammenhengende dager forrige leder lå øverst (precomputed).
export function velgMorgenScenario(args: {
    tabell: LeaderBoard[]
    navnMap: Map<string, string>
    forrigeRader: SnapshotRad[]
    antallKamper: number
    dager: number
    frø: string
}): MorgenScenarioValg | null {
    const { tabell, navnMap, forrigeRader, antallKamper, dager, frø } = args
    if (tabell.length === 0) return null

    const nyPlassMap = beregnPlasseringer(tabell)
    const forrigePlassMap = new Map(forrigeRader.map((r) => [r.user_id, r.plass]))
    const forrigeLederId = forrigeRader.find((r) => r.plass === 1)?.user_id ?? null
    const nyLederId = tabell[0].userid
    const topp3 = tabell.slice(0, 3).map((r) => ({
        plass: nyPlassMap.get(r.userid)!,
        navn: r.userName,
        poeng: r.poeng,
        leder: nyPlassMap.get(r.userid) === 1,
    }))
    const luke = tabell.length > 1 ? Math.max(0, tabell[0].poeng - tabell[1].poeng) : tabell[0].poeng

    const data: Record<string, unknown> = { antallKamper }

    // lederbytte (prioritert) — men bare hvis den nye lederen faktisk har poeng,
    // så vi ikke lager støy mens alle står på 0 (vilkårlig rekkefølge).
    if (forrigeLederId && forrigeLederId !== nyLederId && tabell[0].poeng > 0) {
        const nyLeder = tabell[0].userName
        const gammelLeder = navnMap.get(forrigeLederId) ?? 'ukjent'
        const mal = malLederbytte({ nyLeder, gammelLeder, luke: String(luke), dager, frø })
        Object.assign(data, { nyLeder, gammelLeder, luke, dager, topp3 })
        return { scenario: 'lederbytte', mal, data }
    }

    // leder_holder — samme leder som før, men har holdt stand gjennom enda en
    // kampdag (minst to dager på rad). En egen, triumferende vinkling.
    if (forrigeLederId && forrigeLederId === nyLederId && tabell[0].poeng > 0 && dager >= 2) {
        const leder = tabell[0].userName
        const mal = malLederHolder({ leder, luke: String(luke), dager, frø })
        Object.assign(data, { leder, luke, dager, topp3 })
        return { scenario: 'leder_holder', mal, data }
    }

    // endring
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

    // Topp 3 = alle med (delt) plass ≤ 3, så det matcher medaljene på ledertavla.
    // «Nye i topp 3» er de som ligger der nå, men ikke gjorde det forrige dag.
    const gammelTopp3Ids = new Set(forrigeRader.filter((r) => r.plass <= 3).map((r) => r.user_id))
    const nyeITopp3 = tabell
        .filter((r) => nyPlassMap.get(r.userid)! <= 3 && !gammelTopp3Ids.has(r.userid))
        .map((r) => ({ navn: r.userName, plass: nyPlassMap.get(r.userid)! }))
        .sort((a, b) => a.plass - b.plass)
    const nyTopp3 = nyeITopp3.length > 0

    const mal = malEndring({ antallKamper, størsteKlatrer, størsteFaller, nyTopp3, nyeITopp3, frø })
    Object.assign(data, { størsteKlatrer, størsteFaller, nyTopp3, nyeITopp3, delta: bevegelser.slice(0, 4) })
    return { scenario: 'endring', mal, data }
}

// Antall hovedliga-kamper som ble ferdige i tidsvinduet (fra, til]. Morgenrapporten
// bruker et rullerende vindu (RAPPORT_VINDU_TIMER) som ender 08:00 norsk tid på
// rapportdagen, IKKE en kalenderdato. Det grupperer hele kveldens/nattens kampslate
// riktig — kamper som sparkes i gang sent og avgjøres etter midnatt (typisk
// US-kampene) havner i samme rapport som de tidligere kampene samme «kveld».
export async function tellFerdigeKamper(client: PoolClient, fra: Date, til: Date): Promise<number> {
    const res = await client.query<{ antall: string }>(
        `SELECT count(*) AS antall
         FROM matches m
         JOIN match_scores ms ON ms.match_num = m.match_num
         WHERE m.status IN ('FINISHED', 'AWARDED')
           AND ms.synced_home_ft IS NOT NULL
           AND ms.synced_away_ft IS NOT NULL
           AND COALESCE(ms.score_synced_at, m.game_start) > $1
           AND COALESCE(ms.score_synced_at, m.game_start) <= $2`,
        [fra.toISOString(), til.toISOString()],
    )
    return parseInt(res.rows[0]?.antall ?? '0', 10)
}

// Lagrer (upsert) en tabell-snapshot for en gitt Oslo-dato. Lagrer
// konkurranseplassering («delt plass»), ikke rå radnummer, så endringene
// morgenrapporten regner ut dagen etter stemmer med ledertavla.
export async function lagreSnapshot(client: PoolClient, dato: string, tabell: LeaderBoard[]): Promise<void> {
    const plasser = beregnPlasseringer(tabell)
    for (const r of tabell) {
        await client.query(
            `INSERT INTO feed_standings_snapshot (dato, user_id, plass, poeng)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (dato, user_id) DO UPDATE SET plass = EXCLUDED.plass, poeng = EXCLUDED.poeng`,
            [dato, r.userid, plasser.get(r.userid)!, r.poeng],
        )
    }
}

// Antall sammenhengende (snapshot-)dager brukeren har ligget på topp, talt
// bakover fra og med `tomDato`.
export async function tellDagerPåTopp(client: PoolClient, userId: string, tomDato: string): Promise<number> {
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

// Inserter en morgenrapport. `createdAt` settes for backfill (08:00 Oslo den
// aktuelle dagen); utelatt for live (default now()). Returnerer true ved innsetting.
export async function insertMorgenrapport(
    client: PoolClient,
    args: { dato: string; valg: MorgenScenarioValg; createdAt?: Date },
): Promise<boolean> {
    const { dato, valg, createdAt } = args
    const res = await client.query(
        `INSERT INTO feed_posts (kind, scenario, dato, accent, tittel, body, data, created_at)
         VALUES ('morgenrapport', $1, $2, $3, $4, $5, $6, COALESCE($7, now()))
         ON CONFLICT (dato) WHERE dato IS NOT NULL DO NOTHING`,
        [
            valg.scenario,
            dato,
            valg.mal.accent,
            valg.mal.tittel,
            valg.mal.body,
            JSON.stringify(valg.data),
            createdAt ? createdAt.toISOString() : null,
        ],
    )
    return !!(res.rowCount && res.rowCount > 0)
}

// Morgenrapport for hovedligaen (Æresligaen). Oppsummerer endringer i tabellen
// siden forrige (aktive) dag. Poster ingenting på stille dager (ingen kamper ble
// ferdige i går). Forutsetter at klokka allerede er sjekket til 08 i Oslo av
// cron-handleren — UNIQUE på dato hindrer dobbel-post uansett.
export async function genererMorgenrapport(client: PoolClient, now: Date = new Date()): Promise<MorgenrapportResultat> {
    const iDag = osloDato(now)

    // Idempotent: allerede postet i dag?
    const finnes = await client.query(`SELECT 1 FROM feed_posts WHERE kind = 'morgenrapport' AND dato = $1`, [iDag])
    if (finnes.rowCount && finnes.rowCount > 0) return { postet: false, grunn: 'allerede_postet' }

    // Stille dag → ingen post. Vindu: siste RAPPORT_VINDU_TIMER t fram til 08:00 i dag.
    const til = osloInstant(iDag, 8)
    const fra = new Date(til.getTime() - RAPPORT_VINDU_TIMER * 60 * 60 * 1000)
    const antallKamper = await tellFerdigeKamper(client, fra, til)
    if (antallKamper === 0) return { postet: false, grunn: 'stille_dag' }

    // Dagens stilling.
    const { leaderboard, allBets } = await hentHovedligaData(client, now)
    const tabell = sorterTabell(leaderboard)
    if (tabell.length === 0) return { postet: false, grunn: 'stille_dag' }
    const navnMap = new Map(allBets.users.map((u) => [u.id, u.name]))

    // Forrige snapshot (siste dato før i dag).
    const forrigeDatoRes = await client.query<{ dato: string }>(
        `SELECT max(dato)::text AS dato FROM feed_standings_snapshot WHERE dato < $1`,
        [iDag],
    )
    const forrigeDato = forrigeDatoRes.rows[0]?.dato ?? null

    // Ingen baseline (første aktive dag) → kan ikke regne endring. Lagre snapshot,
    // men ikke post.
    if (!forrigeDato) {
        await lagreSnapshot(client, iDag, tabell)
        return { postet: false, grunn: 'ingen_baseline' }
    }

    const forrige = await client.query<SnapshotRad>(
        `SELECT user_id, plass, poeng FROM feed_standings_snapshot WHERE dato = $1`,
        [forrigeDato],
    )
    const forrigeLederId = forrige.rows.find((r) => r.plass === 1)?.user_id ?? null
    // Sørg for at forrige leder har et navn tilgjengelig (kan ha forlatt hovedliga).
    if (forrigeLederId && !navnMap.has(forrigeLederId)) {
        navnMap.set(forrigeLederId, await hentNavn(client, forrigeLederId))
    }
    const dager = forrigeLederId ? await tellDagerPåTopp(client, forrigeLederId, forrigeDato) : 0

    const valg = velgMorgenScenario({ tabell, navnMap, forrigeRader: forrige.rows, antallKamper, dager, frø: iDag })
    if (!valg) {
        await lagreSnapshot(client, iDag, tabell)
        return { postet: false, grunn: 'stille_dag' }
    }

    await insertMorgenrapport(client, { dato: iDag, valg })
    await lagreSnapshot(client, iDag, tabell)

    return { postet: true, scenario: valg.scenario, antallKamper }
}

export async function hentNavn(client: PoolClient, userId: string): Promise<string> {
    const res = await client.query<{ name: string }>(
        `SELECT COALESCE(NULLIF(kallenavn, ''), name) AS name FROM users WHERE id = $1`,
        [userId],
    )
    return res.rows[0]?.name ?? 'ukjent'
}
