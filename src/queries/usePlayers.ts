import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { Spiller } from '../types/types'

export function UsePlayers() {
    const authedFetch = useAuthedFetch()

    return useQuery<Spiller[]>({
        queryKey: ['players'],
        queryFn: async () => {
            const response = await authedFetch('/api/v1/players', { method: 'GET' })
            return await response.json()
        },
    })
}
