import { expect } from '@jest/globals'
import { calculateAllBetsExtended } from './calculateAllBetsExtended'
import { AllBets, OtherUser } from '../../queries/useAllBets'

// Lås vinner-fasiten så vi kan teste bonusutdelingen når VM er avgjort.
jest.mock('./winner', () => ({ winner: 'BRA' }))

function bruker(id: string, winner?: string, endret = false): OtherUser {
    return { id, name: id, picture: null, paid: true, winner, winner_endret: endret }
}

describe('Vinner-bonus når fasiten er satt', () => {
    it('gir bonus til de som traff, 0 til feil tips og tomme tips', () => {
        const allBets: AllBets = {
            users: [
                bruker('A', 'BRA'), // riktig
                bruker('B', 'BRA'), // riktig
                bruker('C', 'FRA'), // feil
                bruker('D', ''), // aldri valgt
                bruker('E'), // winner undefined
            ],
            bets: [],
        }

        const res = calculateAllBetsExtended(allBets)
        const points = (id: string) => res.users.find((u) => u.id === id)!.winnerPoints

        // 2 av 5 traff = 40 % → 3 poeng hver.
        expect(points('A')).toEqual(3)
        expect(points('B')).toEqual(3)
        expect(points('C')).toEqual(0)
        expect(points('D')).toEqual(0)
        expect(points('E')).toEqual(0)
    })

    it('halverer bonusen når vinnertipset er endret i endrevinduet', () => {
        const allBets: AllBets = {
            users: [bruker('A', 'BRA', true), bruker('B', 'BRA'), bruker('C', 'FRA')],
            bets: [],
        }

        const res = calculateAllBetsExtended(allBets)
        const points = (id: string) => res.users.find((u) => u.id === id)!.winnerPoints

        // 2 av 3 traff = 67 % → 3 poeng; A er endret → floor(3/2) = 1.
        expect(points('B')).toEqual(3)
        expect(points('A')).toEqual(1)
        expect(points('C')).toEqual(0)
    })

    it('tomme tips teller ikke med i andelen som traff', () => {
        // 1 av 41 brukere traff. Hadde de 40 tomme tipsene talt som treff,
        // ville andelen vært høy og bonusen lav — alene skal gi 25.
        const users = [bruker('vinner', 'BRA'), ...Array.from({ length: 40 }, (_, i) => bruker(`tom${i}`, ''))]
        const allBets: AllBets = { users, bets: [] }

        const res = calculateAllBetsExtended(allBets)

        expect(res.users.find((u) => u.id === 'vinner')!.winnerPoints).toEqual(25)
    })
})
