import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { LeagueSummary } from '../types/league'

// Ligaer der innlogget bruker er medlem eller invitert.
export function UseLeagues() {
    const authedFetch = useAuthedFetch()

    return useQuery<LeagueSummary[]>({
        queryKey: ['leagues'],

        queryFn: async () => {
            const response = await authedFetch('/api/v1/leagues', { method: 'GET' })
            return await response.json()
        },
    })
}
