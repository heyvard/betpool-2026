import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

// Slår av/på om brukeren er med i hovedligaen. Påvirker både egen profil og
// poengberegningen på ledertavla, så vi invaliderer begge.
export function UseMutateHovedliga() {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<unknown, unknown, boolean>({
        mutationFn: async (iHovedliga) => {
            const response = await authedFetch('/api/v1/me/hovedliga', {
                method: 'PUT',
                body: JSON.stringify({ i_hovedliga: iHovedliga }),
            })
            if (!response.ok) {
                throw new Error('Kunne ikke lagre — prøv igjen.')
            }
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user-me'] }).then()
            queryClient.invalidateQueries({ queryKey: ['all-bets'] }).then()
            queryClient.invalidateQueries({ queryKey: ['hovedliga'] }).then()
        },
    })
}
