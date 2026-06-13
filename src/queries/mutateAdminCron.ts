import { useMutation } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

export type CronJobb =
    | 'sync-scores'
    | 'sync-matches'
    | 'sync-standings'
    | 'send-reminders'
    | 'send-vm-start'
    | 'send-evening-reminders'

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

export interface KampInfo {
    match_num: number
    home_team: string
    away_team: string
    game_start: string
}

export interface DryRunBruker {
    id: string
    name: string
    email: string
    language: string
    antallUtippet: number
    utippedeKamper: KampInfo[]
}

export interface PåminnelseDryRunResultat {
    kamperIMorgen: KampInfo[]
    brukereVilBliVarslet: DryRunBruker[]
}

export function UseDryRunSendReminders() {
    const authedFetch = useAuthedFetch()
    return useMutation({
        mutationFn: async () => {
            const response = await authedFetch('/api/v1/admin/cron/send-reminders?dryRun=true', { method: 'POST' })
            if (!response.ok) throw new Error(`Serverfeil: ${response.status}`)
            return response.json() as Promise<PåminnelseDryRunResultat>
        },
    })
}

export interface VmStartDryRunBruker {
    id: string
    name: string
    email: string
    language: string
}

export interface VmStartDryRunResultat {
    brukereVilBliVarslet: VmStartDryRunBruker[]
}

export function UseDryRunSendVmStart() {
    const authedFetch = useAuthedFetch()
    return useMutation({
        mutationFn: async () => {
            const response = await authedFetch('/api/v1/admin/cron/send-vm-start?dryRun=true', { method: 'POST' })
            if (!response.ok) throw new Error(`Serverfeil: ${response.status}`)
            return response.json() as Promise<VmStartDryRunResultat>
        },
    })
}

export interface EttermiddagsVarselDryRunBruker {
    id: string
    name: string
    email: string
    language: string
    antallUtippet: number
    utippedeKamper: KampInfo[]
}

export interface EttermiddagsVarselDryRunResultat {
    kamperIKveldOgNatt: KampInfo[]
    brukereVilBliVarslet: EttermiddagsVarselDryRunBruker[]
}

export function UseDryRunSendEveningReminders() {
    const authedFetch = useAuthedFetch()
    return useMutation({
        mutationFn: async () => {
            const response = await authedFetch('/api/v1/admin/cron/send-evening-reminders?dryRun=true', {
                method: 'POST',
            })
            if (!response.ok) throw new Error(`Serverfeil: ${response.status}`)
            return response.json() as Promise<EttermiddagsVarselDryRunResultat>
        },
    })
}
