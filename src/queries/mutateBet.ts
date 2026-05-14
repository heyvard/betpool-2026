import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthState } from 'react-firebase-hooks/auth'
import { getFirebaseAuth } from '../auth/clientApp'

export function UseMutateBet(
    matchNum: number,
    homeScore: number | null,
    awayScore: number | null,
    successCallback: () => void,
) {
    const queryClient = useQueryClient()
    const [user] = useAuthState(getFirebaseAuth())

    return useMutation<any>({
        mutationFn: async () => {
            const idtoken = await user?.getIdToken()
            const responsePromise = await fetch(`/api/v1/me/bets/${matchNum}`, {
                method: 'PUT',
                body: JSON.stringify({ home_score: homeScore, away_score: awayScore }),
                headers: { Authorization: `Bearer ${idtoken}` },
            })
            return responsePromise.json()
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-bets'] }).then()
            successCallback()
        },
    })
}
