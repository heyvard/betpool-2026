// Felles oppslag for «aktiv» score på en kamp. En kamp kan ha både en manuelt
// satt score (home_score/away_score, satt av scoreadmin) og en automatisk synket
// score fra football-data.org (synced_*). `use_manual`-bryteren avgjør hvilken
// som er aktiv; uten synket score faller vi tilbake til den manuelle.
export interface AktivScoreRad {
    home_score: number | null
    away_score: number | null
    synced_home_ft: number | null
    synced_away_ft: number | null
    use_manual: boolean
}

export function resolveActiveScore(score: AktivScoreRad): {
    home_score: number | null
    away_score: number | null
} {
    if (score.use_manual) {
        return { home_score: score.home_score, away_score: score.away_score }
    }
    if (score.synced_home_ft !== null && score.synced_away_ft !== null) {
        return { home_score: score.synced_home_ft, away_score: score.synced_away_ft }
    }
    // Fallback til manuell om ingen synket score finnes ennå
    return { home_score: score.home_score, away_score: score.away_score }
}
