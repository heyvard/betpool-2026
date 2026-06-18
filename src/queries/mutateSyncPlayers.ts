import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

export interface SyncPlayersResultat {
    hentet: number
    oppdatert: number
    lag: number
}

export function UseMutateSyncPlayers() {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation({
        mutationFn: async () => {
            const response = await authedFetch('/api/v1/admin/players', { method: 'POST' })
            if (!response.ok) throw new Error(`Serverfeil: ${response.status}`)
            return response.json() as Promise<SyncPlayersResultat>
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['players'] }).then()
        },
    })
}
