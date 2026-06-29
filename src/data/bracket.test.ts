import { ALLE_BRACKET_SLOTS, BRACKET_KOLONNER, BRONSE_SLOT, effektiveLag, taperTla, vinnerTla } from './bracket'
import { Match, MatchStatus } from '../types/types'

function lagKamp(over: Partial<Match> & { match_num: number }): Match {
    return {
        game_start: '2026-07-04T17:00:00.000Z',
        home_team: '',
        away_team: '',
        home_score: null,
        away_score: null,
        round: 5,
        status: 'TIMED' as MatchStatus,
        ...over,
    }
}

// De 32 utslagskampene (r4–r9) i VM 2026, hentet fra footballDataFixtures /
// matches-datasettet. Disse skal være nøyaktig de match_num-ene treet refererer.
const ALLE_KNOCKOUT = [
    // R32
    537415, 537416, 537417, 537418, 537419, 537420, 537421, 537422, 537423, 537424, 537425, 537426, 537427, 537428,
    537429, 537430,
    // R16
    537375, 537376, 537377, 537378, 537379, 537380, 537381, 537382,
    // KF
    537383, 537384, 537385, 537386,
    // SF
    537387, 537388,
    // Bronse + finale
    537389, 537390,
]

describe('bracket-tre', () => {
    it('har riktig antall kamper per runde (16/8/4/2/1 + bronse)', () => {
        const antall = BRACKET_KOLONNER.map((k) => k.slots.length)
        expect(antall).toEqual([16, 8, 4, 2, 1])
        expect(BRONSE_SLOT.matchNum).toBe(537389)
    })

    it('dekker nøyaktig de 32 utslagskampene, uten duplikater', () => {
        const fraTre = ALLE_BRACKET_SLOTS.map((s) => s.matchNum).sort((a, b) => a - b)
        expect(fraTre).toHaveLength(32)
        expect(new Set(fraTre).size).toBe(32)
        expect(fraTre).toEqual([...ALLE_KNOCKOUT].sort((a, b) => a - b))
    })

    it('lar hver feeder peke på en kamp i forrige runde', () => {
        const slotForNum = new Map(ALLE_BRACKET_SLOTS.map((s) => [s.matchNum, s]))
        for (const slot of ALLE_BRACKET_SLOTS) {
            if (!slot.feeders) {
                expect(slot.runde).toBe(4) // bare R32 mangler feedere
                continue
            }
            expect(slot.feeders).toHaveLength(2)
            for (const f of slot.feeders) {
                const feeder = slotForNum.get(f)
                expect(feeder).toBeDefined()
                // Bronse + finale mates begge av semifinalene (runde 7); ellers
                // skal feederen ligge nøyaktig én runde lavere.
                if (slot.runde === 8 || slot.runde === 9) {
                    expect(feeder!.runde).toBe(7)
                } else {
                    expect(feeder!.runde).toBe(slot.runde - 1)
                }
            }
        }
    })

    it('bygger bronsefinalen fra de to semifinale-taperne', () => {
        expect(BRONSE_SLOT.feedersErTapere).toBe(true)
        expect(BRONSE_SLOT.feeders).toEqual([537387, 537388])
    })

    it('har ingen kamp som feeder for to forskjellige slots', () => {
        const brukt = new Map<number, number>()
        for (const slot of ALLE_BRACKET_SLOTS) {
            if (slot.runde === 8) continue // bronse deler bevisst feedere med finalen
            for (const f of slot.feeders ?? []) {
                brukt.set(f, (brukt.get(f) ?? 0) + 1)
            }
        }
        for (const [, antall] of brukt) {
            expect(antall).toBe(1)
        }
    })
})

