import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { LeagueInvitePreview } from '../types/league'

// Forhåndsvisning av en liga man følger en invitasjonslenke til. Deaktivert til
// token er kjent (router har hydrert).
export function UseLeagueInvite(token: string | null) {
    const authedFetch = useAuthedFetch()

    return useQuery<LeagueInvitePreview>({
        queryKey: ['league-invite', token],
        enabled: !!token,

        queryFn: async () => {
            const response = await authedFetch(`/api/v1/leagues/join/${token}`, { method: 'GET' })
            if (!response.ok) {
                const feil = await response.json().catch(() => ({}))
                throw new Error((feil as { error?: string }).error ?? 'Klarte ikke hente invitasjonen')
            }
            return await response.json()
        },
    })
}
