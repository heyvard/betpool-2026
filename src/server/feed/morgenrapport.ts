import { PoolClient } from 'pg'

import { AllBetsExtended } from '../../components/results/calculateAllBetsExtended'
import { LeaderBoard } from '../../components/results/calculateAllScores'
import { hentHovedligaData, sorterTabell } from './hovedligaData'
import {
    BunnArgs,
    bunnSetning,
    fangstSetning,
    jokerSetning,
    JokerStatistikk,
    malDeltLedelse,
    malEndring,
    malLederbytte,
    malLederHolder,
    MalResultat,
    MorgenScenario,
    NattensFangst,
} from './maler'
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

// Bunnstriden for morgenrapporten: hvem ligger sist, om jumboplassen byttet eier
// siden forrige snapshot, og hvor tett det er nederst. Returnerer null når bunn-
// vinkelen ikke gir mening: små puljer (< 4) eller helt tidlig (ingen har poeng,
// så rekkefølgen nederst er vilkårlig). `tabell` er ferdigsortert (synkende poeng).
export function beregnBunn(
    tabell: LeaderBoard[],
    nyPlassMap: Map<string, number>,
    forrigeRader: SnapshotRad[],
): BunnArgs | null {
    if (tabell.length < 4 || tabell[0].poeng === 0) return null

    const sisteRad = tabell[tabell.length - 1]
    // Forrige jumbo = den med høyest (dårligst) plass i forrige snapshot.
    const forrigeJumboId =
        forrigeRader.length > 0 ? forrigeRader.reduce((a, b) => (b.plass > a.plass ? b : a)).user_id : null
    const nyJumbo = forrigeJumboId != null && forrigeJumboId !== sisteRad.userid
    // Rømlingen: forrige jumbo som fortsatt er med, men har klatret bort fra bånn.
    const rømlingRad = nyJumbo ? tabell.find((r) => r.userid === forrigeJumboId) : undefined
    const luke = Math.max(0, tabell[tabell.length - 2].poeng - sisteRad.poeng)

    return {
        jumbo: { navn: sisteRad.userName, plass: nyPlassMap.get(sisteRad.userid)!, poeng: sisteRad.poeng },
        nyJumbo,
        rømling: rømlingRad ? rømlingRad.userName : null,
        luke,
    }
}

// Nattens poengkonge: hvem sanket flest poeng siden forrige snapshot. Sammenligner
// dagens poeng mot forrige snapshots poeng (begge ligger i feed_standings_snapshot)
// per bruker, og plukker ut toppsankeren + ev. andre med nøyaktig samme høst.
// Returnerer null når ingen sanket poeng (alle bommet) eller det ikke finnes noen
// baseline ennå. Dette er hovedvinkelen morgenrapporten skal lede med — ikke hvem
// som ligger sist. `tabell` er ferdigsortert (synkende poeng).
export function beregnNattensFangst(
    tabell: LeaderBoard[],
    nyPlassMap: Map<string, number>,
    forrigeRader: SnapshotRad[],
): NattensFangst | null {
    if (forrigeRader.length === 0) return null
    const forrigePoeng = new Map(forrigeRader.map((r) => [r.user_id, r.poeng]))
    const gevinster = tabell
        .filter((r) => forrigePoeng.has(r.userid))
        .map((r) => ({
            navn: r.userName,
            deltaPoeng: r.poeng - forrigePoeng.get(r.userid)!,
            poeng: r.poeng,
            plass: nyPlassMap.get(r.userid)!,
        }))
        .filter((g) => g.deltaPoeng > 0)
        .sort((a, b) => b.deltaPoeng - a.deltaPoeng)
    if (gevinster.length === 0) return null

    const topp = gevinster[0]
    const delere = gevinster.filter((g) => g !== topp && g.deltaPoeng === topp.deltaPoeng).map((g) => g.navn)
    return {
        topp: { navn: topp.navn, poeng: topp.poeng, deltaPoeng: topp.deltaPoeng, plass: topp.plass },
        delere,
    }
}

