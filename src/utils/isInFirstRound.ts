import dayjs from 'dayjs'
import { PoolClient } from 'pg'

import { serverNå } from './testClock'

// Frist-datoene utledes fra kampprogrammet i databasen:
// - førsteRunde: starten på andre gruppespillsrunde (round=2) — fristen for å
//   sette vinner/toppscorer.
// - endrevinduSlutt: starten på kvartfinalen (round=6) — endrevinduet er åpent
//   gjennom sekstendels- og åttendedelsfinalene frem til da.
// På serveren må `req` sendes med for at test-klokka skal gjelde (den bor i
// request-cookien).

async function førsteKampstartIRunde(client: PoolClient, round: number): Promise<dayjs.Dayjs> {
    const rows = (
        await client.query<{ game_start: Date }>(
            `SELECT game_start FROM matches WHERE round = $1 ORDER BY game_start ASC LIMIT 1`,
            [round],
        )
    ).rows
    if (rows.length === 0) {
        throw new Error(`Fant ingen kamper i runde ${round}`)
    }
    return dayjs(rows[0].game_start)
}

export async function hentFristDatoer(client: PoolClient): Promise<{ forsteRunde: string; endrevinduSlutt: string }> {
    const [forste, kvart] = await Promise.all([førsteKampstartIRunde(client, 2), førsteKampstartIRunde(client, 6)])
    return { forsteRunde: forste.toISOString(), endrevinduSlutt: kvart.toISOString() }
}

export async function erIFørsteRunde(
    client: PoolClient,
    req: { cookies: Partial<Record<string, string>> },
): Promise<boolean> {
    const forste = await førsteKampstartIRunde(client, 2)
    return forste.isAfter(dayjs(serverNå(req)))
}

export async function erIEndrevindu(
    client: PoolClient,
    req: { cookies: Partial<Record<string, string>> },
): Promise<boolean> {
    const tidspunkt = dayjs(serverNå(req))
    const [forste, kvart] = await Promise.all([førsteKampstartIRunde(client, 2), førsteKampstartIRunde(client, 6)])
    return !forste.isAfter(tidspunkt) && kvart.isAfter(tidspunkt)
}
