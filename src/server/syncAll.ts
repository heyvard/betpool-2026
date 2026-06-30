import { PoolClient } from 'pg'

import { FootballDataMatch } from '../data/footballDataMatch'
import { syncMatches, SyncResultat } from './syncMatches'
import { syncScores, SyncScoresResultat } from './syncScores'
import { fyrAiMorgenrapportVedNattslutt } from './feed/morgenrapportAi'

// Etter en score-synk: fyr morgenrapporten dersom nattens siste kamp dermed ble
// ferdig. Vi poster ikke lenger en feed-post per kamp — morgenrapporten dekker
// kampene samlet. Aldri en blokkering for synken — feilet feed-generering skal
// ikke velte score-oppdateringen.
export async function genererFeedTrygt(client: PoolClient, nyligFerdige: number[]): Promise<void> {
    if (nyligFerdige.length === 0) return
    try {
        const rapporter = await fyrAiMorgenrapportVedNattslutt(client, nyligFerdige)
        if (rapporter.length > 0) console.log(`[feed] postet morgenrapport for ${rapporter.join(', ')}`)
    } catch (e) {
        console.error('[feed] kunne ikke generere feed-poster', e)
    }
}

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
    await genererFeedTrygt(client, scoresResultat.nyligFerdige)

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
    await genererFeedTrygt(client, scoresResultat.nyligFerdige)

    return { hentet: kamper.length, kamper: matchResultat, scores: scoresResultat }
}
