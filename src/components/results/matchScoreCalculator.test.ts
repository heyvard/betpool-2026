import { regnUtScoreForKamp } from './matchScoreCalculator'
import { expect } from '@jest/globals'
import { skapMatchBetArray } from './testdatahelper'
import { MatchBet } from '../../queries/useAllBets'

describe('Tester match score calculator', () => {
    it('Tom input', () => {
        const res = regnUtScoreForKamp([])
        expect(res.size).toEqual(0)
    })

    it('Gruppespill kamp 10 spillere 1 helt rett', () => {
        const res = regnUtScoreForKamp(
            skapMatchBetArray({
                runde: 1,
                antallHeltRiktig: 1,
                antallRiktigUtfall: 0,
                antallFeil: 8,
            }),
        )
        expect(res.size).toEqual(1)
        expect(res.get('1')).toEqual({
            antallRiktigeSvar: 1,
            antallRiktigeUtfall: 1,
            matchid: '1',
            riktigResultat: 3,
            riktigUtfall: 2,
            utfall: 'B',
            andelRiktigeResultat: 0.1111111111111111,
            andelRiktigeUtfall: 0.1111111111111111,
            borte: 1,
            hjemme: 0,
            uavgjort: 8,
        })
    })

    it('teller med tips der scoren er tallet 0', () => {
        // Postgres returnerer scorene som tall, ikke strenger slik testdataene
        // over bruker. Tallet 0 er falsy i JS, så en tidligere
        // `if (home_score && away_score)`-sjekk droppet 0-0-tips fra tellingen.
        const lagBet = (home: number, away: number, user: string) =>
            ({
                match_num: 1,
                round: 1,
                game_start: 'x',
                home_team: 'A',
                away_team: 'B',
                home_result: 0,
                away_result: 0,
                home_score: home,
                away_score: away,
                user_id: user,
                // MatchBet er typet `string | null`, men runtime-verdien er et tall.
            }) as unknown as MatchBet

        const res = regnUtScoreForKamp([lagBet(0, 0, '1'), lagBet(0, 0, '2'), lagBet(2, 1, '3')])
        expect(res.get('1')).toEqual({
            matchid: '1',
            riktigUtfall: 1,
            riktigResultat: 1,
            antallRiktigeSvar: 2,
            antallRiktigeUtfall: 2,
            andelRiktigeUtfall: 2 / 3,
            andelRiktigeResultat: 2 / 3,
            utfall: 'U',
            hjemme: 1,
            uavgjort: 2,
            borte: 0,
        })
    })

    it('Semifinale kamp 10 spillere 1 helt rett', () => {
        const res = regnUtScoreForKamp(
            skapMatchBetArray({
                runde: 7,
                antallHeltRiktig: 1,
                antallRiktigUtfall: 0,
                antallFeil: 8,
            }),
        )
        expect(res.size).toEqual(1)
        expect(res.get('1')).toEqual({
            antallRiktigeSvar: 1,
            antallRiktigeUtfall: 1,
            matchid: '1',
            riktigResultat: 9,
            riktigUtfall: 6,
            utfall: 'B',
            andelRiktigeResultat: 0.1111111111111111,
            andelRiktigeUtfall: 0.1111111111111111,
            borte: 1,
            hjemme: 0,
            uavgjort: 8,
        })
    })
})
