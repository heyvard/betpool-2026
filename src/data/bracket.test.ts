import { ALLE_BRACKET_SLOTS, BRACKET_KOLONNER, BRONSE_SLOT } from './bracket'

// De 32 utslagskampene (r4–r9) i VM 2026, hentet fra footballDataFixtures /
// matches-datasettet. Disse skal være nøyaktig de match_num-ene treet refererer.
const ALLE_KNOCKOUT = [
    // R32
    537415, 537416, 537417, 537418, 537419, 537420, 537421, 537422, 537423, 537424, 537425, 537426, 537427, 537428,
    537429, 537430,
    // R16
    537375, 537376, 537377, 537378, 537379, 537380, 537381, 537382,
    // KF
    537383, 537384, 537385, 537386,
    // SF
    537387, 537388,
    // Bronse + finale
    537389, 537390,
]

describe('bracket-tre', () => {
    it('har riktig antall kamper per runde (16/8/4/2/1 + bronse)', () => {
        const antall = BRACKET_KOLONNER.map((k) => k.slots.length)
        expect(antall).toEqual([16, 8, 4, 2, 1])
        expect(BRONSE_SLOT.matchNum).toBe(537389)
    })

    it('dekker nøyaktig de 32 utslagskampene, uten duplikater', () => {
        const fraTre = ALLE_BRACKET_SLOTS.map((s) => s.matchNum).sort((a, b) => a - b)
        expect(fraTre).toHaveLength(32)
        expect(new Set(fraTre).size).toBe(32)
        expect(fraTre).toEqual([...ALLE_KNOCKOUT].sort((a, b) => a - b))
    })

    it('lar hver feeder peke på en kamp i forrige runde', () => {
        const slotForNum = new Map(ALLE_BRACKET_SLOTS.map((s) => [s.matchNum, s]))
        for (const slot of ALLE_BRACKET_SLOTS) {
            if (!slot.feeders) {
                expect(slot.runde).toBe(4) // bare R32 mangler feedere
                continue
            }
            expect(slot.feeders).toHaveLength(2)
            for (const f of slot.feeders) {
                const feeder = slotForNum.get(f)
                expect(feeder).toBeDefined()
                // Bronse + finale mates begge av semifinalene (runde 7); ellers
                // skal feederen ligge nøyaktig én runde lavere.
                if (slot.runde === 8 || slot.runde === 9) {
                    expect(feeder!.runde).toBe(7)
                } else {
                    expect(feeder!.runde).toBe(slot.runde - 1)
                }
            }
        }
    })

    it('bygger bronsefinalen fra de to semifinale-taperne', () => {
        expect(BRONSE_SLOT.feedersErTapere).toBe(true)
        expect(BRONSE_SLOT.feeders).toEqual([537387, 537388])
    })

    it('har ingen kamp som feeder for to forskjellige slots', () => {
        const brukt = new Map<number, number>()
        for (const slot of ALLE_BRACKET_SLOTS) {
            if (slot.runde === 8) continue // bronse deler bevisst feedere med finalen
            for (const f of slot.feeders ?? []) {
                brukt.set(f, (brukt.get(f) ?? 0) + 1)
            }
        }
        for (const [, antall] of brukt) {
            expect(antall).toBe(1)
        }
    })
})