describe('vinner-/taper-avledning', () => {
    it('vinnerTla/taperTla gir laget med høyest/lavest score i ferdige kamper', () => {
        const m = lagKamp({
            match_num: 1,
            home_team: 'GER',
            away_team: 'BRA',
            home_score: 2,
            away_score: 1,
            status: 'FINISHED',
        })
        expect(vinnerTla(m)).toBe('GER')
        expect(taperTla(m)).toBe('BRA')

        const borteVinner = lagKamp({
            match_num: 2,
            home_team: 'GER',
            away_team: 'BRA',
            home_score: 0,
            away_score: 3,
            status: 'FINISHED',
        })
        expect(vinnerTla(borteVinner)).toBe('BRA')
        expect(taperTla(borteVinner)).toBe('GER')
    })

    it('returnerer null for uavgjort (straffer avgjør — ukjent fra offentlig score)', () => {
        const uavgjort = lagKamp({
            match_num: 3,
            home_team: 'GER',
            away_team: 'BRA',
            home_score: 1,
            away_score: 1,
            status: 'FINISHED',
        })
        expect(vinnerTla(uavgjort)).toBeNull()
        expect(taperTla(uavgjort)).toBeNull()
    })

    it('returnerer null når kampen ikke er ferdig', () => {
        const pagar = lagKamp({
            match_num: 4,
            home_team: 'GER',
            away_team: 'BRA',
            home_score: 1,
            away_score: 0,
            status: 'IN_PLAY',
        })
        expect(vinnerTla(pagar)).toBeNull()
    })

    it('effektiveLag fyller tomme noder med vinneren fra ferdige feeder-kamper', () => {
        // R16-kampen (537375) har ikke fått lag ennå, men begge R32-feederne er ferdige.
        const oppslag = new Map<number, Match>([
            [
                537415,
                lagKamp({
                    match_num: 537415,
                    home_team: 'GER',
                    away_team: 'PAR',
                    home_score: 2,
                    away_score: 0,
                    status: 'FINISHED',
                }),
            ],
            [
                537416,
                lagKamp({
                    match_num: 537416,
                    home_team: 'FRA',
                    away_team: 'SWE',
                    home_score: 1,
                    away_score: 3,
                    status: 'FINISHED',
                }),
            ],
            [537375, lagKamp({ match_num: 537375 })],
        ])
        const slot = BRACKET_KOLONNER[1].slots.find((s) => s.matchNum === 537375)!
        expect(effektiveLag(slot, oppslag)).toEqual({ home: 'GER', away: 'SWE' })
    })

    it('effektiveLag bruker kampens egne lag når de er satt (kilde/override)', () => {
        const oppslag = new Map<number, Match>([
            [
                537415,
                lagKamp({
                    match_num: 537415,
                    home_team: 'GER',
                    away_team: 'PAR',
                    home_score: 2,
                    away_score: 0,
                    status: 'FINISHED',
                }),
            ],
            [
                537416,
                lagKamp({
                    match_num: 537416,
                    home_team: 'FRA',
                    away_team: 'SWE',
                    home_score: 1,
                    away_score: 3,
                    status: 'FINISHED',
                }),
            ],
            [537375, lagKamp({ match_num: 537375, home_team: 'GER', away_team: 'SWE' })],
        ])
        const slot = BRACKET_KOLONNER[1].slots.find((s) => s.matchNum === 537375)!
        expect(effektiveLag(slot, oppslag)).toEqual({ home: 'GER', away: 'SWE' })
    })

    it('bronsefinalen fylles med taperne fra semifinalene', () => {
        const oppslag = new Map<number, Match>([
            [
                537387,
                lagKamp({
                    match_num: 537387,
                    round: 7,
                    home_team: 'GER',
                    away_team: 'BRA',
                    home_score: 2,
                    away_score: 1,
                    status: 'FINISHED',
                }),
            ],
            [
                537388,
                lagKamp({
                    match_num: 537388,
                    round: 7,
                    home_team: 'ARG',
                    away_team: 'ESP',
                    home_score: 0,
                    away_score: 1,
                    status: 'FINISHED',
                }),
            ],
            [537389, lagKamp({ match_num: 537389, round: 8 })],
        ])
        expect(effektiveLag(BRONSE_SLOT, oppslag)).toEqual({ home: 'BRA', away: 'ARG' })
    })

    it('lar noden være TBA når feeder-kampen ikke er avgjort', () => {
        const oppslag = new Map<number, Match>([
            [
                537415,
                lagKamp({
                    match_num: 537415,
                    home_team: 'GER',
                    away_team: 'PAR',
                    home_score: 1,
                    away_score: 1,
                    status: 'FINISHED',
                }),
            ],
            [537416, lagKamp({ match_num: 537416, status: 'TIMED' })],
            [537375, lagKamp({ match_num: 537375 })],
        ])
        const slot = BRACKET_KOLONNER[1].slots.find((s) => s.matchNum === 537375)!
        expect(effektiveLag(slot, oppslag)).toEqual({ home: '', away: '' })
    })
})
