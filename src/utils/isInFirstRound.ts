import dayjs from 'dayjs'

import { getMatches } from '../data/matches'

import { nå, serverNå } from './testClock'

// På serveren må `req` sendes med for at test-klokka skal gjelde — den bor i
// request-cookien. På klienten leses cookien direkte, så `req` kan utelates.
type CookieReq = { cookies: Partial<Record<string, string>> }

export function erIFørsteRunde(req?: CookieReq): boolean {
    const tidspunkt = req ? dayjs(serverNå(req)) : nå()
    return førsteRunde.isAfter(tidspunkt)
}

// Fristen for å endre vinner/toppscorer er starten på andre gruppespillsrunde
// (round=2 i Match-modellen, dvs. hvert lags andre gruppekamp).
function finnStartenPåAndreRunde(): dayjs.Dayjs {
    const andreRunde = getMatches()
        .filter((m) => m.round === 2)
        .map((m) => dayjs(m.game_start))
        .sort((a, b) => a.valueOf() - b.valueOf())
    if (andreRunde.length === 0) {
        throw new Error('Fant ingen kamper i andre runde')
    }
    return andreRunde[0]
}

export const førsteRunde = finnStartenPåAndreRunde()

export function erEtterFørsteRunde(req?: CookieReq): boolean {
    return !erIFørsteRunde(req)
}

// Endrevinduet: brukere kan endre vinner/toppscorer én gang etter gruppespill
// runde 1, frem til kvartfinalen starter (åpent gjennom sekstendels- og åttendedelsfinalene).
function finnStartenPåKvartfinale(): dayjs.Dayjs {
    const kvartfinale = getMatches()
        .filter((m) => m.round === 6)
        .map((m) => dayjs(m.game_start))
        .sort((a, b) => a.valueOf() - b.valueOf())
    if (kvartfinale.length === 0) {
        throw new Error('Fant ingen kamper i kvartfinalen')
    }
    return kvartfinale[0]
}

export const endrevinduSlutt = finnStartenPåKvartfinale()

export function erIEndrevindu(req?: CookieReq): boolean {
    const tidspunkt = req ? dayjs(serverNå(req)) : nå()
    return erEtterFørsteRunde(req) && endrevinduSlutt.isAfter(tidspunkt)
}
