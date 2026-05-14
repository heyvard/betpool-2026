import dayjs from 'dayjs'

import { erTestAuth } from './erTestAuth'

// Overstyrbar «nå» for testappen. Drevet av en cookie — samme mønster som
// `betpool_test_user` — så samme verdi gjelder både i nettleseren og når
// /api/v1/*-handlerne leser request-cookien. Tom cookie = ekte tid.
// Utenfor test-auth-modus gjør disse ingenting; produksjon er upåvirket.
export const TEST_CLOCK_COOKIE = 'betpool_test_clock'

function lesKlokkeCookie(): string | undefined {
    if (typeof document === 'undefined') return undefined
    const m = document.cookie.match(/(?:^|;\s*)betpool_test_clock=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : undefined
}

// Klient: gjeldende «nå» som dayjs.
export function nå(): dayjs.Dayjs {
    if (erTestAuth()) {
        const overstyrt = lesKlokkeCookie()
        if (overstyrt) return dayjs(overstyrt)
    }
    return dayjs()
}

// Server: gjeldende «nå» som Date, lest fra request-cookien.
export function serverNå(req: { cookies: Partial<Record<string, string>> }): Date {
    if (erTestAuth()) {
        const overstyrt = req.cookies[TEST_CLOCK_COOKIE]
        if (overstyrt) return new Date(overstyrt)
    }
    return new Date()
}

export function setKlokke(iso: string): void {
    document.cookie = `${TEST_CLOCK_COOKIE}=${encodeURIComponent(iso)}; path=/; max-age=31536000`
}

export function nullstillKlokke(): void {
    document.cookie = `${TEST_CLOCK_COOKIE}=; path=/; max-age=0`
}
