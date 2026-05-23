import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

export interface LeagueInput {
    name?: string
    innsats?: number | null
    betalingsinfo?: string | null
}

async function sjekkOk(response: Response): Promise<unknown> {
    if (!response.ok) {
        const feil = await response.json().catch(() => ({}))
        throw new Error((feil as { error?: string }).error ?? 'Noe gikk galt')
    }
    return response.json()
}

// Opprett en ny privat liga. Oppretteren blir eier og medlem.
export function UseCreateLeague() {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<{ id: string }, Error, LeagueInput>({
        mutationFn: async (input) => {
            const response = await authedFetch('/api/v1/leagues', {
                method: 'POST',
                body: JSON.stringify(input),
            })
            return (await sjekkOk(response)) as { id: string }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leagues'] }).then()
        },
    })
}

// Oppdater navn/innsats/betalingsinfo på en liga (kun eier).
export function UseUpdateLeague(id: string) {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<unknown, Error, LeagueInput>({
        mutationFn: async (input) => {
            const response = await authedFetch(`/api/v1/leagues/${id}`, {
                method: 'PUT',
                body: JSON.stringify(input),
            })
            return sjekkOk(response)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leagues'] }).then()
            queryClient.invalidateQueries({ queryKey: ['league', id] }).then()
        },
    })
}

// Slett en liga (kun eier).
export function UseDeleteLeague(id: string) {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<unknown, Error, void>({
        mutationFn: async () => {
            const response = await authedFetch(`/api/v1/leagues/${id}`, { method: 'DELETE' })
            return sjekkOk(response)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leagues'] }).then()
            queryClient.invalidateQueries({ queryKey: ['league', id] }).then()
        },
    })
}
