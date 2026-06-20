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
}

export interface StatsResponse {
    /** Antall deltakere som har tippet i ligaen. */
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
 * // TODO backend: `/api/v1/stats/` finnes ikke ennå. Endepunktet skal returnere
 * // `StatsResponse` (se over) for ligaen den innloggede brukeren er med i —
 * // `totaltAntall` = antall som har tippet, og `vinner`/`toppscorer` med ett
 * // `TipsValg` per unikt valg (`navn` = tla for vinner / spillernavn for
 * // toppscorer, `deltakere` = kallenavn/navn på dem som valgte det).
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
