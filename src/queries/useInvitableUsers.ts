import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { InvitableUser } from '../types/league'

// Alle aktive brukere — kildelista til invitasjonsplukkeren på en ligaside.
export function UseInvitableUsers() {
    const authedFetch = useAuthedFetch()

    return useQuery<InvitableUser[]>({
        queryKey: ['invitable-users'],

        queryFn: async () => {
            const response = await authedFetch('/api/v1/leagues/invitable-users', { method: 'GET' })
            return await response.json()
        },
    })
}
