import { expect } from '@jest/globals'
import { calculateAllBetsExtended, regnUtBonuspoeng } from './calculateAllBetsExtended'
import { AllBets, MatchBet, OtherUser } from '../../queries/useAllBets'

// Fasiten (turneringens toppscorer) er normalt tom. Lås den til spiller-id 42 her
// så vi kan teste den strukturerte toppscorer-bonusen og halveringen.
jest.mock('./topscorer', () => ({ topscorerPlayerIds: [42] }))

function bet(opts: {
    user: string
    home: string
    away: string
    joker?: boolean
    homeTeam?: string
    awayTeam?: string
}): MatchBet {
    return {
        user_id: opts.user,
        match_num: 1,
        round: 1,
        game_start: '2026-06-01T00:00:00Z',
        home_team: opts.homeTeam ?? 'Brasil',
        away_team: opts.awayTeam ?? 'Argentina',
        home_score: opts.home,
        away_score: opts.away,
        home_result: '2',
        away_result: '1',
        joker: opts.joker ?? false,
    }
}

function bruker(id: string): OtherUser {
    return { id, name: id, picture: null, paid: true }
}

describe('Joker dobler kamppoengene', () => {
    it('joker-tipset får dobbelt så mange poeng som et identisk tips uten joker', () => {
        const allBets: AllBets = {
            users: [bruker('A'), bruker('B'), bruker('C')],
            bets: [
                bet({ user: 'A', home: '2', away: '1' }),
                bet({ user: 'B', home: '2', away: '1', joker: true }),
                bet({ user: 'C', home: '0', away: '0' }),
            ],
        }

        const res = calculateAllBetsExtended(allBets)
        const poeng = (user: string) => res.bets.find((b) => b.user_id === user)!.poeng

        expect(poeng('A')).toEqual(2)
        expect(poeng('B')).toEqual(4)
        expect(poeng('C')).toEqual(0)
    })

    it('joker på et bom-tips gir fortsatt 0 poeng', () => {
        const allBets: AllBets = {
            users: [bruker('A'), bruker('B')],
            bets: [bet({ user: 'A', home: '2', away: '1' }), bet({ user: 'B', home: '0', away: '5', joker: true })],
        }

        const res = calculateAllBetsExtended(allBets)
        const betB = res.bets.find((b) => b.user_id === 'B')!

        expect(betB.poeng).toEqual(0)
        expect(betB.joker).toEqual(true)
    })
})

describe('regnUtBonuspoeng — trapp på winner-/topscorer-bonus', () => {
    it('gir 0 poeng når ingen traff', () => {
        expect(regnUtBonuspoeng(0, 35)).toEqual(0)
    })

    it('gir 25 poeng til den som er alene, uansett pool-størrelse', () => {
        expect(regnUtBonuspoeng(1, 35)).toEqual(25)
        expect(regnUtBonuspoeng(1, 3)).toEqual(25)
    })

    it('< 5 % traff gir 18 poeng', () => {
        // 2 av 41 = 4,9 %
        expect(regnUtBonuspoeng(2, 41)).toEqual(18)
    })

    it('< 10 % traff gir 12 poeng', () => {
        // 2 av 35 = 5,7 %, 3 av 35 = 8,6 %
        expect(regnUtBonuspoeng(2, 35)).toEqual(12)
        expect(regnUtBonuspoeng(3, 35)).toEqual(12)
    })

    it('< 20 % traff gir 8 poeng', () => {
        // 4 av 35 = 11 %, 6 av 35 = 17 %
        expect(regnUtBonuspoeng(4, 35)).toEqual(8)
        expect(regnUtBonuspoeng(6, 35)).toEqual(8)
    })

    it('< 35 % traff gir 5 poeng', () => {
        // 7 av 35 = akkurat 20 %, 12 av 35 = 34 %
        expect(regnUtBonuspoeng(7, 35)).toEqual(5)
        expect(regnUtBonuspoeng(12, 35)).toEqual(5)
    })

    it('>= 35 % traff gir 3 poeng', () => {
        // 13 av 35 = 37 %
        expect(regnUtBonuspoeng(13, 35)).toEqual(3)
    })

    it('tersklene er strikt mindre-enn på de eksakte grensene', () => {
        expect(regnUtBonuspoeng(5, 100)).toEqual(12) // 0,05 -> ikke < 0,05
        expect(regnUtBonuspoeng(10, 100)).toEqual(8) // 0,10 -> ikke < 0,10
        expect(regnUtBonuspoeng(20, 100)).toEqual(5) // 0,20 -> ikke < 0,20
        expect(regnUtBonuspoeng(35, 100)).toEqual(3) // 0,35 -> ikke < 0,35
    })
})

