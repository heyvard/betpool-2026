import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

async function sjekkOk(response: Response): Promise<{ id: string }> {
    if (!response.ok) {
        const feil = await response.json().catch(() => ({}))
        throw new Error((feil as { error?: string }).error ?? 'Noe gikk galt')
    }
    return response.json()
}

// Bli med i en liga via en delbar invitasjonslenke. mutate() → { id } (liga-id).
export function UseJoinLeague(token: string | null) {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<{ id: string }, Error, void>({
        mutationFn: async () => {
            const response = await authedFetch(`/api/v1/leagues/join/${token}`, { method: 'POST' })
            return sjekkOk(response)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leagues'] }).then()
        },
    })
}
