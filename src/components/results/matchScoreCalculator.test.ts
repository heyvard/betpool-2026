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
            riktigResultat: 5,
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
            riktigResultat: 15,
            riktigUtfall: 6,
            utfall: 'B',
            andelRiktigeResultat: 0.1111111111111111,
            andelRiktigeUtfall: 0.1111111111111111,
            borte: 1,
            hjemme: 0,
            uavgjort: 8,
        })
    })

    it('Bronsefinale kamp 10 spillere 1 helt rett — samme vekting som semifinale', () => {
        const res = regnUtScoreForKamp(
            skapMatchBetArray({
                runde: 8,
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
            riktigResultat: 15,
            riktigUtfall: 6,
            utfall: 'B',
            andelRiktigeResultat: 0.1111111111111111,
            andelRiktigeUtfall: 0.1111111111111111,
            borte: 1,
            hjemme: 0,
            uavgjort: 8,
        })
    })

    it('Finale kamp 10 spillere 1 helt rett', () => {
        const res = regnUtScoreForKamp(
            skapMatchBetArray({
                runde: 9,
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
            riktigResultat: 20,
            riktigUtfall: 8,
            utfall: 'B',
            andelRiktigeResultat: 0.1111111111111111,
            andelRiktigeUtfall: 0.1111111111111111,
            borte: 1,
            hjemme: 0,
            uavgjort: 8,
        })
    })
})

describe('Forslag 3 og 4: trapper på eksakt resultat og utfall', () => {
    // Gruppespill (vekting 1) gjør at multiplikatoren leses rett av poengene.
    it('alene om eksakt resultat gir vekt × 5', () => {
        const res = regnUtScoreForKamp(
            skapMatchBetArray({ runde: 1, antallHeltRiktig: 1, antallRiktigUtfall: 0, antallFeil: 19 }),
        )
        expect(res.get('1')!.riktigResultat).toEqual(5)
    })

    it('< 5 % traff eksakt (men ikke alene) gir vekt × 4', () => {
        // 2 av 50 = 4 %
        const res = regnUtScoreForKamp(
            skapMatchBetArray({ runde: 1, antallHeltRiktig: 2, antallRiktigUtfall: 0, antallFeil: 48 }),
        )
        expect(res.get('1')!.riktigResultat).toEqual(4)
    })

    it('< 15 % traff eksakt gir vekt × 3', () => {
        // 2 av 20 = 10 %
        const res = regnUtScoreForKamp(
            skapMatchBetArray({ runde: 1, antallHeltRiktig: 2, antallRiktigUtfall: 0, antallFeil: 18 }),
        )
        expect(res.get('1')!.riktigResultat).toEqual(3)
    })

    it('< 30 % traff eksakt gir vekt × 2', () => {
        // 4 av 20 = 20 %
        const res = regnUtScoreForKamp(
            skapMatchBetArray({ runde: 1, antallHeltRiktig: 4, antallRiktigUtfall: 0, antallFeil: 16 }),
        )
        expect(res.get('1')!.riktigResultat).toEqual(2)
    })

    it('< 10 % traff utfallet gir vekt × 3', () => {
        // 1 riktig utfall av 11 = 9,1 %
        const res = regnUtScoreForKamp(
            skapMatchBetArray({ runde: 1, antallHeltRiktig: 0, antallRiktigUtfall: 1, antallFeil: 10 }),
        )
        expect(res.get('1')!.riktigUtfall).toEqual(3)
    })
})
