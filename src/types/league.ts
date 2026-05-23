// Typer for private ligaer. En privat liga er en filtrert delmengde av poolen —
// poengene er de samme som i hovedligaen. Se migrasjon 20260522120000_add_leagues.

export type LeagueStatus = 'invitert' | 'medlem'

/** Ett medlem (eller en åpen invitasjon) i en liga. */
export interface LeagueMember {
    user_id: string
    name: string
    picture: string | null
    status: LeagueStatus
    paid: boolean
}

/** En liga slik den vises i lista «Mine ligaer» / invitasjoner. */
export interface LeagueSummary {
    id: string
    name: string
    owner_user_id: string
    owner_name: string
    innsats: number | null
    betalingsinfo: string | null
    member_count: number
    /** Innlogget brukers rolle i ligaen. */
    my_status: LeagueStatus
    my_paid: boolean
    is_owner: boolean
}

/** Full ligadetalj med medlemsliste. */
export interface LeagueDetail {
    id: string
    name: string
    owner_user_id: string
    owner_name: string
    innsats: number | null
    betalingsinfo: string | null
    is_owner: boolean
    members: LeagueMember[]
}

/** En bruker som kan inviteres til en liga. */
export interface InvitableUser {
    id: string
    name: string
    picture: string | null
}
