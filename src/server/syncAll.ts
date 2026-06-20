import { PoolClient } from 'pg'

import { FootballDataMatch } from '../data/footballDataMatch'
import { syncMatches, SyncResultat } from './syncMatches'
import { syncScores, SyncScoresResultat } from './syncScores'
import { genererKampposter } from './feed/genererKamppost'

// Genererer feed-kampposter for nylig ferdige kamper. Aldri en blokkering for
// synken — feilet feed-generering skal ikke velte score-oppdateringen.
async function genererFeedTrygt(client: PoolClient): Promise<void> {
    try {
        const res = await genererKampposter(client)
        if (res.postet > 0) console.log(`[feed] postet ${res.postet} kamppost(er)`)
    } catch (e) {
        console.error('[feed] kunne ikke generere kampposter', e)
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
    await genererFeedTrygt(client)

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
    await genererFeedTrygt(client)

    return { hentet: kamper.length, kamper: matchResultat, scores: scoresResultat }
}
