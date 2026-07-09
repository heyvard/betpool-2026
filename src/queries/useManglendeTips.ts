import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { ManglendeTipsBruker } from '../types/types'

export function UseManglendeTips() {
    const authedFetch = useAuthedFetch()

    return useQuery<ManglendeTipsBruker[]>({
        queryKey: ['manglende-tips'],
        queryFn: async () => {
            const response = await authedFetch('/api/v1/admin/manglende-tips', { method: 'GET' })
            return await response.json()
        },
    })
}
