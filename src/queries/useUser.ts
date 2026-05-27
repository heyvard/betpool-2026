import { signOut } from 'firebase/auth'
import { useQuery } from '@tanstack/react-query'

import { useSession } from '../auth/useSession'
import { useAuthedFetch } from '../auth/authedFetch'
import { getFirebaseAuth } from '../auth/clientApp'
import { erTestAuth } from '../utils/erTestAuth'
import { User } from '../types/user'

export function UseUser() {
    const { user } = useSession()
    const authedFetch = useAuthedFetch()

    return useQuery<User>({
        queryKey: ['user-me'],
        enabled: !!user,
        retry: (failureCount, error: unknown) => {
            if ((error as { status?: number }).status === 409) return false
            return failureCount < 3
        },
        queryFn: async () => {
            const response = await authedFetch('/api/v1/me', { method: 'GET' })
            if (!response.ok) {
                if (response.status === 409) {
                    sessionStorage.setItem('betpool_email_conflict', '1')
                    if (!erTestAuth()) await signOut(getFirebaseAuth())
                }
                throw Object.assign(new Error('me_' + response.status), { status: response.status })
            }
            return response.json()
        },
    })
}
