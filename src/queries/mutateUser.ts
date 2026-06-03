import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

interface MuteteUserReq {
    request: {
        paid?: boolean
        paymentadmin?: boolean
        scoreadmin?: boolean
        active?: boolean
    }
}

export function UseMutateUser(id: string) {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<any, unknown, MuteteUserReq>({
        mutationFn: async (req) => {
            const response = await authedFetch(`/api/v1/users/${id}`, {
                method: 'PUT',
                body: JSON.stringify(req.request),
            })
            return response.json()
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] }).then()
            queryClient.invalidateQueries({ queryKey: ['all-bets'] }).then()
        },
    })
}

export function UseSletteUser(id: string) {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<void, unknown, void>({
        mutationFn: async () => {
            await authedFetch(`/api/v1/users/${id}`, { method: 'DELETE' })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] }).then()
            queryClient.invalidateQueries({ queryKey: ['all-bets'] }).then()
        },
    })
}
