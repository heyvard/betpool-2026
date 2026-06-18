import { beregnKampKlokke, formaterKampMinutt } from './kampklokke'

const START = '2026-06-18T18:00:00.000Z'

// Hjelper: «nå» n minutter (+ valgfrie sekunder) etter avspark.
function nå(minutter: number, sekunder = 0): Date {
    return new Date(new Date(START).getTime() + minutter * 60000 + sekunder * 1000)
}

describe('beregnKampKlokke', () => {
    it('er ikke startet før avspark', () => {
        expect(beregnKampKlokke(START, nå(-1))).toEqual({ type: 'ikkeStartet' })
    })

    it('viser 1. minutt rett etter avspark', () => {
        expect(beregnKampKlokke(START, nå(0, 30))).toEqual({ type: 'spiller', minutt: 1, tillegg: false })
    })

    it('teller opp gjennom 1. omgang', () => {
        expect(beregnKampKlokke(START, nå(23))).toEqual({ type: 'spiller', minutt: 24, tillegg: false })
        expect(beregnKampKlokke(START, nå(44))).toEqual({ type: 'spiller', minutt: 45, tillegg: false })
    })

    it('viser 45+ i 1. omgangs tilleggstid', () => {
        expect(beregnKampKlokke(START, nå(45))).toEqual({ type: 'spiller', minutt: 45, tillegg: true })
        expect(beregnKampKlokke(START, nå(46))).toEqual({ type: 'spiller', minutt: 45, tillegg: true })
    })

    it('viser pause i pausevinduet', () => {
        expect(beregnKampKlokke(START, nå(50))).toEqual({ type: 'pause' })
        expect(beregnKampKlokke(START, nå(59))).toEqual({ type: 'pause' })
    })

    it('teller fra 46 i 2. omgang', () => {
        expect(beregnKampKlokke(START, nå(60))).toEqual({ type: 'spiller', minutt: 46, tillegg: false })
        expect(beregnKampKlokke(START, nå(104))).toEqual({ type: 'spiller', minutt: 90, tillegg: false })
    })

    it('viser 90+ etter ordinær tid', () => {
        expect(beregnKampKlokke(START, nå(105))).toEqual({ type: 'spiller', minutt: 90, tillegg: true })
        expect(beregnKampKlokke(START, nå(140))).toEqual({ type: 'spiller', minutt: 90, tillegg: true })
    })

    it('lar synket status overstyre tidsanslaget', () => {
        // PAUSED midt i «1. omgang»-tid → pause uansett.
        expect(beregnKampKlokke(START, nå(20), 'PAUSED')).toEqual({ type: 'pause' })
        // FINISHED selv om tiden tilsier at den fortsatt spilles.
        expect(beregnKampKlokke(START, nå(70), 'FINISHED')).toEqual({ type: 'ferdig' })
    })
})

describe('formaterKampMinutt', () => {
    it('formaterer løpende minutt og tilleggstid', () => {
        expect(formaterKampMinutt({ type: 'spiller', minutt: 63, tillegg: false })).toBe("63'")
        expect(formaterKampMinutt({ type: 'spiller', minutt: 45, tillegg: true })).toBe('45+')
    })

    it('returnerer null for ikke-spillende tilstander', () => {
        expect(formaterKampMinutt({ type: 'pause' })).toBeNull()
        expect(formaterKampMinutt({ type: 'ferdig' })).toBeNull()
        expect(formaterKampMinutt({ type: 'ikkeStartet' })).toBeNull()
    })
})
