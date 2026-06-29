import { Match } from '../types/types'

// Sluttspill-treet (bracket) for VM 2026.
//
// Datasettet (football-data.org) forteller hvilke lag som er i hver kamp, men
// *ikke* hvilken kamp som mater hvilken — og match_num-ene følger ikke FIFAs
// bracket-rekkefølge (R16-id-ene 537375–82 kommer numerisk før R32-id-ene
// 537415–30). Koblingen under er derfor utledet og verifisert: hver av de 32
// utslagskampene mapper unikt og bijektivt til FIFAs offisielle kampnummer
// 73–104 via nøyaktig avsparks-tidspunkt (UTC), og FIFA-treet (Wikipedia
// «2026 FIFA World Cup knockout stage») gir feeder-strukturen. Lag-plasseringene
// stemmer med den offisielle bracketen (VG/NRK/FIFA).
//
//   FIFA#  →  match_num     |  FIFA#  →  match_num  (feeders i FIFA-nr)
//   ----------------------- | ------------------------------------------
//   73 → 537417  (R32)      |  89 → 537375 = W74·W77
//   74 → 537415  (R32)      |  90 → 537376 = W73·W75
//   75 → 537418  (R32)      |  91 → 537377 = W76·W78
//   76 → 537423  (R32)      |  92 → 537378 = W79·W80
//   77 → 537416  (R32)      |  93 → 537379 = W83·W84
//   78 → 537424  (R32)      |  94 → 537380 = W81·W82
//   79 → 537425  (R32)      |  95 → 537381 = W86·W88
//   80 → 537426  (R32)      |  96 → 537382 = W85·W87
//   81 → 537421  (R32)      |  97 → 537383 = W89·W90  (KF)
//   82 → 537422  (R32)      |  98 → 537384 = W93·W94  (KF)
//   83 → 537419  (R32)      |  99 → 537385 = W91·W92  (KF)
//   84 → 537420  (R32)      | 100 → 537386 = W95·W96  (KF)
//   85 → 537429  (R32)      | 101 → 537387 = W97·W98  (SF)
//   86 → 537427  (R32)      | 102 → 537388 = W99·W100 (SF)
//   87 → 537430  (R32)      | 103 → 537389 = L101·L102 (bronse)
//   88 → 537428  (R32)      | 104 → 537390 = W101·W102 (finale)
//
// Rekkefølgen i hver kolonne under er topp→bunn slik bracketen tegnes: venstre
// halvdel (møtes i SF 537387) først, deretter høyre halvdel (SF 537388).

export interface BracketSlot {
    /** match_num (football-data.org) — også lenkemål /match/[match_num]. */
    matchNum: number
    /** Appens runde-tall: 4=R32, 5=R16, 6=KF, 7=SF, 8=bronse, 9=finale. */
    runde: number
    /**
     * De to kampene vinneren (eller taperen, for bronsefinalen) kommer fra.
     * `null` for R32 (lagene kommer fra gruppespillet).
     */
    feeders: [number, number] | null
    /** Bronsefinalen mates av *taperne* fra semifinalene. */
    feedersErTapere?: boolean
}

export interface BracketKolonne {
    runde: number
    slots: BracketSlot[]
}

// Kolonnene fra R32 (venstre) til finalen (høyre). Bronsefinalen henger på
// finale-kolonnen og håndteres separat i visningen.
export const BRACKET_KOLONNER: BracketKolonne[] = [
    {
        runde: 4,
        slots: [
            // Venstre halvdel
            { matchNum: 537415, runde: 4, feeders: null },
            { matchNum: 537416, runde: 4, feeders: null },
            { matchNum: 537417, runde: 4, feeders: null },
            { matchNum: 537418, runde: 4, feeders: null },
            { matchNum: 537419, runde: 4, feeders: null },
            { matchNum: 537420, runde: 4, feeders: null },
            { matchNum: 537421, runde: 4, feeders: null },
            { matchNum: 537422, runde: 4, feeders: null },
            // Høyre halvdel
            { matchNum: 537423, runde: 4, feeders: null },
            { matchNum: 537424, runde: 4, feeders: null },
            { matchNum: 537425, runde: 4, feeders: null },
            { matchNum: 537426, runde: 4, feeders: null },
            { matchNum: 537427, runde: 4, feeders: null },
            { matchNum: 537428, runde: 4, feeders: null },
            { matchNum: 537429, runde: 4, feeders: null },
            { matchNum: 537430, runde: 4, feeders: null },
        ],
    },
    {
        runde: 5,
        slots: [
            { matchNum: 537375, runde: 5, feeders: [537415, 537416] },
            { matchNum: 537376, runde: 5, feeders: [537417, 537418] },
            { matchNum: 537379, runde: 5, feeders: [537419, 537420] },
            { matchNum: 537380, runde: 5, feeders: [537421, 537422] },
            { matchNum: 537377, runde: 5, feeders: [537423, 537424] },
            { matchNum: 537378, runde: 5, feeders: [537425, 537426] },
            { matchNum: 537381, runde: 5, feeders: [537427, 537428] },
            { matchNum: 537382, runde: 5, feeders: [537429, 537430] },
        ],
    },
    {
        runde: 6,
        slots: [
            { matchNum: 537383, runde: 6, feeders: [537375, 537376] },
            { matchNum: 537384, runde: 6, feeders: [537379, 537380] },
            { matchNum: 537385, runde: 6, feeders: [537377, 537378] },
            { matchNum: 537386, runde: 6, feeders: [537381, 537382] },
        ],
    },
    {
        runde: 7,
        slots: [
            { matchNum: 537387, runde: 7, feeders: [537383, 537384] },
            { matchNum: 537388, runde: 7, feeders: [537385, 537386] },
        ],
    },
    {
        runde: 9,
        slots: [{ matchNum: 537390, runde: 9, feeders: [537387, 537388] }],
    },
]

