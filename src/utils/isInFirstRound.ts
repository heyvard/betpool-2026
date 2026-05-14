import dayjs from 'dayjs'

import { nå, serverNå } from './testClock'

// På serveren må `req` sendes med for at test-klokka skal gjelde — den bor i
// request-cookien. På klienten leses cookien direkte, så `req` kan utelates.
type CookieReq = { cookies: Partial<Record<string, string>> }

export function erIFørsteRunde(req?: CookieReq): boolean {
    const tidspunkt = req ? dayjs(serverNå(req)) : nå()
    return førsteRunde.isAfter(tidspunkt)
}

export const førsteRunde = dayjs('2026-06-26T00:00:00.000Z')

export function erEtterFørsteRunde(req?: CookieReq): boolean {
    return !erIFørsteRunde(req)
}
