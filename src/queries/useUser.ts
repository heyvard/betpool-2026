import { useQuery } from '@tanstack/react-query'

import { useSession } from '../auth/useSession'
import { useAuthedFetch } from '../auth/authedFetch'
import { User } from '../types/user'

export function UseUser() {
    const { user } = useSession()
    const authedFetch = useAuthedFetch()

    return useQuery<User>({
        queryKey: ['user-me'],
        enabled: !!user,
        queryFn: async () => {
            const response = await authedFetch('/api/v1/me', { method: 'GET' })
            return response.json()
        },
    })
}
