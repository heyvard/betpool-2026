import { useQuery } from '@tanstack/react-query'
import { useAuthedFetch } from '../auth/authedFetch'
import { UtenforHovedligaBruker } from '../pages/api/v1/admin/utenfor-hovedliga'

export type { UtenforHovedligaBruker }

export function UseUtenforHovedliga() {
    const authedFetch = useAuthedFetch()

    return useQuery<UtenforHovedligaBruker[]>({
        queryKey: ['utenfor-hovedliga'],
        queryFn: async () => {
            const response = await authedFetch('/api/v1/admin/utenfor-hovedliga', { method: 'GET' })
            if (!response.ok) throw new Error('Klarte ikke hente brukere utenfor hovedligaen')
            return response.json()
        },
    })
}
