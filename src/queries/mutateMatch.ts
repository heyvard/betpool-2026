import { useAuthState } from 'react-firebase-hooks/auth'
import { getFirebaseAuth } from '../auth/clientApp'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function UseMutateMatch(
    id: number,
    homeScore: number | null,
    awayScore: number | null,
    successCallback: () => void,
) {
    const queryClient = useQueryClient()
    const [user] = useAuthState(getFirebaseAuth())

    return useMutation({
        mutationFn: async () => {
            const idtoken = await user?.getIdToken()
            const responsePromise = await fetch(`/api/v1/matches/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ home_score: homeScore, away_score: awayScore }),
                headers: { Authorization: `Bearer ${idtoken}` },
            })
            return responsePromise.json()
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['matches'] }).then()
            queryClient.invalidateQueries({ queryKey: ['all-bets'] }).then()
            queryClient.invalidateQueries({ queryKey: ['my-bets'] }).then()

            successCallback()
        },
    })
}
