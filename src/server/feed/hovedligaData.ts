import { PoolClient } from 'pg'

import { AllBets, MatchBet, OtherUser } from '../../queries/useAllBets'
import { AllBetsExtended, calculateAllBetsExtended } from '../../components/results/calculateAllBetsExtended'
import { calculateLeaderboard, LeaderBoard } from '../../components/results/calculateAllScores'
import { MatchPoeng, regnUtScoreForKamp } from '../../components/results/matchScoreCalculator'
import { erKampPågående, hentKamper } from '../../data/matches'
import { resolveActiveScore } from '../../data/matchScore'

// Bygger hovedligaens (Æresligaen) AllBets fra DB — kun brukere som er med i
// hovedligaen (i_hovedliga != false) og deres tips på kamper som har startet.
// Speiler lese-laget i /api/v1/bets, men beregner aldri poeng på nytt selv: det
// overlates uendret til calculateAllBetsExtended / calculateLeaderboard.
//
// Vi tar med winner/topscorer-tipp her (i motsetning til bets-API-et som skjuler
// dem i første runde) fordi dette kun brukes server-side til poengberegning — det
// eksponeres aldri til andre brukere.

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
    synced_home_ft: number | null
    synced_away_ft: number | null
    use_manual: boolean
}

interface UserRow {
    id: string
    name: string
    paid: boolean
    picture: string | null
    winner: string | null
    topscorer_player_id: number | null
    winner_endret: boolean
    topscorer_endret: boolean
}

export interface HovedligaData {
    allBets: AllBets
    extended: AllBetsExtended
    leaderboard: LeaderBoard[]
    // Poeng per kamp (alle kamper med tips) — gjenbruk av matchScoreCalculator.
    scoreForKamp: Map<string, MatchPoeng>
}

export async function hentHovedligaAllBets(client: PoolClient, now: Date = new Date()): Promise<AllBets> {
    const [betRows, scoreRows, userRows] = await Promise.all([
        client.query<BetRow>(`
            SELECT b.user_id, b.match_num, b.home_score, b.away_score, b.joker
            FROM bets b
            JOIN users u ON u.id = b.user_id
            WHERE u.active = true AND u.i_hovedliga = true`),
        client.query<ScoreRow>(`
            SELECT match_num, home_score, away_score, home_team_override, away_team_override,
                   synced_home_ft, synced_away_ft, use_manual
            FROM match_scores`),
        client.query<UserRow>(`
            SELECT u.id, COALESCE(NULLIF(u.kallenavn, ''), u.name) AS name, u.paid, u.picture,
                   u.winner, u.topscorer_player_id, u.winner_endret, u.topscorer_endret
            FROM users u
            WHERE u.active = true AND u.i_hovedliga = true`),
    ])

    const matchList = await hentKamper(client)
    const scoreMap = new Map<number, ScoreRow>(scoreRows.rows.map((s) => [s.match_num, s]))

    const bets: MatchBet[] = betRows.rows
        .map((b): MatchBet | null => {
            const kamp = matchList.find((m) => m.match_num === b.match_num)
            if (!kamp) return null
            if (new Date(kamp.game_start) >= now) return null
            const score = scoreMap.get(b.match_num)
            const resultat = score ? resolveActiveScore(score) : { home_score: null, away_score: null }
            const foreløpig = erKampPågående(kamp.status)
            const homeResult = resultat.home_score ?? (foreløpig ? 0 : null)
            const awayResult = resultat.away_score ?? (foreløpig ? 0 : null)
            return {
                user_id: b.user_id,
                match_num: b.match_num,
                game_start: kamp.game_start,
                home_team: score?.home_team_override ?? kamp.home_team,
                away_team: score?.away_team_override ?? kamp.away_team,
                round: kamp.round,
                home_score: b.home_score,
                away_score: b.away_score,
                home_result: homeResult === null ? null : String(homeResult),
                away_result: awayResult === null ? null : String(awayResult),
                joker: b.joker,
                foreløpig,
            }
        })
        .filter((b): b is MatchBet => b !== null)

    const users: OtherUser[] = userRows.rows.map((u) => ({
        id: u.id,
        name: u.name,
        picture: u.picture,
        paid: u.paid,
        winner: u.winner ?? undefined,
        topscorer_player_id: u.topscorer_player_id,
        winner_endret: u.winner_endret,
        topscorer_endret: u.topscorer_endret,
        i_hovedliga: true,
    }))

    return { users, bets }
}

// Henter alt feeden trenger om hovedligaens stilling: rå-bets, utvidet beregning
// (poeng per tips + bonus) og den sorterte tabellen.
export async function hentHovedligaData(client: PoolClient, now: Date = new Date()): Promise<HovedligaData> {
    const allBets = await hentHovedligaAllBets(client, now)
    const extended = calculateAllBetsExtended(allBets)
    const leaderboard = calculateLeaderboard(extended.bets, extended.users)
    const scoreForKamp = regnUtScoreForKamp(allBets.bets)
    return { allBets, extended, leaderboard, scoreForKamp }
}

// Sorterer tabellen synkende på poeng, med stabil userid-tiebreak (samme som
// ledertavla bruker når poengene er like).
export function sorterTabell(rows: LeaderBoard[]): LeaderBoard[] {
    return [...rows].sort((a, b) => {
        if (b.poeng === a.poeng) return a.userid.localeCompare(b.userid)
        return b.poeng - a.poeng
    })
}
