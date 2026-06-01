// Typer for private ligaer. En privat liga er en filtrert delmengde av poolen —
// poengene er de samme som i hovedligaen. Se `leagues`/`league_members` i initialschemaet.

export type LeagueStatus = 'invitert' | 'medlem'

/** Ett medlem (eller en åpen invitasjon) i en liga. */
export interface LeagueMember {
    user_id: string
    name: string
    picture: string | null
    status: LeagueStatus
    paid: boolean
}

/** Premiefordeling i prosent for 1./2./3. plass. Sum må være ≤ 100. */
export interface PremieProsent {
    premie_forste_prosent: number
    premie_andre_prosent: number
    premie_tredje_prosent: number
}

/** En liga slik den vises i lista «Mine ligaer» / invitasjoner. */
export interface LeagueSummary extends PremieProsent {
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
export interface LeagueDetail extends PremieProsent {
    id: string
    name: string
    owner_user_id: string
    owner_name: string
    innsats: number | null
    betalingsinfo: string | null
    /** Opak token for den delbare invitasjonslenken (/bli-med/<token>). */
    invite_token: string
    is_owner: boolean
    members: LeagueMember[]
}

/** En bruker som kan inviteres til en liga. */
export interface InvitableUser {
    id: string
    name: string
    picture: string | null
}

/** Lett forhåndsvisning av en liga man følger en invitasjonslenke til. */
export interface LeagueInvitePreview {
    id: string
    name: string
    owner_name: string
    member_count: number
    innsats: number | null
    betalingsinfo: string | null
    /** Om innlogget bruker allerede er medlem/invitert i ligaen. */
    already_member: boolean
}
