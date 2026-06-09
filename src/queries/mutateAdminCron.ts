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

export interface DryRunScoreKamp {
    match_num: number
    status: string
    home_team: string | null
    away_team: string | null
    relevant: boolean
    api: {
        fullTime: { home: number | null; away: number | null }
        extraTime: { home: number | null; away: number | null } | null
        penalties: { home: number | null; away: number | null } | null
        duration: string | null
    }
    db: {
        synced_home_ft: number | null
        synced_away_ft: number | null
        synced_home_et: number | null
        synced_away_et: number | null
        synced_home_pen: number | null
        synced_away_pen: number | null
        synced_duration: string | null
        score_synced_at: string | null
    } | null
    villeBlittOppdatert: boolean
}

export interface DryRunSyncScoresResultat {
    hentet: number
    relevante: number
    oppdatert: number
    dryRun: true
    kamper: DryRunScoreKamp[]
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

export function UseDryRunSyncScores() {
    const authedFetch = useAuthedFetch()
    return useMutation({
        mutationFn: async () => {
            const response = await authedFetch('/api/v1/admin/cron/sync-scores?dryRun=true', { method: 'POST' })
            if (!response.ok) throw new Error(`Serverfeil: ${response.status}`)
            return response.json() as Promise<DryRunSyncScoresResultat>
        },
    })
}
