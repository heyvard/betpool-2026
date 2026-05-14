import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { UserForAdmin } from '../types/types'

export function UseUsers() {
    const authedFetch = useAuthedFetch()

    return useQuery<UserForAdmin[]>({
        queryKey: ['users'],

        queryFn: async () => {
            const response = await authedFetch('/api/v1/users', { method: 'GET' })
            return await response.json()
        },
    })
}
