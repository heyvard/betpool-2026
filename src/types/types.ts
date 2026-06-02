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
    group?: string
}

export interface Chat {
    message: string
    id: string
    created_at: string
    name: string
    picture: string
    user_id: string
}

// Kampstatus slik football-data.org v4 leverer den.
export type MatchStatus =
    | 'SCHEDULED'
    | 'TIMED'
    | 'IN_PLAY'
    | 'PAUSED'
    | 'FINISHED'
    | 'SUSPENDED'
    | 'POSTPONED'
    | 'CANCELLED'
    | 'AWARDED'

export interface MatchAdminData {
    manual_home_score: number | null
    manual_away_score: number | null
    synced_home_ft: number | null
    synced_away_ft: number | null
    synced_home_et: number | null
    synced_away_et: number | null
    synced_home_pen: number | null
    synced_away_pen: number | null
    synced_duration: string | null
    score_synced_at: string | null
    use_manual: boolean
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
    status: MatchStatus
    adminData?: MatchAdminData
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
    notif_general: boolean
    notif_reminders: boolean
    notif_summary: boolean
    i_hovedliga: boolean
    device_count: number
}
