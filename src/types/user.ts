export interface User {
    id: string
    firebase_user_id: string
    picture: string
    active: boolean
    email: string
    name: string
    superadmin: boolean
    scoreadmin: boolean
    paymentadmin: boolean
    paid: boolean
    created_at: string
    updated_at: string
    winner: string
    topscorer: string | undefined
    notif_general: boolean
    notif_reminders: boolean
    notif_summary: boolean
}
