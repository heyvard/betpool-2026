import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

export interface Hovedliga {
    pris: number
    antallDeltakere: number
    pott: number
}

export function UseHovedliga() {
    const authedFetch = useAuthedFetch()

    return useQuery<Hovedliga>({
        queryKey: ['hovedliga'],
        queryFn: async () => {
            const response = await authedFetch('/api/v1/hovedliga', { method: 'GET' })
            if (!response.ok) {
                throw new Error('Kunne ikke hente hovedligaen')
            }
            return response.json()
        },
    })
}
