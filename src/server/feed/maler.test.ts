import {
    formatResultat,
    formatTipp,
    malDeltLedelse,
    malEndring,
    malEnstemmig,
    malIngenTraff,
    malJoker,
    malLederbytte,
    malLederHolder,
    malSjeldent,
    malSjokk,
    velgVariant,
    visningsnavn,
} from './maler'

describe('maler – formatering', () => {
    it('bruker tankestrek i resultat', () => {
        expect(formatResultat(2, 1)).toBe('2–1')
        expect(formatResultat(2, 1)).not.toContain('-')
    })

    it('formaterer tipp med vinnerlag, uavgjort uten lag', () => {
        expect(formatTipp(2, 0, 'BRA', 'ARG')).toBe('2–0 til Brasil')
        expect(formatTipp(0, 2, 'BRA', 'ARG')).toBe('0–2 til Argentina')
        expect(formatTipp(1, 1, 'BRA', 'ARG')).toBe('1–1')
    })

    it('kutter e-post i visningsnavn', () => {
        expect(visningsnavn('ola@example.com')).toBe('ola')
        expect(visningsnavn('Kari')).toBe('Kari')
    })
})

describe('velgVariant', () => {
    it('er deterministisk for samme frø og varierer med ulike frø', () => {
        const arr = ['a', 'b', 'c', 'd']
        expect(velgVariant(arr, 1)).toBe(velgVariant(arr, 1))
        expect(velgVariant(arr, 'foo')).toBe(velgVariant(arr, 'foo'))
        const valgte = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((f) => velgVariant(arr, f)))
        expect(valgte.size).toBeGreaterThan(1)
    })
})

describe('maler – kamp-scenarioer', () => {
    it('sjeldent: alene-tittel nevner spilleren, og rundevekt/poeng i body', () => {
        const m = malSjeldent({ spillere: ['Ola'], resultat: '2–1', antall: 1, totalt: 12, vekt: 3, poeng: 15, frø: 1 })
        expect(m.accent).toBe('gold')
        expect(m.tittel).toContain('Ola')
        expect(m.tittel).toContain('2–1')
        expect(m.body).toContain('av 12')
        expect(m.body).toContain('×3')
        expect(m.body).toContain('+15 poeng')
        expect(m.body).not.toContain('største napp')
    })

    it('sjeldent: flertall-tittel når flere traff', () => {
        const m = malSjeldent({
            spillere: ['A', 'B'],
            resultat: '0–0',
            antall: 2,
            totalt: 20,
            vekt: 1,
            poeng: 5,
            frø: 1,
        })
        expect(m.tittel).toContain('2')
        expect(m.tittel).toContain('0–0')
    })

    it('ingen_traff: deler utfallspoeng', () => {
        const m = malIngenTraff({
            totalt: 10,
            resultat: '3–2',
            utfall: 'H',
            homeTla: 'BRA',
            awayTla: 'ARG',
            antallUtfall: 4,
            frø: 1,
        })
        expect(m.accent).toBe('stone')
        expect(m.body).toContain('3–2')
        expect(m.body).toContain('seier til Brasil')
    })

    it('enstemmig: alle traff utfallet', () => {
        const m = malEnstemmig({ totalt: 8, resultat: '1–0', utfall: 'H', homeTla: 'BRA', awayTla: 'ARG', frø: 2 })
        expect(m.accent).toBe('win')
        expect(m.body).toContain('seier til Brasil')
        expect(m.body).toContain('1–0')
    })

    it('sjokk: ingen traff utfallet', () => {
        const m = malSjokk({ totalt: 9, resultat: '0–3', utfall: 'B', homeTla: 'BRA', awayTla: 'ARG', frø: 3 })
        expect(m.accent).toBe('live')
        expect(m.body).toContain('0–3')
    })

    it('joker: ulik tone om jokeren satt eller brant', () => {
        const satt = malJoker({ navn: 'Ola', poeng: 12, resultat: '2–1', satt: true, frø: 4 })
        expect(satt.accent).toBe('gold')
        expect(satt.tittel).toContain('Ola')
        expect(satt.body).toContain('12')
        const brant = malJoker({ navn: 'Ola', poeng: 0, resultat: '2–1', satt: false, frø: 4 })
        expect(brant.tittel).toContain('Ola')
        expect(brant.tittel).not.toBe(satt.tittel)
    })
})