// Joker-oppsummering for nattens kamper: hvor mange jokere ble lagt på de ferdige
// kampene (`ferdigeKampnumre`), og hvor mange satt (ga poeng) vs. brant (0). Teller
// over HELE hovedligaen — ikke bare toppen — fordi vi vil fortelle hvor mange jokere
// som ble brent i natt. Norge-kamp-jokere er allerede nullet i `calculateAllBetsExtended`
// (joker er ikke tillatt der), så de teller verken som satt eller brent.
export function beregnJokerStatistikk(extended: AllBetsExtended, ferdigeKampnumre: Set<number>): JokerStatistikk {
    let satt = 0
    let brent = 0
    for (const b of extended.bets) {
        if (!b.joker || !ferdigeKampnumre.has(b.match_num)) continue
        if (b.poeng > 0) satt++
        else brent++
    }
    return { satt, brent, totalt: satt + brent }
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
    // Joker-oppsummering for nattens kamper. Default 0/0/0 (ingen jokere) når den
    // ikke er oppgitt, slik at eldre kall/tester ikke trenger å sette den.
    jokerStatistikk?: JokerStatistikk
    frø: string
}): MorgenScenarioValg | null {
    const { tabell, navnMap, forrigeRader, antallKamper, dager, frø } = args
    const jokerStatistikk = args.jokerStatistikk ?? { satt: 0, brent: 0, totalt: 0 }
    if (tabell.length === 0) return null

    const nyPlassMap = beregnPlasseringer(tabell)
    const forrigePlassMap = new Map(forrigeRader.map((r) => [r.user_id, r.plass]))

    // Nattens poengkonge, bunnstriden og joker-oppsummeringen henges på ALLE
    // scenarioer (ikke bare «endring»), slik at hver morgenrapport leder med hvem som
    // sanket mest poeng i natt og også sier noe om nattens jokere. `fangst`/`bunn` er
    // null i små puljer / før noen har poeng (se beregnNattensFangst/beregnBunn).
    const fangst = beregnNattensFangst(tabell, nyPlassMap, forrigeRader)
    const fangstLinje = fangst ? fangstSetning(fangst, frø) : null
    const bunn = beregnBunn(tabell, nyPlassMap, forrigeRader)
    const jokerLinje = jokerSetning(jokerStatistikk, frø)

    // Pakker et scenariovalg: fletter fangst-, bunn- og joker-linja inn i body-en og
    // legger fangst + jokerStatistikk + bunn på data, så fronten kan rendre dem som
    // egne striper. «endring» fletter fangsten selv inn i sin body, så der hopper vi
    // over fangst-linja her for å unngå dobbelt-omtale. Bunnstriden nevnes kun ved
    // reell dramatikk (ny jumbo) — vi gidder ikke kjefte på samme stakkar hver morgen.
    function ferdig(scenario: MorgenScenario, mal: MalResultat, data: Record<string, unknown>): MorgenScenarioValg {
        const ekstra: string[] = []
        if (scenario !== 'endring' && fangstLinje) ekstra.push(fangstLinje)
        if (scenario !== 'endring' && bunn?.nyJumbo) ekstra.push(bunnSetning(bunn, frø))
        if (jokerLinje) ekstra.push(jokerLinje)
        const body = ekstra.length > 0 ? `${mal.body} ${ekstra.join(' ')}` : mal.body
        return { scenario, mal: { ...mal, body }, data: { jokerStatistikk, bunn, fangst, ...data } }
    }

    // Lederstriden regnes på konkurranseplassering («delt plass»), ikke på rå
    // sorteringsrekkefølge: ved poenglikhet på topp deler flere 1.-plass, og da er
    // det «delt ledelse» — ingen har gått forbi noen, selv om userid-tiebreaket i
    // sorterTabell tilfeldigvis legger en annen øverst enn i går.
    const nyLedereIds = tabell.filter((r) => nyPlassMap.get(r.userid) === 1).map((r) => r.userid)
    const nyLederId = nyLedereIds[0] // === tabell[0].userid; ved ikke-delt topp den faktiske lederen
    const deltToppen = nyLedereIds.length >= 2
    const forrigeLederIds = forrigeRader.filter((r) => r.plass === 1).map((r) => r.user_id)
    const forrigeLederId = forrigeLederIds[0] ?? null
    const forrigeLederFortsattLeder = forrigeLederId != null && nyPlassMap.get(forrigeLederId) === 1

    const topp3 = tabell.slice(0, 3).map((r) => ({
        plass: nyPlassMap.get(r.userid)!,
        navn: r.userName,
        poeng: r.poeng,
        leder: nyPlassMap.get(r.userid) === 1,
    }))
    const luke = tabell.length > 1 ? Math.max(0, tabell[0].poeng - tabell[1].poeng) : tabell[0].poeng

    const data: Record<string, unknown> = { antallKamper }

    // delt ledelse (prioritert) — det står likt på topp, og topp-settet har endret
    // seg siden i går (noen klatret opp i delt ledelse, eller en sole-leder fikk
    // selskap). Vi poster bare på endring i settet, så «dødt løp» ikke gjentas dag
    // etter dag når toppen står stille. Krever poeng > 0 (ellers vilkårlig rekkefølge).
    if (deltToppen && tabell[0].poeng > 0) {
        const forrigeSett = new Set(forrigeLederIds)
        const endretSett =
            forrigeLederIds.length !== nyLedereIds.length || nyLedereIds.some((id) => !forrigeSett.has(id))
        if (endretSett) {
            const ledere = nyLedereIds.map((id) => tabell.find((r) => r.userid === id)!.userName)
            // Nye utfordrere = dagens ledere som IKKE delte 1.-plass i går.
            const nyeUtfordrere = nyLedereIds
                .filter((id) => !forrigeSett.has(id))
                .map((id) => tabell.find((r) => r.userid === id)!.userName)
            // Gårsdagens leder, om fremdeles på topp — den som ble innhentet.
            const forrigeLeder = forrigeLederFortsattLeder
                ? tabell.find((r) => r.userid === forrigeLederId)!.userName
                : null
            const poeng = tabell[0].poeng
            const mal = malDeltLedelse({ ledere, poeng, nyeUtfordrere, forrigeLeder, dager, frø })
            Object.assign(data, { ledere, poeng, nyeUtfordrere, dager, topp3 })
            return ferdig('delt_ledelse', mal, data)
        }
    }

    // lederbytte — et REELT bytte: forrige leder er ikke lenger på 1.-plass, og det
    // står én alene på topp nå. (Delt ledelse fanges over; ren tiebreak-omsortering
    // ved poenglikhet teller ikke.) Bare hvis lederen faktisk har poeng, så vi ikke
    // lager støy mens alle står på 0 (vilkårlig rekkefølge).
    if (forrigeLederId && !deltToppen && !forrigeLederFortsattLeder && tabell[0].poeng > 0) {
        const nyLeder = tabell[0].userName
        const gammelLeder = navnMap.get(forrigeLederId) ?? 'ukjent'
        const mal = malLederbytte({ nyLeder, gammelLeder, luke: String(luke), dager, frø })
        Object.assign(data, { nyLeder, gammelLeder, luke, dager, topp3 })
        return ferdig('lederbytte', mal, data)
    }

    // leder_holder — samme leder alene på topp som før, men har holdt stand gjennom
    // enda en kampdag. En egen, triumferende vinkling.
    //
    // `dager` teller sammenhengende dager på topp t.o.m. forrigeDato (i går) — den
    // dag-EKSKLUSIVE streaken. I denne grenen står lederen bekreftet øverst også i dag
    // (forrigeLederId === nyLederId), så den faktiske reekken t.o.m. i dag er
    // `dager + 1`. Det er det dag-inklusive tallet teksten skal vise («har ledet N
    // dager på rad») — uten +1 underrapporterte vi alltid med én dag (tre dager på
    // topp ble skrevet som «2 dager»). Porten står på `dager >= 2` (≥ 3 dager på rad
    // inkl. i dag): er det færre står lederen ennå ikke trygt nok til denne vinklingen,
    // og dagen håndteres av «endring» under.
    // (lederbytte/delt_ledelse beholder det dag-eksklusive `dager`-tallet: der gjelder
    // det en avsluttet/forbigått ledelse, ikke en pågående.)
    if (forrigeLederId && forrigeLederId === nyLederId && !deltToppen && tabell[0].poeng > 0 && dager >= 2) {
        const leder = tabell[0].userName
        const dagerPåRad = dager + 1
        // Jageren = den som ligger rett bak (plass 2). Navngis i teksten så rapporten
        // også handler om dem rett bak teten, ikke bare om at lederen holder stand.
        const jager = tabell.length > 1 ? tabell[1].userName : null
        const mal = malLederHolder({ leder, luke: String(luke), dager: dagerPåRad, jager, frø })
        Object.assign(data, { leder, luke, dager: dagerPåRad, jager, topp3 })
        return ferdig('leder_holder', mal, data)
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

    // Nattens poengkonge (`fangst`) leder an i «endring»-body-en; bunnstriden (`bunn`)
    // nevnes kun ved ny jumbo. Begge er beregnet øverst og deles av alle scenarioer.
    const mal = malEndring({ antallKamper, størsteKlatrer, størsteFaller, nyTopp3, nyeITopp3, fangst, bunn, frø })
    Object.assign(data, { størsteKlatrer, størsteFaller, nyTopp3, nyeITopp3, delta: bevegelser.slice(0, 4) })
    return ferdig('endring', mal, data)
}

// Antall hovedliga-kamper som ble ferdige i tidsvinduet (fra, til]. Morgenrapporten
// bruker et rullerende vindu (RAPPORT_VINDU_TIMER) som ender 08:00 norsk tid på
// rapportdagen, IKKE en kalenderdato. Det grupperer hele kveldens/nattens kampslate
// riktig — kamper som sparkes i gang sent og avgjøres etter midnatt (typisk
// US-kampene) havner i samme rapport som de tidligere kampene samme «kveld».
//
// `tidsbasis` bestemmer hva som teller som «ferdig»-tidspunkt:
//  - 'synk' (live): score_synced_at om satt, ellers kampstart — synk-tidspunktet
//    er korrekt når rapporten kjører rett etter kampslaten.
//  - 'kampstart' (backfill): kampstart + 120 min. Brukes når score_synced_at ikke
//    er til å stole på (de fleste resultatene ble bulk-synket 13. juni), slik at
//    backfill-historikken legger kampene på riktig dag.
export async function hentFerdigeKampnumre(
    client: PoolClient,
    fra: Date,
    til: Date,
    tidsbasis: 'synk' | 'kampstart' = 'synk',
): Promise<number[]> {
    const ferdigTid =
        tidsbasis === 'kampstart'
            ? "(m.game_start + interval '120 minutes')"
            : 'COALESCE(ms.score_synced_at, m.game_start)'
    const res = await client.query<{ match_num: number }>(
        `SELECT m.match_num
         FROM matches m
         JOIN match_scores ms ON ms.match_num = m.match_num
         WHERE m.status IN ('FINISHED', 'AWARDED')
           AND ms.synced_home_ft IS NOT NULL
           AND ms.synced_away_ft IS NOT NULL
           AND ${ferdigTid} > $1
           AND ${ferdigTid} <= $2`,
        [fra.toISOString(), til.toISOString()],
    )
    return res.rows.map((r) => r.match_num)
}

// Antall ferdige kamper i vinduet — tynn wrapper over hentFerdigeKampnumre.
export async function tellFerdigeKamper(
    client: PoolClient,
    fra: Date,
    til: Date,
    tidsbasis: 'synk' | 'kampstart' = 'synk',
): Promise<number> {
    return (await hentFerdigeKampnumre(client, fra, til, tidsbasis)).length
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
    const ferdigeKampnumre = await hentFerdigeKampnumre(client, fra, til)
    const antallKamper = ferdigeKampnumre.length
    if (antallKamper === 0) return { postet: false, grunn: 'stille_dag' }

    // Dagens stilling.
    const { leaderboard, allBets, extended } = await hentHovedligaData(client, now)
    const tabell = sorterTabell(leaderboard)
    if (tabell.length === 0) return { postet: false, grunn: 'stille_dag' }
    const navnMap = new Map(allBets.users.map((u) => [u.id, u.name]))
    const jokerStatistikk = beregnJokerStatistikk(extended, new Set(ferdigeKampnumre))

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

    // Tekstvarianten skal være litt random fra dag til dag — ikke alltid samme
    // vinkling på samme slags rapport. Vi salter datofrøet med en tilfeldig verdi
    // her i live-genereringen (kjøres kun én gang per dag — UNIQUE på dato +
    // idempotens-sjekken over hindrer dobbel-post, så valgt variant fryses ved
    // innsetting). `velgMorgenScenario`/`velgVariant` er fortsatt rene og
    // deterministiske på `frø`-input, så tester og scenariovalg er upåvirket.
    const frø = `${iDag}-${Math.floor(Math.random() * 1_000_000)}`
    const valg = velgMorgenScenario({
        tabell,
        navnMap,
        forrigeRader: forrige.rows,
        antallKamper,
        dager,
        jokerStatistikk,
        frø,
    })
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
