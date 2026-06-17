// Rekonstruerer tabellhistorikk på klienten ut fra data vi allerede har.
//
// Vi har ingen lagrede dag-for-dag-snapshots, men kan utlede dem: kjør NØYAKTIG
// samme poengberegning som ledertavla (`calculateAllBetsExtended` →
// `calculateLeaderboard`) gjentatte ganger — én gang per kampdag, hver gang kun
// på kampene som var ferdigspilt t.o.m. den datoen. Det gir kumulativ poengsum
// per dag → plassering per dag → én linje per deltaker.
//
// Ingen ny scoring skrives her: tavla beregnes av `beregnTavle`-callbacken som
// kalleren mater inn (ledertavlas eksisterende kjede). Historikken viser kun
// ferdigspilte kamper — live/foreløpige poeng holdes utenfor.

import { AllBets } from '../queries/useAllBets'
import { LeaderBoard } from '../components/results/calculateAllScores'
import { Match } from '../types/types'

export interface Kampdag {
    dateKey: string
    label: string
    short: string
}

export interface HistorikkSerie {
    userid: string
    navn: string // visningsnavn()
    farge: string // samme avatar-farge som ellers (derivert fra userid)
    ranks: number[] // plassering per kampdag, samme lengde som kampdager[]
    pts: number[] // kumulativ poengsum per kampdag
}

export interface Historikk {
    kampdager: Kampdag[]
    serier: HistorikkSerie[]
    maxRank: number
}

export interface HistorikkDeltaker {
    userid: string
    navn: string
}

export interface ByggHistorikkHjelpere {
    /** «Kampen er ferdigspilt» — samme sjekk som ellers i appen (erKampFerdig). */
    harResultat: (k: Match) => boolean
    /** ms-timestamp for avspark. */
    kickoff: (k: Match) => number
    /** Effektiv poeng UTEN live (r.poeng - (r.livePoeng ?? 0)). */
    poengAv: (r: LeaderBoard) => number
    visningsnavn: (s: string) => string
    /** Linjefarge derivert fra userid. */
    farge: (userid: string) => string
}

export interface ByggHistorikkTekster {
    /** Label for siste kampdag. */
    idag: string
    /** Label-mal for øvrige kampdager, med «{{n}}»-plassholder. */
    kampdag: string
}

const STANDARD_TEKSTER: ByggHistorikkTekster = {
    idag: 'I dag',
    kampdag: 'Kampdag {{n}}',
}

// Distinkte, on-brand-aktige linjefarger. Bump-chartet trenger godt adskilte
// farger per deltaker; vi deriverer deterministisk fra userid (samme
// hash-stil som ledertavlas `ordningsverdi`), slik at samme person alltid
// får samme farge.
const LINJE_FARGER = [
    '#f59e0b', // gull-500
    '#15803d', // grønn-700
    '#2563eb', // blå
    '#dc2626', // rød-600
    '#7c3aed', // violet
    '#0891b2', // cyan
    '#db2777', // rose
    '#b45309', // gull-700
    '#4f46e5', // indigo
    '#0d9488', // teal
]

export function avatarFarge(userid: string): string {
    let h = 0
    for (let i = 0; i < userid.length; i++) {
        h = (Math.imul(31, h) + userid.charCodeAt(i)) | 0
    }
    return LINJE_FARGER[Math.abs(h) % LINJE_FARGER.length]
}

