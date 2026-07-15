import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

interface TournamentResultReq {
    winnerTeam: string | null
    topscorerPlayerIds: number[]
}

export function UseMutateTournamentResult() {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<unknown, unknown, TournamentResultReq>({
        mutationFn: async (req) => {
            const response = await authedFetch('/api/v1/admin/tournament-result', {
                method: 'PUT',
                body: JSON.stringify(req),
            })
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament-result'] }).then()
            queryClient.invalidateQueries({ queryKey: ['all-bets'] }).then()
        },
    })
}
