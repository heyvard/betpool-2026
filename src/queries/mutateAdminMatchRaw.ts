import { useMutation } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

export interface AdminMatchRawResultat {
    url: string
    status: number | null
    ok: boolean
    body: unknown
    feil?: string
}

// Henter rå-responsen for én kamp fra football-data.org via vårt
// admin-debug-endepunkt. `id` = football-data sin match-id (= match_num).
export function UseMutateAdminMatchRaw() {
    const authedFetch = useAuthedFetch()
    return useMutation({
        mutationFn: async (id: number) => {
            const response = await authedFetch(`/api/v1/admin/match-raw?id=${id}`, { method: 'GET' })
            if (!response.ok) throw new Error(`Serverfeil: ${response.status}`)
            return response.json() as Promise<AdminMatchRawResultat>
        },
    })
}
