import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

export function UseMutateBet(
    matchNum: number,
    homeScore: number | null,
    awayScore: number | null,
    successCallback: () => void,
) {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<any>({
        mutationFn: async () => {
            const response = await authedFetch(`/api/v1/me/bets/${matchNum}`, {
                method: 'PUT',
                body: JSON.stringify({ home_score: homeScore, away_score: awayScore }),
            })
            return response.json()
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-bets'] }).then()
            successCallback()
        },
    })
}
