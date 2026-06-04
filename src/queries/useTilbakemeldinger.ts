import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

export interface Tilbakemelding {
    id: string
    user_id: string
    name: string
    picture: string | null
    message: string
    behandlet_at: string | null
    created_at: string
}

// Henter alle tilbakemeldinger (kun superadmin har tilgang i API-laget).
export function UseTilbakemeldinger() {
    const authedFetch = useAuthedFetch()

    return useQuery<Tilbakemelding[]>({
        queryKey: ['feedback'],

        queryFn: async () => {
            const response = await authedFetch('/api/v1/feedback', { method: 'GET' })
            return await response.json()
        },
    })
}
