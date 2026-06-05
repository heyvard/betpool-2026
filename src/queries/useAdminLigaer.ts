import { useQuery } from '@tanstack/react-query'
import { useAuthedFetch } from '../auth/authedFetch'
import { AdminLiga } from '../pages/api/v1/admin/ligaer'

export type { AdminLiga }

export function UseAdminLigaer() {
    const authedFetch = useAuthedFetch()

    return useQuery<AdminLiga[]>({
        queryKey: ['admin-ligaer'],
        queryFn: async () => {
            const response = await authedFetch('/api/v1/admin/ligaer', { method: 'GET' })
            if (!response.ok) throw new Error('Klarte ikke hente ligaer')
            return response.json()
        },
    })
}
