import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { ToppscorerFiksBruker } from '../types/types'

export function UseToppscorerFiks() {
    const authedFetch = useAuthedFetch()

    return useQuery<ToppscorerFiksBruker[]>({
        queryKey: ['toppscorer-fiks'],
        queryFn: async () => {
            const response = await authedFetch('/api/v1/admin/topscorer-fiks', { method: 'GET' })
            return await response.json()
        },
    })
}
