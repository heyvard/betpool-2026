import { PoolClient } from 'pg'
import { FootballDataMatch } from '../data/footballDataMatch'

const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION = 'WC'
const SEASON = '2026'
const SEKS_TIMER_MS = 6 * 60 * 60 * 1000

export interface SyncScoresResultat {
    hentet: number
    oppdatert: number
    // Match-num-ene til kamper som er FERDIGE (FINISHED/AWARDED) og ble synket i
    // denne kjøringen. Feed-generatoren bruker dette til å lage poster kun for
    // ferdige kamper — aldri midt i en kamp, og aldri en sweep av hele historikken
    // (bare kamper som fortsatt er «relevante», dvs. nylig ferdige / mangler score).
    nyligFerdige: number[]
}

export interface DryRunScoreKamp {
    match_num: number
    status: string
    home_team: string | null
    away_team: string | null
    relevant: boolean
    api: {
        fullTime: { home: number | null; away: number | null }
        regularTime: { home: number | null; away: number | null } | null
        extraTime: { home: number | null; away: number | null } | null
        penalties: { home: number | null; away: number | null } | null
        duration: string | null
        winner: string | null
    }
    db: {
        use_manual: boolean
        synced_home_ft: number | null
        synced_away_ft: number | null
        synced_home_rt: number | null
        synced_away_rt: number | null
        synced_home_et: number | null
        synced_away_et: number | null
        synced_home_pen: number | null
        synced_away_pen: number | null
        synced_duration: string | null
        synced_winner: string | null
        score_synced_at: string | null
    } | null
    villeBlittOppdatert: boolean
}

export interface DryRunSyncScoresResultat {
    hentet: number
    relevante: number
    oppdatert: number
    dryRun: true
    kamper: DryRunScoreKamp[]
}

interface FootballDataScoreResponse {
    matches: FootballDataMatch[]
}

