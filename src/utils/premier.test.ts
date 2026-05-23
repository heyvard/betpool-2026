import { regnUtPremier } from './premier'

describe('regnUtPremier', () => {
    it('returnerer null uten innsats', () => {
        expect(
            regnUtPremier(null, 5, {
                premie_forste_prosent: 70,
                premie_andre_prosent: 20,
                premie_tredje_prosent: 10,
            }),
        ).toBeNull()
    })

    it('returnerer null uten medlemmer', () => {
        expect(
            regnUtPremier(200, 0, {
                premie_forste_prosent: 70,
                premie_andre_prosent: 20,
                premie_tredje_prosent: 10,
            }),
        ).toBeNull()
    })

    it('returnerer null når alle prosenter er 0', () => {
        expect(
            regnUtPremier(200, 5, {
                premie_forste_prosent: 0,
                premie_andre_prosent: 0,
                premie_tredje_prosent: 0,
            }),
        ).toBeNull()
    })

    it('beregner pott og fordeling 70/20/10', () => {
        const r = regnUtPremier(200, 10, {
            premie_forste_prosent: 70,
            premie_andre_prosent: 20,
            premie_tredje_prosent: 10,
        })
        expect(r).toEqual({ pott: 2000, forste: 1400, andre: 400, tredje: 200 })
    })

    it('avrunder til nærmeste kr', () => {
        // pott = 750, 33%/33%/34% → 247.5, 247.5, 255 → 248, 248, 255
        const r = regnUtPremier(150, 5, {
            premie_forste_prosent: 33,
            premie_andre_prosent: 33,
            premie_tredje_prosent: 34,
        })
        expect(r).toEqual({ pott: 750, forste: 248, andre: 248, tredje: 255 })
    })

    it('vinneren tar alt', () => {
        const r = regnUtPremier(100, 8, {
            premie_forste_prosent: 100,
            premie_andre_prosent: 0,
            premie_tredje_prosent: 0,
        })
        expect(r).toEqual({ pott: 800, forste: 800, andre: 0, tredje: 0 })
    })

    it('støtter sum < 100 (verten beholder rest)', () => {
        const r = regnUtPremier(100, 10, {
            premie_forste_prosent: 60,
            premie_andre_prosent: 20,
            premie_tredje_prosent: 10,
        })
        expect(r).toEqual({ pott: 1000, forste: 600, andre: 200, tredje: 100 })
    })
})
