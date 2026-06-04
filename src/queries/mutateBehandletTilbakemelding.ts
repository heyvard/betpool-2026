import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

// Markerer en tilbakemelding som behandlet eller ubehandlet (superadmin).
export function UseSettBehandlet() {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<unknown, unknown, { id: string; behandlet: boolean }>({
        mutationFn: async ({ id, behandlet }) => {
            const response = await authedFetch(`/api/v1/feedback/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ behandlet }),
            })
            if (!response.ok) {
                throw new Error('Kunne ikke oppdatere tilbakemeldingen')
            }
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['feedback'] }).then()
        },
    })
}
