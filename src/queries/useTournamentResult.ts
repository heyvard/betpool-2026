import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

export interface TournamentResult {
    winnerTeam: string
    topscorerPlayerIds: number[]
}

export function UseTournamentResult() {
    const authedFetch = useAuthedFetch()

    return useQuery<TournamentResult>({
        queryKey: ['tournament-result'],
        queryFn: async () => {
            const response = await authedFetch('/api/v1/admin/tournament-result', { method: 'GET' })
            return await response.json()
        },
    })
}