describe('maler – morgenrapport', () => {
    it('endring: fletter klatrer, faller og topp-status', () => {
        const m = malEndring({
            antallKamper: 4,
            størsteKlatrer: { navn: 'Robin', n: 3, plass: 2 },
            størsteFaller: { navn: 'Marius', n: 3, plass: 10 },
            nyTopp3: false,
            frø: '2026-06-20',
        })
        expect(m.accent).toBe('royal')
        expect(m.tittel).toContain('4 kamper')
        expect(m.body).toContain('Robin')
        expect(m.body).toContain('Marius')
        expect(m.body).toContain('Topp 3 står som støpt.')
    })

    it('endring: bunn-vinkel når jumboplassen byttet eier', () => {
        const m = malEndring({
            antallKamper: 3,
            størsteKlatrer: null,
            størsteFaller: { navn: 'Marius', n: 3, plass: 12 },
            nyTopp3: false,
            bunn: { jumbo: { navn: 'Marius', plass: 12, poeng: 4 }, nyJumbo: true, rømling: null, luke: 1 },
            frø: '2026-06-22',
        })
        // Nevner jumboen, men ikke som rømling (rømling = null).
        expect(m.body).toContain('Marius')
        expect(m.body.toLowerCase()).toMatch(/jumbo|kjeller|sisteplass/)
    })

    it('endring: bunn-vinkel forteller om rømlingen som dyttet noen ned', () => {
        const m = malEndring({
            antallKamper: 2,
            størsteKlatrer: { navn: 'Ada', n: 2, plass: 9 },
            størsteFaller: null,
            nyTopp3: false,
            bunn: { jumbo: { navn: 'Bo', plass: 14, poeng: 7 }, nyJumbo: true, rømling: 'Ada', luke: 2 },
            frø: '2026-06-22',
        })
        expect(m.body).toContain('Ada')
        expect(m.body).toContain('Bo')
    })

    it('endring: bunn-vinkel når samme stakkar henger igjen nederst', () => {
        const m = malEndring({
            antallKamper: 1,
            størsteKlatrer: null,
            størsteFaller: null,
            nyTopp3: false,
            bunn: { jumbo: { navn: 'Cleo', plass: 16, poeng: 3 }, nyJumbo: false, rømling: null, luke: 5 },
            frø: '2026-06-22',
        })
        expect(m.body).toContain('Cleo')
    })

    it('endring: uten bunn-data nevnes ingen jumbo', () => {
        const m = malEndring({
            antallKamper: 4,
            størsteKlatrer: { navn: 'Robin', n: 3, plass: 2 },
            størsteFaller: null,
            nyTopp3: false,
            frø: '2026-06-20',
        })
        expect(m.body.toLowerCase()).not.toContain('jumbo')
    })

    it('endring: navngir hvem som går inn i topp 3', () => {
        const m = malEndring({
            antallKamper: 3,
            størsteKlatrer: { navn: 'Robin', n: 3, plass: 2 },
            størsteFaller: null,
            nyTopp3: true,
            nyeITopp3: [
                { navn: 'Robin', plass: 2 },
                { navn: 'Ada', plass: 3 },
            ],
            frø: '2026-06-21',
        })
        expect(m.body).toContain('Ny i topp 3: Robin (2.) og Ada (3.).')
        expect(m.body).not.toContain('Topp 3 står som støpt.')
    })

    it('lederbytte: ny leder, luke og dager', () => {
        const m = malLederbytte({ nyLeder: 'Ada', gammelLeder: 'Ola', luke: '5', dager: 6, frø: '2026-06-20' })
        expect(m.accent).toBe('gold')
        expect(m.tittel).toContain('Ada')
        expect(m.body).toContain('Ola')
        expect(m.body).toContain('5 poeng')
        expect(m.body).toContain('6 dager')
    })

    it('leder_holder: samme leder holder stand', () => {
        const m = malLederHolder({ leder: 'Ada', luke: '5', dager: 4, frø: '2026-06-20' })
        expect(m.accent).toBe('gold')
        expect(m.tittel).toContain('Ada')
        expect(m.body).toContain('4 dager')
        expect(m.body).toContain('5 poeng')
    })

    it('delt_ledelse: utfordrer innhentet lederen — nevner begge og delt poengsum', () => {
        const m = malDeltLedelse({
            ledere: ['Johannes Langlo', 'Dagga'],
            poeng: 31,
            nyeUtfordrere: ['Johannes Langlo'],
            forrigeLeder: 'Dagga',
            dager: 1,
            frø: '2026-06-21',
        })
        expect(m.accent).toBe('gold')
        expect(m.tittel.toLowerCase()).toMatch(/delt|dødt løp|skulder/)
        expect(m.body).toContain('Johannes Langlo')
        expect(m.body).toContain('Dagga')
        expect(m.body).toContain('31 poeng')
        // Skal aldri påstå at noen «leder med 0 poeng».
        expect(m.body).not.toContain('0 poeng')
    })

    it('delt_ledelse: tre på topp uten utpekt utfordrer lister alle med «og»', () => {
        const m = malDeltLedelse({
            ledere: ['Ada', 'Bo', 'Cleo'],
            poeng: 42,
            nyeUtfordrere: ['Bo', 'Cleo'],
            forrigeLeder: null,
            dager: 0,
            frø: '2026-06-22',
        })
        expect(m.body).toContain('Ada, Bo og Cleo')
        expect(m.body).toContain('42 poeng')
    })
})
