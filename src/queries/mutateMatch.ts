import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

export function UseMutateMatch(
    id: number,
    homeScore: number | null,
    awayScore: number | null,
    successCallback: () => void,
) {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation({
        mutationFn: async () => {
            const response = await authedFetch(`/api/v1/matches/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ home_score: homeScore, away_score: awayScore }),
            })
            return response.json()
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['matches'] }).then()
            queryClient.invalidateQueries({ queryKey: ['all-bets'] }).then()
            queryClient.invalidateQueries({ queryKey: ['my-bets'] }).then()

            successCallback()
        },
    })
}
