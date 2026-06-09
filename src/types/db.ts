export interface User {
    name: string
    kallenavn?: string | null
    email: string
    picture: string
    firebase_user_id: string
    superadmin: boolean
    paymentadmin: boolean
    paid: boolean
    scoreadmin: boolean
    active: boolean
    id: string
    winner: string
    topscorer: string | undefined
    winner_endret: boolean
    topscorer_endret: boolean
    winner_forrige: string | null
    topscorer_forrige: string | null
    i_hovedliga: boolean
    sign_in_provider?: string | null
}
