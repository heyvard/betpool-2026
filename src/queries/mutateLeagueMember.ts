import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

async function sjekkOk(response: Response): Promise<unknown> {
    if (!response.ok) {
        const feil = await response.json().catch(() => ({}))
        throw new Error((feil as { error?: string }).error ?? 'Noe gikk galt')
    }
    return response.json()
}

// Inviter en bruker til en liga (kun eier). mutate(userId).
export function UseInviteMember(leagueId: string) {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<unknown, Error, string>({
        mutationFn: async (userId) => {
            const response = await authedFetch(`/api/v1/leagues/${leagueId}/members`, {
                method: 'POST',
                body: JSON.stringify({ user_id: userId }),
            })
            return sjekkOk(response)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['league', leagueId] }).then()
        },
    })
}

// Sett betalt-status på et medlem (kun eier). mutate({ userId, paid }).
export function UseSetMemberPaid(leagueId: string) {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<unknown, Error, { userId: string; paid: boolean }>({
        mutationFn: async ({ userId, paid }) => {
            const response = await authedFetch(`/api/v1/leagues/${leagueId}/members/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ paid }),
            })
            return sjekkOk(response)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['league', leagueId] }).then()
        },
    })
}

// Fjern et medlem (eier), eller meld seg selv ut. mutate(userId).
export function UseRemoveMember(leagueId: string) {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<unknown, Error, string>({
        mutationFn: async (userId) => {
            const response = await authedFetch(`/api/v1/leagues/${leagueId}/members/${userId}`, {
                method: 'DELETE',
            })
            return sjekkOk(response)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leagues'] }).then()
            queryClient.invalidateQueries({ queryKey: ['league', leagueId] }).then()
        },
    })
}

// Svar på en invitasjon: takk ja (status 'medlem') eller takk nei (slett raden).
// mutate({ leagueId, userId, accept }).
export function UseRespondInvitation() {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<unknown, Error, { leagueId: string; userId: string; accept: boolean }>({
        mutationFn: async ({ leagueId, userId, accept }) => {
            const response = await authedFetch(`/api/v1/leagues/${leagueId}/members/${userId}`, {
                method: accept ? 'PUT' : 'DELETE',
                body: accept ? JSON.stringify({ status: 'medlem' }) : undefined,
            })
            return sjekkOk(response)
        },
        onSuccess: (_data, { leagueId }) => {
            queryClient.invalidateQueries({ queryKey: ['leagues'] }).then()
            queryClient.invalidateQueries({ queryKey: ['league', leagueId] }).then()
        },
    })
}
