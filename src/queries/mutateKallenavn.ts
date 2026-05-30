import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

export function UseMutateKallenavn() {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<unknown, unknown, string>({
        mutationFn: async (kallenavn) => {
            const response = await authedFetch('/api/v1/me/kallenavn', {
                method: 'PUT',
                body: JSON.stringify({ kallenavn }),
            })
            if (!response.ok) {
                throw new Error('Kunne ikke lagre kallenavnet')
            }
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user-me'] }).then()
        },
    })
}
