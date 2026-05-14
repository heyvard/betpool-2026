import { regnUtScoreForKamp } from './matchScoreCalculator'
import { expect } from '@jest/globals'
import { skapMatchBetArray } from './testdatahelper'

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
