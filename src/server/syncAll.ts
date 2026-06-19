import { PoolClient } from 'pg'

import { FootballDataMatch } from '../data/footballDataMatch'
import { LIVE_SYNC_INTERVAL_SEKUNDER } from '../utils/liveSync'
import { syncMatches, SyncResultat } from './syncMatches'
import { syncScores, SyncScoresResultat } from './syncScores'

const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION = 'WC'
const SEASON = '2026'

export async function hentKamperFraApi(): Promise<FootballDataMatch[]> {
    const token = process.env.FOOTBALL_DATA_TOKEN
    if (!token) throw new Error('Mangler FOOTBALL_DATA_TOKEN')
    const url = `${BASE_URL}/competitions/${COMPETITION}/matches?season=${SEASON}`
    const res = await fetch(url, { headers: { 'X-Auth-Token': token } })
    if (!res.ok) {
        const body = await res.text()
        throw new Error(`football-data.org svarte ${res.status}: ${body}`)
    }
    const body = (await res.json()) as { matches: FootballDataMatch[] }
    return body.matches ?? []
}

export interface SyncAllResultat {
    hentet: number
    kamper: SyncResultat
    scores: SyncScoresResultat
}

// Én API-kall mot football-data.org; delegerer deretter til syncMatches og
// syncScores med de pre-hentede dataene slik at begge operasjonene deler
// samme snapshot.
export async function syncAll(client: PoolClient): Promise<SyncAllResultat> {
    const kamper = await hentKamperFraApi()

    const matchResultat = await syncMatches(client, false, kamper)
    const scoresResultat = await syncScores(client, false, kamper)

    return { hentet: kamper.length, kamper: matchResultat, scores: scoresResultat }
}

export interface SyncLiveResultat {
    hentet: number
    kamper: SyncResultat
    scores: SyncScoresResultat
}

// Lettvekts-synk for den hyppige live-stien: ÉT football-data-kall som dekker
// både kampoppsett og scores. (Gruppetabellene hentes separat og rett gjennom
// av /api/v1/standings, ikke her.)
export async function syncLive(client: PoolClient): Promise<SyncLiveResultat> {
    const kamper = await hentKamperFraApi()

    const matchResultat = await syncMatches(client, false, kamper)
    const scoresResultat = await syncScores(client, false, kamper)

    return { hentet: kamper.length, kamper: matchResultat, scores: scoresResultat }
}

// Klient-trigget live-synk: pollere (/api/v1/matches og /api/v1/bets) henter
// dette hvert 15s mens appen er oppe. Vi "claimer" et synk-slot atomisk via den
// delte sync_state-raden slik at football-data.org treffes maks én gang per
// LIVE_SYNC_INTERVAL_SEKUNDER-vindu globalt — uavhengig av antall klienter,
// endepunkter og serverless-instanser. Kun forespørselen som vinner UPDATE-en
// synker; resten leser bare fersk DB-data.
export async function maybeSyncLive(client: PoolClient): Promise<void> {
    try {
        const claim = await client.query(
            `UPDATE sync_state SET live_synced_at = now()
             WHERE id = 'live'
               AND live_synced_at < now() - ($1 * interval '1 second')
             RETURNING live_synced_at`,
            [LIVE_SYNC_INTERVAL_SEKUNDER],
        )
        if (claim.rowCount === 1) {
            await syncLive(client)
        }
    } catch (e) {
        // Ikke la en synk-feil velte klient-kallet — vi returnerer DB-data uansett.
        console.error('live-synk feilet', e)
    }
}
