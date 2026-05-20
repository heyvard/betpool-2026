export interface LeaderboardLinje {
    picture?: string
    name: string
    userid: string
    score: number
}

export interface Bet {
    game_start: string
    away_team: string
    home_team: string
    home_score: number | null
    away_score: number | null
    match_num: number
    round: number
    joker: boolean
}

export interface Chat {
    message: string
    id: string
    created_at: string
    name: string
    picture: string
    user_id: string
}

export interface Match {
    game_start: string
    away_team: string
    home_team: string
    home_score: number | null
    away_score: number | null
    match_num: number
    round: number
    group?: string
}

export interface UserForAdmin {
    id: string
    name: string
    email: string
    paid: boolean
    superadmin: boolean
    scoreadmin: boolean
    paymentadmin: boolean
    active: boolean
}
