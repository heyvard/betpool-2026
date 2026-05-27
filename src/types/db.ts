export interface User {
    name: string
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
}
