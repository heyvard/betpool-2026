import { osloDato, osloGårsdagDato, osloTime } from './tid'

describe('tid – Europe/Oslo', () => {
    it('osloDato gir ISO-dato i norsk tid', () => {
        // 2026-06-20 00:30 UTC er fortsatt 20. juni i Oslo (sommertid, +2).
        expect(osloDato(new Date('2026-06-20T00:30:00Z'))).toBe('2026-06-20')
        // 2026-06-19 23:30 UTC er allerede 20. juni 01:30 i Oslo.
        expect(osloDato(new Date('2026-06-19T23:30:00Z'))).toBe('2026-06-20')
    })

    it('osloTime gir timen i norsk tid', () => {
        // 06:00 UTC = 08:00 Oslo om sommeren.
        expect(osloTime(new Date('2026-06-20T06:00:00Z'))).toBe(8)
        // 07:00 UTC = 08:00 Oslo om vinteren.
        expect(osloTime(new Date('2026-01-20T07:00:00Z'))).toBe(8)
    })

    it('osloGårsdagDato trekker fra ett døgn i norsk tid', () => {
        expect(osloGårsdagDato(new Date('2026-06-20T06:00:00Z'))).toBe('2026-06-19')
    })
})