// Bronsefinalen — taperne fra de to semifinalene. Vises ved finalen.
export const BRONSE_SLOT: BracketSlot = {
    matchNum: 537389,
    runde: 8,
    feeders: [537387, 537388],
    feedersErTapere: true,
}

/** Alle slots inkludert bronsefinalen — nyttig for tester/oppslag. */
export const ALLE_BRACKET_SLOTS: BracketSlot[] = [...BRACKET_KOLONNER.flatMap((k) => k.slots), BRONSE_SLOT]

/**
 * Bygger et oppslag fra match_num til den faktiske kampen (lag + score + status)
 * fra `UseMatches()`-dataene. Slots uten en matchende kamp (skulle ikke skje i
 * praksis) faller tilbake til TBA-placeholder i visningen.
 */
export function byggMatchOppslag(matches: Match[]): Map<number, Match> {
    return new Map(matches.map((m) => [m.match_num, m]))
}

function erFerdigKamp(m: Match | undefined): m is Match {
    return !!m && (m.status === 'FINISHED' || m.status === 'AWARDED')
}

/**
 * Vinnerens tre-bokstavskode i en ferdigspilt kamp, ut fra lagret resultat.
 * Returnerer null hvis kampen ikke er ferdig, mangler score, eller endte uavgjort
 * (etter 90' — straffer avgjør da, og det vet vi ikke fra den offentlige scoren).
 */
export function vinnerTla(m: Match | undefined): string | null {
    if (!erFerdigKamp(m) || m.home_score == null || m.away_score == null) return null
    if (m.home_score > m.away_score) return m.home_team || null
    if (m.away_score > m.home_score) return m.away_team || null
    return null
}

/** Taperens tre-bokstavskode i en ferdigspilt kamp (motsatt av {@link vinnerTla}). */
export function taperTla(m: Match | undefined): string | null {
    if (!erFerdigKamp(m) || m.home_score == null || m.away_score == null) return null
    if (m.home_score > m.away_score) return m.away_team || null
    if (m.away_score > m.home_score) return m.home_team || null
    return null
}

export interface EffektiveLag {
    home: string
    away: string
}

/**
 * De lagene som skal vises i en node. Bruker kampens egne lag når de er satt
 * (av football-data eller scoreadmin-override). Er de tomme, men feeder-kampen er
 * ferdigspilt med et avgjort resultat, fylles noden ut med vinneren (eller taperen,
 * for bronsefinalen) fra den lagrede match-dataen. Uavgjorte feeder-kamper (straffer)
 * forblir TBA til kilden fyller dem inn.
 */
export function effektiveLag(slot: BracketSlot, oppslag: Map<number, Match>): EffektiveLag {
    const m = oppslag.get(slot.matchNum)
    let home = m?.home_team ?? ''
    let away = m?.away_team ?? ''

    if (slot.feeders) {
        const utled = (feederNum: number): string | null => {
            const fm = oppslag.get(feederNum)
            return slot.feedersErTapere ? taperTla(fm) : vinnerTla(fm)
        }
        if (!home) home = utled(slot.feeders[0]) ?? ''
        if (!away) away = utled(slot.feeders[1]) ?? ''
    }

    return { home, away }
}
