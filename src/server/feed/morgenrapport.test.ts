import { LeaderBoard } from '../../components/results/calculateAllScores'
import { beregnPlasseringer, SnapshotRad, velgMorgenScenario } from './morgenrapport'

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
