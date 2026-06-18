import dayjs from 'dayjs'
import { PoolClient } from 'pg'

import { serverNå } from './testClock'
import { ENDREVINDU_AKTIVERT } from './fristDatoer'

// Frist-datoene utledes fra kampprogrammet i databasen:
// - forsteRunde: starten på andre gruppespillsrunde (round=2) — fristen for å
//   sette vinner/toppscorer.
// - endrevinduSlutt: starten på kvartfinalen (round=6) — endrevinduet er åpent
//   gjennom sekstendels- og åttendedelsfinalene frem til da.
// På serveren må `req` sendes med for at test-klokka skal gjelde (den bor i
// request-cookien).

type CookieReq = { cookies: Partial<Record<string, string>> }

export interface Frister {
    forsteRunde: dayjs.Dayjs
    endrevinduSlutt: dayjs.Dayjs
}

// Henter begge fristene i ett spørsmål.
export async function hentFrister(client: PoolClient): Promise<Frister> {
    const rows = (
        await client.query<{ round: number; first: Date }>(
            `SELECT round, MIN(game_start) AS first FROM matches WHERE round IN (2, 6) GROUP BY round`,
        )
    ).rows
    const forste = rows.find((r) => r.round === 2)?.first
    const kvart = rows.find((r) => r.round === 6)?.first
    if (!forste || !kvart) {
        throw new Error('Fant ikke frist-kampene (runde 2 og 6)')
    }
    return { forsteRunde: dayjs(forste), endrevinduSlutt: dayjs(kvart) }
}

export function erIFørsteRundeMed(frister: Frister, req: CookieReq): boolean {
    return frister.forsteRunde.isAfter(dayjs(serverNå(req)))
}

export function erIEndrevinduMed(frister: Frister, req: CookieReq): boolean {
    // Midlertidig avslått — se ENDREVINDU_AKTIVERT i fristDatoer.ts.
    if (!ENDREVINDU_AKTIVERT) return false
    const tidspunkt = dayjs(serverNå(req))
    return !frister.forsteRunde.isAfter(tidspunkt) && frister.endrevinduSlutt.isAfter(tidspunkt)
}

export async function erIFørsteRunde(client: PoolClient, req: CookieReq): Promise<boolean> {
    return erIFørsteRundeMed(await hentFrister(client), req)
}
