import { useMutation } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

export type CronJobb = 'sync' | 'send-reminders' | 'send-vm-start' | 'send-evening-reminders'

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

export interface DryRunSyncResultat {
    kamper: DryRunSyncMatchesResultat
    scores: DryRunSyncScoresResultat
}

export interface SyncAllAdminResultat {
    hentet: number
    kamper: { hentet: number; oppdatert: number }
    scores: { hentet: number; oppdatert: number }
}

export interface FeedBackfillResultat {
    fraDato: string | null
    tilDato: string
    dager: number
    kampposter: number
    morgenrapporter: number
}

export function UseMutateFeedBackfill() {
    const authedFetch = useAuthedFetch()
    return useMutation({
        mutationFn: async () => {
            const response = await authedFetch('/api/v1/admin/cron/feed-backfill', { method: 'POST' })
            if (!response.ok) throw new Error(`Serverfeil: ${response.status}`)
            return response.json() as Promise<FeedBackfillResultat>
        },
    })
}

// Resultatet fra /api/v1/admin/cron/morning-report — speiler AiMorgenrapportLagreResultat
// i server/feed/morgenrapportAi.ts. Den manuelle triggeren poster den AI-genererte
// morgenrapporten (Claude) i feeden.
export interface MorgenrapportResultat {
    postet: boolean
    grunn?: 'allerede_postet' | 'stille_dag' | 'ingen_baseline'
    antallKamper?: number
    modell?: AiModellId
    kostnad?: AiMorgenrapportKostnad
}

export function UseMutateMorgenrapport() {
    const authedFetch = useAuthedFetch()
    return useMutation({
        mutationFn: async () => {
            const response = await authedFetch('/api/v1/admin/cron/morning-report', { method: 'POST' })
            if (!response.ok) throw new Error(`Serverfeil: ${response.status}`)
            return response.json() as Promise<MorgenrapportResultat>
        },
    })
}

// ── AI-morgenrapport (dry run) ───────────────────────────────────────────────

export interface AiMorgenrapportSeksjon {
    emoji: string
    overskrift: string
    tekst: string
}

export interface AiMorgenrapport {
    tittel: string
    ingress: string
    seksjoner: AiMorgenrapportSeksjon[]
}

export interface AiMorgenrapportKostnad {
    inputTokens: number
    outputTokens: number
    usd: number
}

// Modellene superadmin kan velge i UI-et. Holdt synk med AI_MODELLER i
// server/feed/morgenrapportAi.ts (id-ene må matche). Definert her så klienten ikke
// importerer server-modulen (som drar inn Anthropic-SDK-en).
export type AiModellId = 'claude-sonnet-4-6' | 'claude-haiku-4-5'

export const AI_MODELL_VALG: { id: AiModellId; navn: string }[] = [
    { id: 'claude-sonnet-4-6', navn: 'Sonnet' },
    { id: 'claude-haiku-4-5', navn: 'Haiku' },
]

// Speiler AiMorgenrapportDryRun fra server/feed/morgenrapportAi.ts. `kontekst` er
// rådataene (typet løst her — vises kun som JSON i UI-en).
export interface AiMorgenrapportDryRunResultat {
    rapportDato: string
    modell: AiModellId
    antallKamper: number
    harBaseline: boolean
    kontekst: unknown
    rapport: AiMorgenrapport | null
    grunn?: 'ingen_kamper'
    usage?: { input_tokens: number; output_tokens: number }
    kostnad?: AiMorgenrapportKostnad
}

export function UseAiMorgenrapport() {
    const authedFetch = useAuthedFetch()
    return useMutation({
        mutationFn: async ({ dato, modell }: { dato: string; modell: AiModellId }) => {
            const response = await authedFetch(
                `/api/v1/admin/cron/morning-report-ai?dato=${encodeURIComponent(dato)}&modell=${encodeURIComponent(modell)}`,
                { method: 'POST' },
            )
            if (!response.ok) {
                const feil = (await response.json().catch(() => null)) as { error?: string } | null
                throw new Error(feil?.error ?? `Serverfeil: ${response.status}`)
            }
            return response.json() as Promise<AiMorgenrapportDryRunResultat>
        },
    })
}

export function UseMutateAdminSync() {
    const authedFetch = useAuthedFetch()
    return useMutation({
        mutationFn: async () => {
            const response = await authedFetch('/api/v1/admin/cron/sync', { method: 'POST' })
            if (!response.ok) throw new Error(`Serverfeil: ${response.status}`)
            return response.json() as Promise<SyncAllAdminResultat>
        },
    })
}

export function UseDryRunSync() {
    const authedFetch = useAuthedFetch()
    return useMutation({
        mutationFn: async () => {
            const response = await authedFetch('/api/v1/admin/cron/sync?dryRun=true', { method: 'POST' })
            if (!response.ok) throw new Error(`Serverfeil: ${response.status}`)
            return response.json() as Promise<DryRunSyncResultat>
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
