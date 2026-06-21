import { LeaderBoard } from '../../components/results/calculateAllScores'
import { BunnArgs } from './maler'
import { beregnBunn, beregnPlasseringer, SnapshotRad, velgMorgenScenario } from './morgenrapport'

function rad(userid: string, poeng: number, userName = userid): LeaderBoard {
    return { userid, poeng, userName, paid: true, picture: null }
}

describe('beregnPlasseringer – delt plass', () => {
    it('gir delte plasser ved poenglikhet (1224-rangering)', () => {
        const tabell = [rad('a', 40), rad('b', 32), rad('c', 32), rad('d', 32), rad('e', 31), rad('f', 31)]
        const p = beregnPlasseringer(tabell)
        expect(p.get('a')).toBe(1)
        // Tre på 32 deler 2. plass, neste hopper til 5.
        expect(p.get('b')).toBe(2)
        expect(p.get('c')).toBe(2)
        expect(p.get('d')).toBe(2)
        expect(p.get('e')).toBe(5)
        expect(p.get('f')).toBe(5)
    })

    it('gir fortløpende plasser uten likhet', () => {
        const p = beregnPlasseringer([rad('a', 5), rad('b', 4), rad('c', 3)])
        expect([p.get('a'), p.get('b'), p.get('c')]).toEqual([1, 2, 3])
    })
})

describe('beregnBunn – bunnstriden', () => {
    const plasser = (tabell: LeaderBoard[]) => beregnPlasseringer(tabell)

    it('returnerer null i små puljer (< 4)', () => {
        const tabell = [rad('a', 10), rad('b', 6), rad('c', 3)]
        expect(beregnBunn(tabell, plasser(tabell), [])).toBeNull()
    })

    it('returnerer null før noen har poeng (vilkårlig rekkefølge)', () => {
        const tabell = [rad('a', 0), rad('b', 0), rad('c', 0), rad('d', 0)]
        expect(beregnBunn(tabell, plasser(tabell), [])).toBeNull()
    })

    it('peker ut jumboen og luka opp til nest sist', () => {
        const tabell = [rad('a', 40), rad('b', 30), rad('c', 20), rad('d', 12)]
        const forrige: SnapshotRad[] = [
            { user_id: 'a', plass: 1, poeng: 40 },
            { user_id: 'b', plass: 2, poeng: 30 },
            { user_id: 'c', plass: 3, poeng: 20 },
            { user_id: 'd', plass: 4, poeng: 12 },
        ]
        const bunn = beregnBunn(tabell, plasser(tabell), forrige) as BunnArgs
        expect(bunn.jumbo.navn).toBe('d')
        expect(bunn.jumbo.plass).toBe(4)
        expect(bunn.luke).toBe(8)
        expect(bunn.nyJumbo).toBe(false)
        expect(bunn.rømling).toBeNull()
    })

    it('markerer ny jumbo og rømlingen som klatret bort fra bånn', () => {
        // I går lå c sist; i natt falt d forbi og er ny jumbo, mens c rømte opp.
        const tabell = [rad('a', 40), rad('b', 30), rad('c', 20), rad('d', 12)]
        const forrige: SnapshotRad[] = [
            { user_id: 'a', plass: 1, poeng: 40 },
            { user_id: 'b', plass: 2, poeng: 28 },
            { user_id: 'd', plass: 3, poeng: 18 },
            { user_id: 'c', plass: 4, poeng: 10 },
        ]
        const bunn = beregnBunn(tabell, plasser(tabell), forrige) as BunnArgs
        expect(bunn.jumbo.navn).toBe('d')
        expect(bunn.nyJumbo).toBe(true)
        expect(bunn.rømling).toBe('c')
    })
})

describe('velgMorgenScenario – plassering ved delt plass', () => {
    const navnMap = (tabell: LeaderBoard[]) => new Map(tabell.map((r) => [r.userid, r.userName]))

    it('viser delt plass (ikke radnummer) i endrings-deltaene', () => {
        // c og d ligger likt på 31 → delt 3. plass, ikke 3 og 4.
        const tabell = [rad('a', 40), rad('b', 35), rad('c', 31), rad('d', 31)]
        const forrige: SnapshotRad[] = [
            { user_id: 'a', plass: 1, poeng: 40 },
            { user_id: 'b', plass: 2, poeng: 30 },
            { user_id: 'c', plass: 4, poeng: 20 },
            { user_id: 'd', plass: 3, poeng: 25 },
        ]
        const valg = velgMorgenScenario({
            tabell,
            navnMap: navnMap(tabell),
            forrigeRader: forrige,
            antallKamper: 2,
            dager: 1,
            frø: '2026-06-21',
        })!
        expect(valg.scenario).toBe('endring')
        const delta = valg.data.delta as { navn: string; nyPlass: number; deltaPlass: number }[]
        const c = delta.find((d) => d.navn === 'c')!
        // c klatret fra 4 til delt 3. plass (+1), ikke til rad-index 3.
        expect(c.nyPlass).toBe(3)
        expect(c.deltaPlass).toBe(1)
    })

    it('navngir hvem som gikk inn i topp 3', () => {
        const tabell = [rad('a', 40), rad('b', 35), rad('c', 30), rad('d', 20)]
        const forrige: SnapshotRad[] = [
            { user_id: 'a', plass: 1, poeng: 40 },
            { user_id: 'b', plass: 2, poeng: 35 },
            { user_id: 'd', plass: 3, poeng: 28 },
            { user_id: 'c', plass: 4, poeng: 20 },
        ]
        const valg = velgMorgenScenario({
            tabell,
            navnMap: navnMap(tabell),
            forrigeRader: forrige,
            antallKamper: 1,
            dager: 1,
            frø: '2026-06-21',
        })!
        const nye = valg.data.nyeITopp3 as { navn: string; plass: number }[]
        expect(nye).toEqual([{ navn: 'c', plass: 3 }])
        expect(valg.mal.body).toContain('Ny i topp 3: c (3.).')
    })
})

