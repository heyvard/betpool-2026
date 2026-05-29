import { PoolClient } from 'pg'
import { FootballDataMatch } from '../data/footballDataMatch'

const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION = 'WC'
const SEASON = '2026'
const SEKS_TIMER_MS = 6 * 60 * 60 * 1000

export interface SyncScoresResultat {
    hentet: number
    oppdatert: number
}

interface FootballDataScoreResponse {
    matches: FootballDataMatch[]
}

// Henter scores for pågående kamper og kamper ferdig de siste 6 timene fra
// football-data.org og upserter synced_*-kolonner i match_scores.
// Rører aldri home_score/away_score (manuell) eller use_manual (admin-switch).
export async function syncScores(client: PoolClient): Promise<SyncScoresResultat> {
    const token = process.env.FOOTBALL_DATA_TOKEN
    if (!token) throw new Error('Mangler FOOTBALL_DATA_TOKEN')

    const url = `${BASE_URL}/competitions/${COMPETITION}/matches` + `?season=${SEASON}&status=IN_PLAY,PAUSED,FINISHED`

    const res = await fetch(url, { headers: { 'X-Auth-Token': token } })
    if (!res.ok) {
        const body = await res.text()
        throw new Error(`football-data.org svarte ${res.status}: ${body}`)
    }

    const body = (await res.json()) as FootballDataScoreResponse
    const now = Date.now()

    const relevante = (body.matches ?? []).filter((m) => {
        if (m.status === 'IN_PLAY' || m.status === 'PAUSED') return true
        if (m.status === 'FINISHED') {
            return now - new Date(m.utcDate).getTime() < SEKS_TIMER_MS
        }
        return false
    })

    let oppdatert = 0
    for (const m of relevante) {
        const { score } = m
        if (!score) continue
        if (score.fullTime.home === null || score.fullTime.away === null) continue

        const result = await client.query(
            `INSERT INTO match_scores
               (match_num,
                synced_home_ft, synced_away_ft,
                synced_home_et, synced_away_et,
                synced_home_pen, synced_away_pen,
                synced_duration, score_synced_at,
                created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now(),now())
             ON CONFLICT (match_num) DO UPDATE SET
               synced_home_ft  = EXCLUDED.synced_home_ft,
               synced_away_ft  = EXCLUDED.synced_away_ft,
               synced_home_et  = EXCLUDED.synced_home_et,
               synced_away_et  = EXCLUDED.synced_away_et,
               synced_home_pen = EXCLUDED.synced_home_pen,
               synced_away_pen = EXCLUDED.synced_away_pen,
               synced_duration = EXCLUDED.synced_duration,
               score_synced_at = now(),
               updated_at      = now()
             WHERE
               match_scores.synced_home_ft  IS DISTINCT FROM EXCLUDED.synced_home_ft
               OR match_scores.synced_away_ft  IS DISTINCT FROM EXCLUDED.synced_away_ft
               OR match_scores.synced_home_et  IS DISTINCT FROM EXCLUDED.synced_home_et
               OR match_scores.synced_away_et  IS DISTINCT FROM EXCLUDED.synced_away_et
               OR match_scores.synced_home_pen IS DISTINCT FROM EXCLUDED.synced_home_pen
               OR match_scores.synced_away_pen IS DISTINCT FROM EXCLUDED.synced_away_pen
               OR match_scores.synced_duration IS DISTINCT FROM EXCLUDED.synced_duration`,
            [
                m.id,
                score.fullTime.home,
                score.fullTime.away,
                score.extraTime?.home ?? null,
                score.extraTime?.away ?? null,
                score.penalties?.home ?? null,
                score.penalties?.away ?? null,
                score.duration ?? null,
            ],
        )
        if (result.rowCount && result.rowCount > 0) oppdatert++
    }

    return { hentet: relevante.length, oppdatert }
}
