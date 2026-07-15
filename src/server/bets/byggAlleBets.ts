import { NextApiRequest } from 'next'
import { PoolClient } from 'pg'

import { erIFørsteRunde } from '../../utils/isInFirstRound'
import { serverNå } from '../../utils/testClock'
import { hentKamper, erKampPågående } from '../../data/matches'
import { resolveActiveScore } from '../../data/matchScore'
import { hentTurneringsFasit, TurneringsFasit } from '../../data/tournamentResult'

interface BetRow {
    user_id: string
    match_num: number
    home_score: string | null
    away_score: string | null
    joker: boolean
}

interface ScoreRow {
    match_num: number
    home_score: number | null
    away_score: number | null
    home_team_override: string | null
    away_team_override: string | null
    synced_home_rt: number | null
    synced_away_rt: number | null
    synced_home_ft: number | null
    synced_away_ft: number | null
    synced_home_et: number | null
    synced_away_et: number | null
    synced_home_pen: number | null
    synced_away_pen: number | null
    synced_duration: string | null
    synced_winner: string | null
    use_manual: boolean
}

export interface BetsUser {
    id: string
    name: string
    paid: boolean
    picture: string
    winner?: string
    topscorer?: string
    topscorer_player_id?: number | null
    topscorer_player_name?: string | null
    topscorer_forrige_player_name?: string | null
    winner_endret: boolean
    topscorer_endret: boolean
    winner_forrige?: string
    topscorer_forrige?: string
    i_hovedliga: boolean
}

export interface SluttspillResultat {
    avgjortPa: 'ekstraomganger' | 'straffer'
    vinner: 'home' | 'away'
    etter120: [number, number] // rt + et per lag (stillingen etter 120 min)
    straffer: [number, number] | null // kun ved straffesparkkonkurranse
}

export interface BetsRad {
    user_id: string
    match_num: number
    game_start: string
    home_team: string
    away_team: string
    round: number
    home_score: string | null
    away_score: string | null
    home_result: number | null
    away_result: number | null
    joker: boolean
    foreløpig: boolean
    sluttspill: SluttspillResultat | null
}

// Bygger sluttspill-info (ekstraomganger/straffer + hvem som gikk videre) for
// visning. Returnerer null for gruppespill og kamper avgjort innen 90' — kun
// rent presentasjon, ordinær tid er fortsatt det eneste som scores.
function byggSluttspill(score: ScoreRow | undefined): SluttspillResultat | null {
    if (!score) return null
    const d = score.synced_duration
    if (d !== 'EXTRA_TIME' && d !== 'PENALTY_SHOOTOUT') return null
    if (score.synced_home_rt == null || score.synced_away_rt == null) return null
    const vinner = score.synced_winner === 'HOME_TEAM' ? 'home' : score.synced_winner === 'AWAY_TEAM' ? 'away' : null
    if (!vinner) return null // uavgjort skal ikke skje i sluttspill; vær trygg
    const etter120: [number, number] = [
        score.synced_home_rt + (score.synced_home_et ?? 0),
        score.synced_away_rt + (score.synced_away_et ?? 0),
    ]
    const straffer: [number, number] | null =
        d === 'PENALTY_SHOOTOUT' && score.synced_home_pen != null && score.synced_away_pen != null
            ? [score.synced_home_pen, score.synced_away_pen]
            : null
    return { avgjortPa: d === 'PENALTY_SHOOTOUT' ? 'straffer' : 'ekstraomganger', vinner, etter120, straffer }
}

export interface AlleBets {
    bets: BetsRad[]
    users: BetsUser[]
    tournamentResult: TurneringsFasit
}

export interface ByggAlleBetsOpts {
    // Når true (default): winner/topscorer-tips maskeres mens vi er i første runde
    // (`erIFørsteRunde`), slik /api/v1/bets gjør for vanlige brukere. Admin-flater
    // sender false for å få ekte data.
    skjulFørsteRundePicks?: boolean
}