describe('velgMorgenScenario – delt ledelse vs. lederbytte', () => {
    const navnMap = (tabell: LeaderBoard[]) => new Map(tabell.map((r) => [r.userid, r.userName]))

    it('lik poengsum på topp gir delt_ledelse, ikke lederbytte (ingen «0 poeng»-luke)', () => {
        // Reproduserer bilde-buggen: gårsdagens leder «dagga» og utfordrer
        // «johannes» står begge på 31. Sorteringen legger johannes øverst på
        // userid-tiebreak, men ingen har egentlig gått forbi noen.
        const tabell = [rad('johannes', 31), rad('dagga', 31), rad('bendik', 29), rad('d', 20)]
        const forrige: SnapshotRad[] = [
            { user_id: 'dagga', plass: 1, poeng: 28 },
            { user_id: 'johannes', plass: 2, poeng: 24 },
            { user_id: 'bendik', plass: 3, poeng: 22 },
            { user_id: 'd', plass: 4, poeng: 15 },
        ]
        const valg = velgMorgenScenario({
            tabell,
            navnMap: navnMap(tabell),
            forrigeRader: forrige,
            antallKamper: 3,
            dager: 1,
            frø: '2026-06-21',
        })!
        expect(valg.scenario).toBe('delt_ledelse')
        expect(valg.mal.body).not.toContain('0 poeng')
        expect(valg.mal.body).toContain('johannes')
        expect(valg.mal.body).toContain('dagga')
        // Utfordreren johannes pekes ut, dagga er den innhentede forrige lederen.
        expect(valg.data.nyeUtfordrere).toEqual(['johannes'])
    })

    it('et reelt forbisprang (forrige leder faller under) gir fortsatt lederbytte', () => {
        const tabell = [rad('johannes', 34), rad('dagga', 30), rad('bendik', 29), rad('d', 20)]
        const forrige: SnapshotRad[] = [
            { user_id: 'dagga', plass: 1, poeng: 28 },
            { user_id: 'johannes', plass: 2, poeng: 24 },
            { user_id: 'bendik', plass: 3, poeng: 22 },
            { user_id: 'd', plass: 4, poeng: 15 },
        ]
        const valg = velgMorgenScenario({
            tabell,
            navnMap: navnMap(tabell),
            forrigeRader: forrige,
            antallKamper: 3,
            dager: 4,
            frø: '2026-06-21',
        })!
        expect(valg.scenario).toBe('lederbytte')
        expect(valg.data.nyLeder).toBe('johannes')
        expect(valg.data.luke).toBe(4)
    })

    it('leder_holder viser dag-INKLUSIV streak (dager + 1), siden lederen står øverst også i dag', () => {
        // Samme leder alene på topp som i går. `dager` = 2 er streaken t.o.m. i går;
        // i dag står han fortsatt øverst, så teksten skal si 3 dager på rad.
        const tabell = [rad('johannes', 45), rad('dagga', 35), rad('bendik', 34), rad('d', 28)]
        const forrige: SnapshotRad[] = [
            { user_id: 'johannes', plass: 1, poeng: 37 },
            { user_id: 'dagga', plass: 2, poeng: 33 },
            { user_id: 'bendik', plass: 3, poeng: 31 },
            { user_id: 'd', plass: 4, poeng: 25 },
        ]
        const valg = velgMorgenScenario({
            tabell,
            navnMap: navnMap(tabell),
            forrigeRader: forrige,
            antallKamper: 3,
            dager: 2,
            frø: '2026-06-21',
        })!
        expect(valg.scenario).toBe('leder_holder')
        expect(valg.data.dager).toBe(3)
        expect(valg.mal.body).toContain('3 dager')
    })

    it('uendret delt topp gjentar ikke delt_ledelse — faller til endring', () => {
        // Begge sto delt på topp også i går; ingen ny i teten → ikke ny «dødt løp».
        const tabell = [rad('johannes', 31), rad('dagga', 31), rad('bendik', 29), rad('d', 20)]
        const forrige: SnapshotRad[] = [
            { user_id: 'johannes', plass: 1, poeng: 28 },
            { user_id: 'dagga', plass: 1, poeng: 28 },
            { user_id: 'bendik', plass: 3, poeng: 22 },
            { user_id: 'd', plass: 4, poeng: 18 },
        ]
        const valg = velgMorgenScenario({
            tabell,
            navnMap: navnMap(tabell),
            forrigeRader: forrige,
            antallKamper: 2,
            dager: 2,
            frø: '2026-06-21',
        })!
        expect(valg.scenario).toBe('endring')
    })
})