export function byggHistorikk(
    populasjonsBets: AllBets, // ALLEREDE filtrert for valgt liga (filtrerAllBets)
    kamper: Match[], // alle kamper i turneringen
    deltakere: HistorikkDeltaker[], // medlemmene i valgt liga
    beregnTavle: (bets: AllBets) => LeaderBoard[], // ledertavlas kjede — IKKE ny scoring
    hjelpere: ByggHistorikkHjelpere,
    tekster: ByggHistorikkTekster = STANDARD_TEKSTER,
): Historikk {
    const { harResultat, kickoff, poengAv, visningsnavn, farge } = hjelpere

    // 1) Ferdigspilte kamper, sortert kronologisk.
    const ferdige = kamper.filter(harResultat).sort((a, b) => kickoff(a) - kickoff(b))
    if (ferdige.length === 0) {
        return { kampdager: [], serier: [], maxRank: 0 }
    }

    // 2) Grupper på kalenderdato (kampdag). Lokal dato fra kickoff.
    const bøtter = new Map<string, Match[]>()
    for (const k of ferdige) {
        const d = new Date(kickoff(k))
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
            2,
            '0',
        )}`
        const liste = bøtter.get(key) ?? bøtter.set(key, []).get(key)!
        liste.push(k)
    }
    const dagKeys = [...bøtter.keys()].sort()

    // 3) For hver kampdag: kjør SAMME tavle-beregning på alle kamper t.o.m. den
    //    datoen, ved å snevre bets-ene inn til de ferdigspilte kampene så langt.
    const kampdager: Kampdag[] = []
    const ptsPerUser = new Map<string, number[]>()
    const rankPerUser = new Map<string, number[]>()
    const ferdigeMatchNum = new Set<number>()

    dagKeys.forEach((key, idx) => {
        bøtter.get(key)!.forEach((k) => ferdigeMatchNum.add(k.match_num))

        const betsTilDato: AllBets = {
            users: populasjonsBets.users,
            bets: populasjonsBets.bets.filter((b) => ferdigeMatchNum.has(b.match_num)),
        }
        const tavle = beregnTavle(betsTilDato)

        // Sorter deterministisk (poeng desc, userid som tiebreak) og tildel
        // plass med delte plasser ved lik poengsum — speiler ledertavlas
        // `finnFaktiskPlass`-oppførsel.
        const sortert = [...tavle].sort((a, b) => {
            const diff = poengAv(b) - poengAv(a)
            return diff !== 0 ? diff : a.userid.localeCompare(b.userid)
        })
        let forrigePts: number | null = null
        let forrigePlass = 0
        sortert.forEach((r, i) => {
            const p = poengAv(r)
            const plass = p === forrigePts ? forrigePlass : i + 1
            forrigePlass = plass
            forrigePts = p
            const ranks = rankPerUser.get(r.userid) ?? rankPerUser.set(r.userid, []).get(r.userid)!
            ranks[idx] = plass
            const pts = ptsPerUser.get(r.userid) ?? ptsPerUser.set(r.userid, []).get(r.userid)!
            pts[idx] = p
        })

        const d = new Date(key + 'T00:00:00')
        const erSiste = idx === dagKeys.length - 1
        kampdager.push({
            dateKey: key,
            label: erSiste ? tekster.idag : tekster.kampdag.replace('{{n}}', String(idx + 1)),
            short: `${d.getDate()}/${d.getMonth() + 1}`,
        })
    })

    // 4) Bygg serier (én per deltaker). Fyll hull (deltaker uten poeng en dag)
    //    med nederste plass / 0 poeng.
    const serier: HistorikkSerie[] = deltakere.map((deltaker) => {
        const ranks = kampdager.map((_, i) => rankPerUser.get(deltaker.userid)?.[i] ?? deltakere.length)
        const pts = kampdager.map((_, i) => ptsPerUser.get(deltaker.userid)?.[i] ?? 0)
        return {
            userid: deltaker.userid,
            navn: visningsnavn(deltaker.navn),
            farge: farge(deltaker.userid),
            ranks,
            pts,
        }
    })

    const alleRanks = serier.flatMap((s) => s.ranks)
    const maxRank = alleRanks.length ? Math.max(...alleRanks) : 0

    return { kampdager, serier, maxRank }
}

/**
 * Med store ligaer blir alle linjer rotete. Velg de seriene som skal TEGNES:
 * topp `maks` etter siste kampdag, men ta alltid med markert deltaker og
 * innlogget bruker selv om de er utenfor topp `maks`. Resten er fortsatt
 * valgbare i velgeren — velges en av dem legges hens linje til.
 */
export function velgTegnedeSerier(
    serier: HistorikkSerie[],
    selectedId: string | null,
    meId: string | null,
    maks = 8,
): HistorikkSerie[] {
    if (serier.length === 0) return []
    const n = serier[0].ranks.length
    const sisteRank = (s: HistorikkSerie) => s.ranks[n - 1] ?? Number.POSITIVE_INFINITY
    const valgt = new Set(
        [...serier]
            .sort((a, b) => sisteRank(a) - sisteRank(b))
            .slice(0, maks)
            .map((s) => s.userid),
    )
    for (const id of [selectedId, meId]) {
        if (id) valgt.add(id)
    }
    return serier.filter((s) => valgt.has(s.userid))
}
