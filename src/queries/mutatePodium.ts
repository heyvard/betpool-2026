import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { AiModellId, AiMorgenrapportKostnad } from './mutateAdminCron'
import { FEED_QUERY_KEY } from './useFeed'

// Pallen: postes én gang av superadmin fra /vinner-toppscorer, når resultatene
// er verifisert. Speiler AI-morgenrapportens dry run/post-par (mutateAdminCron.ts)
// — se src/server/feed/podiumAi.ts for kontrakten disse typene speiler.

export interface PodiumSpiller {
    plass: number
    userId: string
    navn: string
    picture: string | null
    poeng: number
    antallTippet: number
    riktigeUtfall: number
    riktigeResultater: number
    jokerSatt: number
    jokerBrent: number
    besteKamp: { kamp: string; poeng: number; rundeTekst: string } | null
    norgePoeng: number
    vantVinnerBonus: boolean
    vantToppscorerBonus: boolean
}

export interface PodiumAiKontekst {
    vinner: { tla: string; navn: string; flagg: string } | null
    toppscorere: string[]
    topp3: PodiumSpiller[]
}

export interface AiPodiumSpillerTekst {
    userId: string
    emoji: string
    tekst: string
}

export interface AiPodium {
    tittel: string
    ingress: string
    spillere: AiPodiumSpillerTekst[]
}

export interface PodiumDryRunResultat {
    kontekst: PodiumAiKontekst
    modell: AiModellId
    rapport: AiPodium | null
    grunn?: 'fasit_ikke_satt'
    brukerMock?: boolean
    usage?: { input_tokens: number; output_tokens: number }
    kostnad?: AiMorgenrapportKostnad
}

export function UsePodiumDryRun() {
    const authedFetch = useAuthedFetch()
    return useMutation({
        mutationFn: async ({
            modell,
            mockWinner,
            mockTopscorerIds,
        }: {
            modell: AiModellId
            mockWinner?: string
            mockTopscorerIds?: number[]
        }) => {
            const params = new URLSearchParams()
            params.append('modell', modell)
            if (mockWinner) params.append('mockWinner', mockWinner)
            if (mockTopscorerIds && mockTopscorerIds.length > 0) {
                params.append('mockTopscorerIds', mockTopscorerIds.join(','))
            }

            const response = await authedFetch(`/api/v1/admin/cron/podium-dry-run?${params.toString()}`, {
                method: 'POST',
            })
            if (!response.ok) {
                const feil = (await response.json().catch(() => null)) as { error?: string } | null
                throw new Error(feil?.error ?? `Serverfeil: ${response.status}`)
            }
            return response.json() as Promise<PodiumDryRunResultat>
        },
    })
}

export interface PodiumPostResultat {
    postet: boolean
    grunn?: 'allerede_postet' | 'fasit_ikke_satt'
    modell?: AiModellId
    kostnad?: AiMorgenrapportKostnad
}

export function UsePodiumPost() {
    const authedFetch = useAuthedFetch()
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ modell }: { modell: AiModellId }) => {
            const response = await authedFetch(`/api/v1/admin/cron/podium?modell=${encodeURIComponent(modell)}`, {
                method: 'POST',
            })
            if (!response.ok) {
                const feil = (await response.json().catch(() => null)) as { error?: string } | null
                throw new Error(feil?.error ?? `Serverfeil: ${response.status}`)
            }
            return response.json() as Promise<PodiumPostResultat>
        },
        onSuccess: (data) => {
            if (data.postet) {
                queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY })
            }
        },
    })
}
