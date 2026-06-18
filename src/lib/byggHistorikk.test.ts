import { byggHistorikk, velgTegnedeSerier, HistorikkSerie } from './byggHistorikk'
import { AllBets, MatchBet, OtherUser } from '../queries/useAllBets'
import { LeaderBoard } from '../components/results/calculateAllScores'
import { Match } from '../types/types'

// Minimale fixtures — vi tester orkestreringen i byggHistorikk (gruppering på
// kampdag, kumulativ beregning, plass-tildeling med delte plasser), ikke
// scoringen i seg selv (den mates inn som callback).

function bet(user: string, matchNum: number): MatchBet {
    return { user_id: user, match_num: matchNum } as unknown as MatchBet
}

function match(matchNum: number, dato: string): Match {
    return { match_num: matchNum, game_start: `${dato}T18:00:00.000Z`, status: 'FINISHED' } as unknown as Match
}

const deltakere = [
    { userid: 'A', navn: 'Ada' },
    { userid: 'B', navn: 'Bo' },
    { userid: 'C', navn: 'Cy' },
]

const users: OtherUser[] = deltakere.map((d) => ({ id: d.userid, name: d.navn, picture: null, paid: true }))

const hjelpere = {
    harResultat: (k: Match) => k.status === 'FINISHED',
    kickoff: (k: Match) => new Date(k.game_start).getTime(),
    poengAv: (r: LeaderBoard) => r.poeng - (r.livePoeng ?? 0),
    visningsnavn: (s: string) => s,
    farge: () => '#000',
}

// Poeng per (user, match). beregnTavle summerer over bets-ene som er med.
const poengTabell: Record<string, number> = {
    'A-1': 3,
    'B-1': 1,
    'C-1': 0,
    'A-2': 0,
    'B-2': 3,
    'C-2': 5,
}

function beregnTavle(bets: AllBets): LeaderBoard[] {
    const sum = new Map<string, number>()
    users.forEach((u) => sum.set(u.id, 0))
    bets.bets.forEach((b) => {
        const p = poengTabell[`${b.user_id}-${b.match_num}`] ?? 0
        sum.set(b.user_id, (sum.get(b.user_id) ?? 0) + p)
    })
    return users.map((u) => ({ userid: u.id, poeng: sum.get(u.id) ?? 0, userName: u.name, paid: true, picture: null }))
}

describe('byggHistorikk', () => {
    const alleBets: AllBets = {
        users,
        bets: [bet('A', 1), bet('B', 1), bet('C', 1), bet('A', 2), bet('B', 2), bet('C', 2)],
    }
    const kamper = [match(1, '2026-06-01'), match(2, '2026-06-02')]

    it('rekonstruerer kumulativ plassering per kampdag', () => {
        const h = byggHistorikk(alleBets, kamper, deltakere, beregnTavle, hjelpere)

        expect(h.kampdager).toHaveLength(2)
        expect(h.kampdager.map((d) => d.short)).toEqual(['1/6', '2/6'])
        expect(h.maxRank).toBe(3)

        const serie = (id: string) => h.serier.find((s) => s.userid === id)!
        // Dag 1 (kun m1): A=3, B=1, C=0
        expect(serie('A').pts[0]).toBe(3)
        expect(serie('A').ranks[0]).toBe(1)
        expect(serie('C').ranks[0]).toBe(3)
        // Dag 2 (m1+m2): A=3, B=4, C=5 → C1, B2, A3
        expect(serie('C').pts[1]).toBe(5)
        expect(serie('C').ranks[1]).toBe(1)
        expect(serie('B').ranks[1]).toBe(2)
        expect(serie('A').ranks[1]).toBe(3)
    })

    it('gir delt plass ved lik poengsum', () => {
        // Lik poengsum dag 1: alle 0 → alle på 1. plass.
        const flat: AllBets = { users, bets: [bet('A', 9), bet('B', 9), bet('C', 9)] }
        const k = [match(9, '2026-06-05')]
        const h = byggHistorikk(flat, k, deltakere, () => beregnTavle({ users, bets: [] }), hjelpere)
        expect(h.serier.map((s) => s.ranks[0])).toEqual([1, 1, 1])
    })

    it('returnerer tomt når ingen kamper er ferdigspilte', () => {
        const ingen = [{ ...match(1, '2026-06-01'), status: 'TIMED' } as unknown as Match]
        const h = byggHistorikk(alleBets, ingen, deltakere, beregnTavle, hjelpere)
        expect(h.kampdager).toHaveLength(0)
        expect(h.serier).toHaveLength(0)
    })

    it('siste kampdag får «I dag»-label', () => {
        const h = byggHistorikk(alleBets, kamper, deltakere, beregnTavle, hjelpere, {
            idag: 'I dag',
            kampdag: 'Kampdag {{n}}',
        })
        expect(h.kampdager[0].label).toBe('Kampdag 1')
        expect(h.kampdager[1].label).toBe('I dag')
    })
})

describe('velgTegnedeSerier', () => {
    const lagSerie = (id: string, sisteRank: number): HistorikkSerie => ({
        userid: id,
        navn: id,
        farge: '#000',
        ranks: [sisteRank],
        pts: [0],
    })
    const serier = Array.from({ length: 12 }, (_, i) => lagSerie(`U${i}`, i + 1))

    it('tegner topp 8 etter siste kampdag', () => {
        const tegnede = velgTegnedeSerier(serier, null, null)
        expect(tegnede).toHaveLength(8)
        expect(tegnede.map((s) => s.userid)).toEqual(['U0', 'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7'])
    })

    it('tar alltid med markert og meg selv om de er utenfor topp 8', () => {
        const tegnede = velgTegnedeSerier(serier, 'U11', 'U10')
        const ids = tegnede.map((s) => s.userid)
        expect(ids).toContain('U11')
        expect(ids).toContain('U10')
        expect(tegnede).toHaveLength(10)
    })
})
