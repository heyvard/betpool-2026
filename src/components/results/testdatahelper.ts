import { MatchBet } from '../../queries/useAllBets'

export function skapMatchBetArray(opts: {
    runde: number
    antallHeltRiktig: number
    antallRiktigUtfall: number
    antallFeil: number
}) {
    const bets: MatchBet[] = []
    let user_id = 0
    const match = {
        match_num: 1,
        home_result: '1',
        away_result: '2',
        round: opts.runde,
        game_start: 'whatever',
        home_team: 'DEN',
        away_team: 'NOR',
    }
    for (let i = 0; i < opts.antallHeltRiktig; i++) {
        bets.push({
            ...match,
            home_score: '1',
            away_score: '2',
            user_id: ++user_id + '',
        })
    }
    for (let i = 0; i < opts.antallRiktigUtfall; i++) {
        bets.push({
            ...match,
            home_score: '0',
            away_score: '4',
            user_id: ++user_id + '',
        })
    }
    for (let i = 0; i < opts.antallFeil; i++) {
        bets.push({
            ...match,
            home_score: '0',
            away_score: '0',
            user_id: ++user_id + '',
        })
    }
    return bets
}
