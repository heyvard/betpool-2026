import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { GroupStanding } from '../types/types'

export function UseStandings() {
    const authedFetch = useAuthedFetch()

    return useQuery({
        queryKey: ['standings'],

        queryFn: async () => {
            const response = await authedFetch('/api/v1/standings', { method: 'GET' })
            const grupper: GroupStanding[] = await response.json()
            return grupper
        },
    })
}