describe('Norge-kamper teller dobbelt', () => {
    it('alle får doblet kamppoengene i en kamp der Norge spiller', () => {
        const allBets: AllBets = {
            users: [bruker('A'), bruker('B'), bruker('C')],
            bets: [
                bet({ user: 'A', home: '2', away: '1', homeTeam: 'NOR' }),
                bet({ user: 'B', home: '2', away: '1', homeTeam: 'NOR' }),
                bet({ user: 'C', home: '0', away: '0', homeTeam: 'NOR' }),
            ],
        }

        const res = calculateAllBetsExtended(allBets)
        const poeng = (user: string) => res.bets.find((b) => b.user_id === user)!.poeng

        // Uten Norge-dobling hadde A og B fått 2 poeng hver.
        expect(poeng('A')).toEqual(4)
        expect(poeng('B')).toEqual(4)
        expect(poeng('C')).toEqual(0)
    })

    it('joker teller ikke på Norge-kamper — ingen stabling', () => {
        const allBets: AllBets = {
            users: [bruker('A'), bruker('B')],
            bets: [
                bet({ user: 'A', home: '2', away: '1', awayTeam: 'NOR' }),
                bet({ user: 'B', home: '2', away: '1', awayTeam: 'NOR', joker: true }),
            ],
        }

        const res = calculateAllBetsExtended(allBets)
        const betFor = (user: string) => res.bets.find((b) => b.user_id === user)!

        // Norge-dobling gir 4, jokeren ignoreres — begge får like mye.
        expect(betFor('A').poeng).toEqual(4)
        expect(betFor('B').poeng).toEqual(4)
        // Jokeren nulles ut i resultatet så merkelapper ikke villeder.
        expect(betFor('B').joker).toEqual(false)
    })
})

describe('Strukturert toppscorer-bonus (topscorer_player_id)', () => {
    function brukerMedTopscorer(id: string, playerId: number | null, endret = false): OtherUser {
        return { id, name: id, picture: null, paid: true, topscorer_player_id: playerId, topscorer_endret: endret }
    }

    it('gir bonus til brukeren som traff toppscorer-spilleren, 0 til de andre', () => {
        const allBets: AllBets = {
            users: [
                brukerMedTopscorer('A', 42), // riktig
                brukerMedTopscorer('B', 7), // feil spiller
                brukerMedTopscorer('C', null), // ikke koblet
            ],
            bets: [],
        }

        const res = calculateAllBetsExtended(allBets)
        const points = (id: string) => res.users.find((u) => u.id === id)!.topscorerPoints

        // 1 av 3 traff → alene → 25 poeng.
        expect(points('A')).toEqual(25)
        expect(points('B')).toEqual(0)
        expect(points('C')).toEqual(0)
    })

    it('halverer bonusen når tipset er endret i endrevinduet', () => {
        const allBets: AllBets = {
            users: [
                brukerMedTopscorer('A', 42, true), // riktig, men endret → halvert
                brukerMedTopscorer('B', 42), // riktig, ikke endret
                brukerMedTopscorer('C', 7),
            ],
            bets: [],
        }

        const res = calculateAllBetsExtended(allBets)
        const points = (id: string) => res.users.find((u) => u.id === id)!.topscorerPoints

        // 2 av 3 traff = 67 % → 3 poeng hver; A halveres til floor(3/2) = 1.
        expect(points('B')).toEqual(3)
        expect(points('A')).toEqual(1)
        expect(points('C')).toEqual(0)
    })
})

describe('riktigResultat er false for uspilte kamper', () => {
    it('et 0-0-tips på en kamp uten resultat skal ikke markeres som riktig', () => {
        const allBets: AllBets = {
            users: [bruker('A')],
            bets: [
                {
                    ...bet({ user: 'A', home: '0', away: '0' }),
                    home_result: null,
                    away_result: null,
                },
            ],
        }

        const res = calculateAllBetsExtended(allBets)
        const b = res.bets.find((b) => b.user_id === 'A')!

        expect(b.riktigResultat).toEqual(false)
        expect(b.riktigUtfall).toEqual(false)
        expect(b.poeng).toEqual(0)
    })
})
