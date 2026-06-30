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
    status?: MatchStatus
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

export interface SluttspillResultat {
    avgjortPa: 'ekstraomganger' | 'straffer'
    vinner: 'home' | 'away'
    etter120: [number, number] // rt + et per lag (stillingen etter 120 min)
    straffer: [number, number] | null // kun ved straffesparkkonkurranse
}

export interface MatchAdminData {
    manual_home_score: number | null
    manual_away_score: number | null
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
    sluttspill?: SluttspillResultat | null
}

export interface Spiller {
    id: number
    name: string
    first_name: string | null
    last_name: string | null
    position: string | null
    date_of_birth: string | null
    nationality: string | null
    shirt_number: number | null
    team_tla: string
    team_id: number | null
    team_name: string | null
}

export interface StandingRow {
    team_tla: string
    position: number
    played: number
    won: number
    draw: number
    lost: number
    goals_for: number
    goals_against: number
    goal_difference: number
    points: number
}

export interface GroupStanding {
    group: string // "Group A"
    table: StandingRow[]
}

// Én bruker slik /toppscorer-fiks viser dem: brukerens fritekst-toppscorer
// (kilden som skal tolkes) sammen med den strukturerte koblingen til en spiller.
export interface ToppscorerFiksBruker {
    id: string
    name: string
    /** Brukerens egen fritekst (users.topscorer). Kan være tom/null. */
    topscorer: string | null
    /** Strukturert kobling (users.topscorer_player_id) — null før den er fikset. */
    topscorer_player_id: number | null
    /** Oppslått spillernavn for den koblede spilleren, hvis satt. */
    player_name: string | null
    /** Tre-bokstavskoden til den koblede spillerens landslag, hvis satt. */
    player_team_tla: string | null
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
    sign_in_provider: string | null
    bet_count: number
    last_bet_at: string | null
    earliest_unbet_match: string | null
}
