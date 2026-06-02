// Husker en invitasjonslenke (/bli-med/<token>) på tvers av innlogging og
// onboarding. En uinnlogget bruker som åpner lenken ser SignInScreen (selve
// bli-med-siden mountes ikke før man er innlogget), så token-en må lagres her
// og gjenopprettes når brukeren er klar.

const NØKKEL = 'betpool_pending_invite'

/** Plukker invitasjons-token ut av en sti som «/bli-med/<token>». */
export function inviteTokenFraSti(asPath: string): string | null {
    const m = asPath.match(/^\/bli-med\/([^/?#]+)/)
    return m ? decodeURIComponent(m[1]) : null
}

export function lagrePendingInvite(token: string): void {
    try {
        window.localStorage.setItem(NØKKEL, token)
    } catch {
        // localStorage kan være utilgjengelig (privat modus o.l.) — da huskes
        // intent kun så lenge SPA-ruten består.
    }
}

export function lesPendingInvite(): string | null {
    try {
        return window.localStorage.getItem(NØKKEL)
    } catch {
        return null
    }
}

export function fjernPendingInvite(): void {
    try {
        window.localStorage.removeItem(NØKKEL)
    } catch {
        // ignorer
    }
}
