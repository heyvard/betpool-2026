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
    /**
     * Kommer fra `users.topscorer`-kolonnen (én p — etablert DB-navn). I
     * UI-strenger skriver vi "toppscorer" (to p-er, korrekt norsk). Ikke
     * gi etter for fristelsen til å migrere kolonnen — det krever en
     * koordinert deploy uten gevinst.
     */
    topscorer: string | undefined
    notif_general: boolean
    notif_reminders: boolean
    notif_summary: boolean
    onboarded_at: string | null
}
