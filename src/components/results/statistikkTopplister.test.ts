import { expect } from '@jest/globals'
import { beregnBesteTips, beregnVerdifulleKamper } from './statistikkTopplister'
import { MatchBetMedScore, OtherUser } from '../../queries/useAllBets'

function bet(opts: {
    user: string
    match_num: number
    poeng: number
    homeTeam?: string
    awayTeam?: string
    foreløpig?: boolean
}): MatchBetMedScore {
    return {
        user_id: opts.user,
        match_num: opts.match_num,
        game_start: '2026-06-01T00:00:00Z',
        home_team: opts.homeTeam ?? 'Brasil',
        away_team: opts.awayTeam ?? 'Argentina',
        home_score: 2,
        away_score: 1,
        home_result: '2',
        away_result: '1',
        round: 1,
        poeng: opts.poeng,
        riktigUtfall: true,
        riktigResultat: true,
        joker: false,
        matchpoeng: {
            matchid: String(opts.match_num),
            riktigUtfall: 1,
            riktigResultat: 1,
            antallRiktigeSvar: 1,
            antallRiktigeUtfall: 1,
            andelRiktigeUtfall: 1,
            andelRiktigeResultat: 1,
            utfall: 'H',
            hjemme: 1,
            uavgjort: 0,
            borte: 0,
        },
        foreløpig: opts.foreløpig ?? false,
    }
}

function bruker(id: string, name?: string, picture: string | null = null): OtherUser {
    return { id, name: name ?? id, picture, paid: true }
}

describe('beregnBesteTips', () => {
    it('sorterer synkende på poeng og slår opp brukernavn/bilde', () => {
        const bets = [
            bet({ user: 'A', match_num: 1, poeng: 5 }),
            bet({ user: 'B', match_num: 2, poeng: 10 }),
            bet({ user: 'C', match_num: 3, poeng: 2 }),
        ]
        const users = [bruker('A', 'Ada'), bruker('B', 'Bo', 'bo.png'), bruker('C', 'Cleo')]

        const rader = beregnBesteTips(bets, users)

        expect(rader.map((r) => r.bet.user_id)).toEqual(['B', 'A', 'C'])
        expect(rader[0].userName).toEqual('Bo')
        expect(rader[0].userPicture).toEqual('bo.png')
    })

    it('kapper på ønsket antall (standard 50)', () => {
        const bets = Array.from({ length: 60 }, (_, i) => bet({ user: `U${i}`, match_num: i, poeng: i }))
        const users = bets.map((b) => bruker(b.user_id))

        const rader = beregnBesteTips(bets, users)

        expect(rader.length).toEqual(50)
        expect(rader[0].bet.poeng).toEqual(59)
    })

    it('respekterer et eksplisitt antall-argument', () => {
        const bets = [
            bet({ user: 'A', match_num: 1, poeng: 5 }),
            bet({ user: 'B', match_num: 2, poeng: 10 }),
            bet({ user: 'C', match_num: 3, poeng: 2 }),
        ]
        const users = bets.map((b) => bruker(b.user_id))

        const rader = beregnBesteTips(bets, users, 2)

        expect(rader.length).toEqual(2)
        expect(rader.map((r) => r.bet.user_id)).toEqual(['B', 'A'])
    })

    it('bryter uavgjort på match_num, deretter user_id', () => {
        const bets = [
            bet({ user: 'Z', match_num: 5, poeng: 10 }),
            bet({ user: 'A', match_num: 2, poeng: 10 }),
            bet({ user: 'B', match_num: 2, poeng: 10 }),
        ]
        const users = bets.map((b) => bruker(b.user_id))

        const rader = beregnBesteTips(bets, users)

        expect(rader.map((r) => r.bet.user_id)).toEqual(['A', 'B', 'Z'])
    })

    it('faller tilbake til user_id når brukeren ikke finnes i listen', () => {
        const bets = [bet({ user: 'ukjent', match_num: 1, poeng: 5 })]

        const rader = beregnBesteTips(bets, [])

        expect(rader[0].userName).toEqual('ukjent')
        expect(rader[0].userPicture).toBeNull()
    })

    it('ekskluderer foreløpige (fortsatt pågående) bets', () => {
        const bets = [
            bet({ user: 'A', match_num: 1, poeng: 100, foreløpig: true }),
            bet({ user: 'B', match_num: 2, poeng: 5 }),
        ]
        const users = bets.map((b) => bruker(b.user_id))

        const rader = beregnBesteTips(bets, users)

        expect(rader.map((r) => r.bet.user_id)).toEqual(['B'])
    })
})

describe('beregnVerdifulleKamper', () => {
    it('summerer poeng per kamp på tvers av brukere', () => {
        const bets = [
            bet({ user: 'A', match_num: 1, poeng: 5 }),
            bet({ user: 'B', match_num: 1, poeng: 3 }),
            bet({ user: 'C', match_num: 2, poeng: 20 }),
        ]

        const rader = beregnVerdifulleKamper(bets)

        expect(rader.map((r) => [r.match_num, r.totalPoeng, r.antallBets])).toEqual([
            [2, 20, 1],
            [1, 8, 2],
        ])
    })

    it('kapper på ønsket antall (standard 50)', () => {
        const bets = Array.from({ length: 60 }, (_, i) => bet({ user: 'A', match_num: i, poeng: i }))

        const rader = beregnVerdifulleKamper(bets)

        expect(rader.length).toEqual(50)
        expect(rader[0].totalPoeng).toEqual(59)
    })

    it('bryter uavgjort på match_num', () => {
        const bets = [bet({ user: 'A', match_num: 9, poeng: 10 }), bet({ user: 'B', match_num: 3, poeng: 10 })]

        const rader = beregnVerdifulleKamper(bets)

        expect(rader.map((r) => r.match_num)).toEqual([3, 9])
    })

    it('henter lag/resultat fra kampens første bet', () => {
        const bets = [bet({ user: 'A', match_num: 1, poeng: 5, homeTeam: 'NOR', awayTeam: 'BRA' })]

        const rader = beregnVerdifulleKamper(bets)

        expect(rader[0]).toMatchObject({ home_team: 'NOR', away_team: 'BRA', home_score: 2, away_score: 1 })
    })

    it('ekskluderer foreløpige (fortsatt pågående) bets fra summen', () => {
        const bets = [
            bet({ user: 'A', match_num: 1, poeng: 100, foreløpig: true }),
            bet({ user: 'B', match_num: 2, poeng: 5 }),
        ]

        const rader = beregnVerdifulleKamper(bets)

        expect(rader.map((r) => r.match_num)).toEqual([2])
    })
})
