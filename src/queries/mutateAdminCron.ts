import { useMutation } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

export type CronJobb = 'sync-scores' | 'sync-matches' | 'send-reminders'

export interface DryRunEndring {
    match_num: number
    home_team: string | null
    away_team: string | null
    ny: boolean
    felt: string[]
    fra: Partial<Record<string, string | number | null>>
    til: Partial<Record<string, string | number | null>>
}

export interface DryRunSyncMatchesResultat {
    hentet: number
    oppdatert: number
    dryRun: true
    endringer: DryRunEndring[]
}

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

export function UseDryRunSyncMatches() {
    const authedFetch = useAuthedFetch()
    return useMutation({
        mutationFn: async () => {
            const response = await authedFetch('/api/v1/admin/cron/sync-matches?dryRun=true', { method: 'POST' })
            if (!response.ok) throw new Error(`Serverfeil: ${response.status}`)
            return response.json() as Promise<DryRunSyncMatchesResultat>
        },
    })
}
