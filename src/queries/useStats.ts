import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

/**
 * Ett unikt tips (ett lag eller én spiller) og hvem som står bak det.
 */
export interface TipsValg {
    /** Lagnavn (tla, for vinner) eller spillernavn (for toppscorer). */
    navn: string
    /** Hvor mange i ligaen som valgte dette. */
    antall: number
    /** Navn på deltakerne som valgte det (for «se hvem»). */
    deltakere: string[]
    /** Delmengde av `deltakere` som har brukt byttet sitt for denne kategorien. */
    byttere: string[]
}

export interface StatsResponse {
    /**
     * Hovedligaens (Æresligaens) fulle størrelse — samme populasjon bonusen
     * faktisk betales ut fra (calculateAllBetsExtended). Brukes som nevner for
     * «mulig bonus»-trappen i /alle-tips, ikke antall som har svart ennå.
     */
    totaltAntall: number
    /** Usortert — sorteres i UI. */
    vinner: TipsValg[]
    toppscorer: TipsValg[]
}

/**
 * Henter fordelingen av hele ligaens vinner- og toppscorer-tips.
 *
 * queryKey-en `['stats']` invalideres allerede i `index.tsx` når brukeren lagrer
 * eget vinner-/toppscorer-tips, så denne hooken oppdaterer seg automatisk.
 *
 * Backend: `/api/v1/stats/` (se `src/pages/api/v1/stats.ts`). Returnerer en tom
 * fordeling så lenge andres tips er skjult (frem til starten på runde 2), samme
 * synlighetsgaranti som `/api/v1/bets`.
 */
export function UseStats() {
    const authedFetch = useAuthedFetch()

    return useQuery<StatsResponse>({
        queryKey: ['stats'],
        queryFn: async () => {
            const response = await authedFetch('/api/v1/stats/', { method: 'GET' })
            if (!response.ok) {
                throw Object.assign(new Error('stats_' + response.status), { status: response.status })
            }
            return response.json()
        },
    })
}
