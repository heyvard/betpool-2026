import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { Bet } from '../types/types'

export function UseMyBets() {
    const authedFetch = useAuthedFetch()

    return useQuery<Bet[]>({
        queryKey: ['my-bets'],

        queryFn: async () => {
            const response = await authedFetch('/api/v1/me/bets', { method: 'GET' })
            return response.json()
        },
    })
}