// Henter scores for pågående kamper og kamper ferdig de siste 6 timene fra
// football-data.org og upserter synced_*-kolonner i match_scores.
// Rører aldri home_score/away_score (manuell) eller use_manual (admin-switch).
// Med dryRun=true gjøres ingen DB-skriving; returnerer rådata fra API + nåværende DB-tilstand.
export async function syncScores(
    client: PoolClient,
    dryRun?: false,
    prefetched?: FootballDataMatch[],
): Promise<SyncScoresResultat>
export async function syncScores(
    client: PoolClient,
    dryRun: true,
    prefetched?: FootballDataMatch[],
): Promise<DryRunSyncScoresResultat>
export async function syncScores(
    client: PoolClient,
    dryRun = false,
    prefetched?: FootballDataMatch[],
): Promise<SyncScoresResultat | DryRunSyncScoresResultat> {
    console.log(`[sync-scores] starter${dryRun ? ' (dry run)' : ''}`)

    let alleKamper: FootballDataMatch[]
    if (prefetched) {
        alleKamper = prefetched
    } else {
        const token = process.env.FOOTBALL_DATA_TOKEN
        if (!token) throw new Error('Mangler FOOTBALL_DATA_TOKEN')
        const url =
            `${BASE_URL}/competitions/${COMPETITION}/matches` +
            `?season=${SEASON}&status=IN_PLAY,PAUSED,FINISHED,TIMED,SCHEDULED`
        console.log(`[sync-scores] henter fra football-data.org (${COMPETITION} ${SEASON})`)
        const res = await fetch(url, { headers: { 'X-Auth-Token': token } })
        if (!res.ok) {
            const body = await res.text()
            throw new Error(`football-data.org svarte ${res.status}: ${body}`)
        }
        const body = (await res.json()) as FootballDataScoreResponse
        alleKamper = body.matches ?? []
    }

    const now = Date.now()

    // Hent gjeldende DB-tilstand for kampene API-et kjenner til. Brukes både til
    // catch-up (se erRelevant) og til dry-run-rapporten.
    const matchNums = alleKamper.map((m) => m.id)
    const dbRes = await client.query<{
        match_num: number
        use_manual: boolean
        synced_home_ft: number | null
        synced_away_ft: number | null
        synced_home_rt: number | null
        synced_away_rt: number | null
        synced_home_et: number | null
        synced_away_et: number | null
        synced_home_pen: number | null
        synced_away_pen: number | null
        synced_duration: string | null
        synced_winner: string | null
        score_synced_at: string | null
        home_team: string | null
        away_team: string | null
    }>(
        `SELECT ms.match_num,
                ms.use_manual,
                ms.synced_home_ft, ms.synced_away_ft,
                ms.synced_home_rt, ms.synced_away_rt,
                ms.synced_home_et, ms.synced_away_et,
                ms.synced_home_pen, ms.synced_away_pen,
                ms.synced_duration,
                ms.synced_winner,
                ms.score_synced_at::text,
                m.home_team, m.away_team
         FROM matches m
         LEFT JOIN match_scores ms ON ms.match_num = m.match_num
         WHERE m.match_num = ANY($1)`,
        [matchNums],
    )
    const dbMap = new Map((dbRes?.rows ?? []).map((r) => [r.match_num, r]))

    // En kamp mangler synket score hvis det ikke finnes en match_scores-rad, eller
    // fulltidsresultatet ikke er satt ennå.
    const manglerSynketScore = (m: FootballDataMatch) => {
        const r = dbMap.get(m.id)
        return !r || r.synced_home_ft === null || r.synced_away_ft === null
    }

    // Catch-up for sluttspilldata: kamper som ble synket FØR vi begynte å lagre
    // ordinær tid / vinner har fulltid, men mangler `synced_home_rt`/`synced_winner`.
    // Hvis API-et sier kampen gikk forbi ordinær tid (ekstraomganger/straffer) og
    // DB-raden mangler de feltene, gjør vi den relevant slik at den re-synkes én gang.
    // Etter at feltene er fylt slår dette ikke til igjen. Gruppespill (REGULAR) røres
    // aldri.
    const manglerSluttspilldata = (m: FootballDataMatch) => {
        const r = dbMap.get(m.id)
        if (!r) return false // dekkes av manglerSynketScore
        const apiHarSluttspill =
            (!!m.score?.duration && m.score.duration.toUpperCase() !== 'REGULAR') ||
            m.score?.regularTime?.home != null ||
            m.score?.penalties?.home != null
        if (!apiHarSluttspill) return false
        return r.synced_home_rt === null || r.synced_winner === null
    }

    const erRelevant = (m: FootballDataMatch) => {
        if (m.status === 'IN_PLAY' || m.status === 'PAUSED') return true
        if (m.status === 'FINISHED') {
            // Fersk: synk på nytt en stund i tilfelle korreksjoner. Eldre: catch-up
            // hvis scoren ennå ikke er synket, eller sluttspilldataene (ordinær tid /
            // vinner) mangler — da mister vi aldri en kamp selv om synken ikke kjørte
            // mens den var live / innen 6 t.
            if (now - new Date(m.utcDate).getTime() < SEKS_TIMER_MS) return true
            return manglerSynketScore(m) || manglerSluttspilldata(m)
        }
        // Kampstart har passert i klokketid, men API-status er ennå ikke oppdatert
        if (m.status === 'TIMED' || m.status === 'SCHEDULED') {
            return now >= new Date(m.utcDate).getTime()
        }
        return false
    }
    const relevante = alleKamper.filter(erRelevant)

    console.log(
        `[sync-scores] ${relevante.length} relevante kamper (IN_PLAY/PAUSED/TIMED+SCHEDULED etter start + FINISHED <6t eller uten synket score)`,
    )

    if (dryRun) {
        let oppdatertDry = 0
        const kamper: DryRunScoreKamp[] = alleKamper.map((m) => {
            const { score } = m
            const relevant = erRelevant(m)
            const dbRad = dbMap.get(m.id) ?? null

            const harFulltid = score?.fullTime.home !== null && score?.fullTime.away !== null
            const villeBlittOppdatert =
                relevant &&
                harFulltid &&
                (!dbRad ||
                    dbRad.synced_home_ft !== score.fullTime.home ||
                    dbRad.synced_away_ft !== score.fullTime.away ||
                    (dbRad.synced_home_rt ?? null) !== (score.regularTime?.home ?? null) ||
                    (dbRad.synced_away_rt ?? null) !== (score.regularTime?.away ?? null) ||
                    (dbRad.synced_home_et ?? null) !== (score.extraTime?.home ?? null) ||
                    (dbRad.synced_away_et ?? null) !== (score.extraTime?.away ?? null) ||
                    (dbRad.synced_home_pen ?? null) !== (score.penalties?.home ?? null) ||
                    (dbRad.synced_away_pen ?? null) !== (score.penalties?.away ?? null) ||
                    (dbRad.synced_duration ?? null) !== (score.duration ?? null) ||
                    (dbRad.synced_winner ?? null) !== (score.winner ?? null))

            if (villeBlittOppdatert) oppdatertDry++

            return {
                match_num: m.id,
                status: m.status,
                home_team: dbRad?.home_team ?? null,
                away_team: dbRad?.away_team ?? null,
                relevant,
                api: {
                    fullTime: score?.fullTime ?? { home: null, away: null },
                    regularTime: score?.regularTime ?? null,
                    extraTime: score?.extraTime ?? null,
                    penalties: score?.penalties ?? null,
                    duration: score?.duration ?? null,
                    winner: score?.winner ?? null,
                },
                db: dbRad
                    ? {
                          use_manual: dbRad.use_manual,
                          synced_home_ft: dbRad.synced_home_ft,
                          synced_away_ft: dbRad.synced_away_ft,
                          synced_home_rt: dbRad.synced_home_rt,
                          synced_away_rt: dbRad.synced_away_rt,
                          synced_home_et: dbRad.synced_home_et,
                          synced_away_et: dbRad.synced_away_et,
                          synced_home_pen: dbRad.synced_home_pen,
                          synced_away_pen: dbRad.synced_away_pen,
                          synced_duration: dbRad.synced_duration,
                          synced_winner: dbRad.synced_winner,
                          score_synced_at: dbRad.score_synced_at,
                      }
                    : null,
                villeBlittOppdatert,
            }
        })

        const resultat: DryRunSyncScoresResultat = {
            hentet: alleKamper.length,
            relevante: relevante.length,
            oppdatert: oppdatertDry,
            dryRun: true,
            kamper,
        }
        console.log(`[sync-scores] dry run ferdig — ${oppdatertDry} ville blitt oppdatert`)
        return resultat
    }

    let oppdatert = 0
    const nyligFerdige: number[] = []
    for (const m of relevante) {
        const { score } = m
        if (!score) continue
        if (score.fullTime.home === null || score.fullTime.away === null) continue

        // En kamp er FERDIG først når football-data melder FINISHED/AWARDED. Et
        // synket fulltidsresultat alene betyr ikke ferdig — under spill er
        // `score.fullTime` selve live-scoren (brukes til foreløpige poeng).
        const erFerdig = m.status === 'FINISHED' || m.status === 'AWARDED'

        const result = await client.query(
            `INSERT INTO match_scores
               (match_num,
                synced_home_ft, synced_away_ft,
                synced_home_rt, synced_away_rt,
                synced_home_et, synced_away_et,
                synced_home_pen, synced_away_pen,
                synced_duration, synced_winner, score_synced_at,
                created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now(),now())
             ON CONFLICT (match_num) DO UPDATE SET
               synced_home_ft  = EXCLUDED.synced_home_ft,
               synced_away_ft  = EXCLUDED.synced_away_ft,
               synced_home_rt  = EXCLUDED.synced_home_rt,
               synced_away_rt  = EXCLUDED.synced_away_rt,
               synced_home_et  = EXCLUDED.synced_home_et,
               synced_away_et  = EXCLUDED.synced_away_et,
               synced_home_pen = EXCLUDED.synced_home_pen,
               synced_away_pen = EXCLUDED.synced_away_pen,
               synced_duration = EXCLUDED.synced_duration,
               synced_winner   = EXCLUDED.synced_winner,
               score_synced_at = now(),
               updated_at      = now()
             WHERE
               match_scores.synced_home_ft  IS DISTINCT FROM EXCLUDED.synced_home_ft
               OR match_scores.synced_away_ft  IS DISTINCT FROM EXCLUDED.synced_away_ft
               OR match_scores.synced_home_rt  IS DISTINCT FROM EXCLUDED.synced_home_rt
               OR match_scores.synced_away_rt  IS DISTINCT FROM EXCLUDED.synced_away_rt
               OR match_scores.synced_home_et  IS DISTINCT FROM EXCLUDED.synced_home_et
               OR match_scores.synced_away_et  IS DISTINCT FROM EXCLUDED.synced_away_et
               OR match_scores.synced_home_pen IS DISTINCT FROM EXCLUDED.synced_home_pen
               OR match_scores.synced_away_pen IS DISTINCT FROM EXCLUDED.synced_away_pen
               OR match_scores.synced_duration IS DISTINCT FROM EXCLUDED.synced_duration
               OR match_scores.synced_winner   IS DISTINCT FROM EXCLUDED.synced_winner`,
            [
                m.id,
                score.fullTime.home,
                score.fullTime.away,
                score.regularTime?.home ?? null,
                score.regularTime?.away ?? null,
                score.extraTime?.home ?? null,
                score.extraTime?.away ?? null,
                score.penalties?.home ?? null,
                score.penalties?.away ?? null,
                score.duration ?? null,
                score.winner ?? null,
            ],
        )
        if (result.rowCount && result.rowCount > 0) {
            oppdatert++
            console.log(
                `[sync-scores] oppdaterte kamp ${m.id}: ${score.fullTime.home}–${score.fullTime.away} (${m.status})`,
            )
        }
        // Ferdige kamper synket denne kjøringen er kandidater for feed-post.
        // genererKampposter er idempotent, så gjentatte runder i 6-timersvinduet
        // (kampen er fortsatt «relevant») lager ikke duplikater.
        if (erFerdig) nyligFerdige.push(m.id)
    }

    const resultat: SyncScoresResultat = { hentet: relevante.length, oppdatert, nyligFerdige }
    console.log('[sync-scores] ferdig —', resultat)
    return resultat
}
