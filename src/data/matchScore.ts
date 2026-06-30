// Felles oppslag for «aktiv» score på en kamp. En kamp kan ha både en manuelt
// satt score (home_score/away_score, satt av scoreadmin) og en automatisk synket
// score fra football-data.org (synced_*). `use_manual`-bryteren avgjør hvilken
// som er aktiv; uten synket score faller vi tilbake til den manuelle.
export interface AktivScoreRad {
    home_score: number | null
    away_score: number | null
    synced_home_rt: number | null
    synced_away_rt: number | null
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
    // Sluttspill: stillingen etter ordinær tid (90 min) er tippe-resultatet —
    // ekstraomganger og straffer teller ikke. football-data setter `regularTime`
    // bare for kamper som gikk forbi 90 min; da er `fullTime` totalen (inkl.
    // ekstraomganger/straffer), som vi IKKE skal bruke. (Løs null-sjekk så et
    // utelatt felt — undefined — behandles likt som null.)
    if (score.synced_home_rt != null && score.synced_away_rt != null) {
        return { home_score: score.synced_home_rt, away_score: score.synced_away_rt }
    }
    // Kamp avgjort innen 90 min (gruppespill, eller sluttspill uten ekstraomganger):
    // da er fulltidsresultatet selve 90-minutters-resultatet.
    if (score.synced_home_ft != null && score.synced_away_ft != null) {
        return { home_score: score.synced_home_ft, away_score: score.synced_away_ft }
    }
    // Fallback til manuell om ingen synket score finnes ennå
    return { home_score: score.home_score, away_score: score.away_score }
}
