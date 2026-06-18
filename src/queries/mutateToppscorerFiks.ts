import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

interface ToppscorerFiksReq {
    userId: string
    // null nullstiller koblingen, et tall kobler til players.id.
    playerId: number | null
}

export function UseMutateToppscorerFiks() {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<unknown, unknown, ToppscorerFiksReq>({
        mutationFn: async (req) => {
            const response = await authedFetch('/api/v1/admin/topscorer-fiks', {
                method: 'PUT',
                body: JSON.stringify(req),
            })
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['toppscorer-fiks'] }).then()
        },
    })
}
