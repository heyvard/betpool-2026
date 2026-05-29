import { useMutation } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

export type CronJobb = 'sync-scores' | 'sync-matches' | 'send-reminders'

export function UseMutateAdminCron(jobb: CronJobb) {
    const authedFetch = useAuthedFetch()
    return useMutation({
        mutationFn: async () => {
            const response = await authedFetch(`/api/v1/admin/cron/${jobb}`, { method: 'POST' })
            if (!response.ok) throw new Error(`Serverfeil: ${response.status}`)
            return response.json() as Promise<Record<string, number>>
        },
    })
}
