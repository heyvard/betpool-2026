import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

type ManglendeTipsReq = { userId: string; winner: string } | { userId: string; topscorerPlayerId: number }

export function UseMutateManglendeTips() {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<unknown, unknown, ManglendeTipsReq>({
        mutationFn: async (req) => {
            const response = await authedFetch('/api/v1/admin/manglende-tips', {
                method: 'PUT',
                body: JSON.stringify(req),
            })
            if (!response.ok) {
                const body = await response.json().catch(() => null)
                throw new Error(body?.error ?? 'Kunne ikke lagre')
            }
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['manglende-tips'] }).then()
            queryClient.invalidateQueries({ queryKey: ['all-bets'] }).then()
            queryClient.invalidateQueries({ queryKey: ['stats'] }).then()
        },
    })
}
