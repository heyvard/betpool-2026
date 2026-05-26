import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

export type Locale = 'no' | 'fr'

export function UseMutateLanguage() {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<unknown, unknown, Locale>({
        mutationFn: async (language) => {
            const response = await authedFetch('/api/v1/me/language', {
                method: 'PUT',
                body: JSON.stringify({ language }),
            })
            if (!response.ok) {
                throw new Error('Kunne ikke lagre språkvalget')
            }
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user-me'] }).then()
        },
    })
}
