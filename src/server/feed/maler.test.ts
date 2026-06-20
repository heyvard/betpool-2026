import {
    formatResultat,
    formatTipp,
    malEndring,
    malIngenTraff,
    malLederbytte,
    malSjeldent,
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

describe('maler – kamp-scenarioer', () => {
    it('sjeldent: alene-tittel og rundevekt i body', () => {
        const m = malSjeldent({
            spillere: ['Ola'],
            resultat: '2–1',
            antall: 1,
            totalt: 12,
            vekt: 3,
            poeng: 15,
            superlativ: 'kveldens største napp',
        })
        expect(m.accent).toBe('gold')
        expect(m.tittel).toBe('Ola satt alene med 2–1')
        expect(m.body).toContain('1 av 12')
        expect(m.body).toContain('×3')
        expect(m.body).toContain('+15 poeng')
        expect(m.body).toContain('kveldens største napp')
    })

    it('sjeldent: flertall-tittel når flere traff', () => {
        const m = malSjeldent({ spillere: ['A', 'B'], resultat: '0–0', antall: 2, totalt: 20, vekt: 1, poeng: 5 })
        expect(m.tittel).toBe('2 hadde 0–0')
    })

    it('ingen_traff: deler utfallspoeng', () => {
        const m = malIngenTraff({
            totalt: 10,
            resultat: '3–2',
            utfall: 'H',
            homeTla: 'BRA',
            awayTla: 'ARG',
            antallUtfall: 4,
        })
        expect(m.accent).toBe('stone')
        expect(m.tittel).toBe('Ingen traff resultatet')
        expect(m.body).toContain('0 av 10')
        expect(m.body).toContain('seier til Brasil')
    })
})

describe('maler – morgenrapport', () => {
    it('endring: fletter klatrer, faller og topp-status', () => {
        const m = malEndring({
            antallKamper: 4,
            størsteKlatrer: { navn: 'Robin', n: 3, plass: 2 },
            størsteFaller: { navn: 'Marius', n: 3, plass: 10 },
            nyTopp3: false,
        })
        expect(m.accent).toBe('royal')
        expect(m.tittel).toBe('4 kamper avgjort i går')
        expect(m.body).toBe('Robin klatret 3 plasser til 2. Marius falt 3 til 10. Topp 3 ellers uendret.')
    })

    it('lederbytte: ny leder, luke og dager', () => {
        const m = malLederbytte({ nyLeder: 'Ada', gammelLeder: 'Ola', luke: '5', dager: 6 })
        expect(m.accent).toBe('gold')
        expect(m.tittel).toBe('Ada har tatt ledelsen')
        expect(m.body).toContain('Gikk forbi Ola')
        expect(m.body).toContain('med 5 poeng')
        expect(m.body).toContain('ledet i 6 dager')
    })
})
