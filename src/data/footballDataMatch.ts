import { Match, MatchStatus } from '../types/types'

interface ScoreValue {
    home: number | null
    away: number | null
}

export interface FootballDataScore {
    winner: string | null
    duration: string | null
    fullTime: ScoreValue
    halfTime: ScoreValue
    extraTime: ScoreValue | null
    penalties: ScoreValue | null
}

// Rå kamp slik football-data.org v4 leverer den (feltene vi bruker).
export interface FootballDataMatch {
    id: number
    utcDate: string
    status: string
    stage: string
    group: string | null
    matchday: number | null
    homeTeam: { tla: string | null }
    awayTeam: { tla: string | null }
    score: FootballDataScore
}

// football-data bruker URY for Uruguay; resten av appen (landNorsk/landFransk/
// landFlagg) bruker URU. Normaliser her så lag-oppslag treffer.
export function normaliserTla(tla: string | null): string {
    if (!tla) return ''
    return tla === 'URY' ? 'URU' : tla
}

// Runde-modellen i appen: gruppespill 1–3 (hvert lags kampdag), så sluttspill
// 4–9. football-data har per-gruppe matchday 1/2/3 i gruppespillet.
export function stageTilRunde(stage: string, matchday: number | null): number {
    switch (stage) {
        case 'GROUP_STAGE':
            return matchday ?? 1
        case 'LAST_32':
            return 4
        case 'LAST_16':
            return 5
        case 'QUARTER_FINALS':
            return 6
        case 'SEMI_FINALS':
            return 7
        case 'THIRD_PLACE':
            return 8
        case 'FINAL':
            return 9
        default:
            return 1
    }
}

export function gruppeTilTekst(group: string | null): string | undefined {
    if (!group) return undefined
    // football-data bruker "GROUP_A" på matches-endepunktet, men "Group A" på
    // standings-endepunktet. Normaliser begge til "Group A".
    const bokstav = group.replace(/^group[_ ]/i, '').trim()
    return `Group ${bokstav}`
}

const KJENTE_STATUSER: MatchStatus[] = [
    'SCHEDULED',
    'TIMED',
    'IN_PLAY',
    'PAUSED',
    'FINISHED',
    'SUSPENDED',
    'POSTPONED',
    'CANCELLED',
    'AWARDED',
]

// Faller tilbake til TIMED hvis football-data sender en ukjent/ny statusverdi,
// så vi aldri lagrer noe utenfor MatchStatus.
export function normaliserStatus(status: string | null): MatchStatus {
    if (status && (KJENTE_STATUSER as string[]).includes(status)) {
        return status as MatchStatus
    }
    return 'TIMED'
}

// Sluttspill-lag er ukjent (null) til de er avgjort — da blir home_team/away_team
// tom streng, og scoreadmin setter ekte lag via override.
export function transformerKamp(raw: FootballDataMatch): Match {
    return {
        match_num: raw.id,
        round: stageTilRunde(raw.stage, raw.matchday),
        home_team: normaliserTla(raw.homeTeam?.tla ?? null),
        away_team: normaliserTla(raw.awayTeam?.tla ?? null),
        game_start: raw.utcDate,
        home_score: null,
        away_score: null,
        group: gruppeTilTekst(raw.group),
        status: normaliserStatus(raw.status),
    }
}
