import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

// Setter eller fjerner jokeren på en kamp. Serveren håndhever «én joker per
// runde» og flytter jokeren bort fra en evt. annen kamp i samme runde.
export function UseMutateJoker() {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<void, Error, { matchNum: number; joker: boolean }>({
        mutationFn: async ({ matchNum, joker }) => {
            const response = await authedFetch(`/api/v1/me/bets/${matchNum}/joker`, {
                method: 'PUT',
                body: JSON.stringify({ joker }),
            })
            if (!response.ok) {
                const body = await response.json().catch(() => ({}))
                throw new Error(body.error || 'Kunne ikke lagre joker')
            }
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-bets'] }).then()
        },
    })
}
