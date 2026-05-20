import { expect } from '@jest/globals'
import { calculateAllBetsExtended } from './calculateAllBetsExtended'
import { AllBets, MatchBet, OtherUser } from '../../queries/useAllBets'

function bet(opts: { user: string; home: string; away: string; joker?: boolean }): MatchBet {
    return {
        user_id: opts.user,
        match_num: 1,
        round: 1,
        game_start: '2026-06-01T00:00:00Z',
        home_team: 'Norge',
        away_team: 'Brasil',
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
