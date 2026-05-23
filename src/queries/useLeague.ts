import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { LeagueDetail } from '../types/league'

// Full ligadetalj med medlemsliste. `id === null` (hovedligaen er valgt) lar
// spørringen stå deaktivert.
export function UseLeague(id: string | null) {
    const authedFetch = useAuthedFetch()

    return useQuery<LeagueDetail>({
        queryKey: ['league', id],
        enabled: !!id,

        queryFn: async () => {
            const response = await authedFetch(`/api/v1/leagues/${id}`, { method: 'GET' })
            if (!response.ok) {
                throw new Error('Klarte ikke hente ligaen')
            }
            return await response.json()
        },
    })
}