// Bygger hele bet-settet (alle aktive brukeres tips for kamper som har startet)
// sammen med brukerlista — rådataene som ledertavla beregnes fra. Delt mellom
// /api/v1/bets og admin-eksporten.
export async function byggAlleBets(
    client: PoolClient,
    req: NextApiRequest,
    opts: ByggAlleBetsOpts = {},
): Promise<AlleBets> {
    const { skjulFørsteRundePicks = true } = opts

    const [betRows, scoreRows, userRows, tournamentResult] = await Promise.all([
        client.query<BetRow>(`
            SELECT b.user_id, b.match_num, b.home_score, b.away_score, b.joker
            FROM bets b
            JOIN users u ON u.id = b.user_id
            WHERE u.active = true`),
        client.query<ScoreRow>(`
            SELECT match_num, home_score, away_score, home_team_override, away_team_override,
                   synced_home_rt, synced_away_rt, synced_home_ft, synced_away_ft,
                   synced_home_et, synced_away_et, synced_home_pen, synced_away_pen,
                   synced_duration, synced_winner,
                   use_manual
            FROM match_scores`),
        client.query<BetsUser>(`
            SELECT u.id, COALESCE(NULLIF(u.kallenavn, ''), u.name) AS name, u.paid, u.picture, u.winner, u.topscorer,
                   u.topscorer_player_id, p.name AS topscorer_player_name, pf.name AS topscorer_forrige_player_name,
                   u.winner_endret, u.topscorer_endret, u.winner_forrige, u.topscorer_forrige, u.i_hovedliga
            FROM users u
            LEFT JOIN players p ON p.id = u.topscorer_player_id
            LEFT JOIN players pf ON pf.id = u.topscorer_forrige_player_id
            WHERE u.active = true`),
        hentTurneringsFasit(client),
    ])

    const matchList = await hentKamper(client)
    const scoreMap = new Map<number, ScoreRow>(scoreRows.rows.map((s) => [s.match_num, s]))
    const now = serverNå(req)

    const bets = betRows.rows
        .map((b): BetsRad | null => {
            const jsonMatch = matchList.find((m) => m.match_num === b.match_num)
            if (!jsonMatch) return null
            if (new Date(jsonMatch.game_start) >= now) return null
            const score = scoreMap.get(b.match_num)
            const resultat = score ? resolveActiveScore(score) : { home_score: null, away_score: null }
            // Mens kampen pågår er poengene foreløpige (live) — uavhengig av om
            // resultatet er synket fra football-data.org, satt manuelt av en
            // scoreadmin, eller ikke satt ennå (typisk TIMED → 0-0). Først når
            // kampen er ferdig (FINISHED/AWARDED) regnes poengene som endelige.
            const foreløpig = erKampPågående(jsonMatch.status)
            const homeResult = resultat.home_score ?? (foreløpig ? 0 : null)
            const awayResult = resultat.away_score ?? (foreløpig ? 0 : null)
            return {
                user_id: b.user_id,
                match_num: b.match_num,
                game_start: jsonMatch.game_start,
                home_team: score?.home_team_override ?? jsonMatch.home_team,
                away_team: score?.away_team_override ?? jsonMatch.away_team,
                round: jsonMatch.round,
                home_score: b.home_score,
                away_score: b.away_score,
                home_result: homeResult,
                away_result: awayResult,
                joker: b.joker,
                foreløpig,
                sluttspill: byggSluttspill(score),
            }
        })
        .filter((b): b is BetsRad => b !== null)

    const userList = userRows.rows
    if (skjulFørsteRundePicks && (await erIFørsteRunde(client, req))) {
        userList.forEach((u) => {
            delete u.winner
            delete u.topscorer
            delete u.topscorer_player_id
            delete u.topscorer_player_name
            delete u.topscorer_forrige_player_name
            delete u.winner_forrige
            delete u.topscorer_forrige
        })
    }

    return { bets, users: userList, tournamentResult }
}
