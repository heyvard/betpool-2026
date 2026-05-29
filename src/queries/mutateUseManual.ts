import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthedFetch } from '../auth/authedFetch'

export function UseMutateUseManual(id: number) {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation({
        mutationFn: async (useManual: boolean) => {
            const response = await authedFetch(`/api/v1/matches/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ use_manual: useManual }),
            })
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['matches'] }).then()
            queryClient.invalidateQueries({ queryKey: ['all-bets'] }).then()
            queryClient.invalidateQueries({ queryKey: ['my-bets'] }).then()
        },
    })
}
