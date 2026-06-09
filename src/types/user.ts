export interface User {
    id: string
    firebase_user_id: string
    picture: string
    active: boolean
    email: string
    name: string
    /**
     * Brukerens eget kallenavn. Vises i stedet for `name` overalt navnet
     * presenteres for andre (ledertavle, ligaer, tips osv.). `null`/tom betyr
     * at det vanlige `name` brukes. Rå verdi her — fallback gjøres i API-laget.
     */
    kallenavn: string | null
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
    winner_endret: boolean
    topscorer_endret: boolean
    winner_forrige: string | null
    topscorer_forrige: string | null
    notif_general: boolean
    notif_reminders: boolean
    notif_summary: boolean
    language: 'no' | 'fr'
    onboarded_at: string | null
    /**
     * Om brukeren er med i hovedligaen. Default `true`. Hvis `false` teller ikke
     * brukerens tips i hovedligaens poengberegning — kun i private ligaer.
     */
    i_hovedliga: boolean
}
