import React from 'react'
import NextLink from 'next/link'
import { Match, MatchStatus } from '../../types/types'
import { hentFlag, hentNavn } from '../../utils/lag'
import { cn } from '@/lib/utils'
import { BracketSlot } from '../../data/bracket'

type Locale = 'no' | 'fr'

// Faste mål slik at kolonnene kan plassere nodene matematisk midt mellom
// feederne sine (se Bracket.tsx). Node-høyden er konstant uavhengig av status, så
// status vises som en venstre-stripe (ikke en ekstra rad som ville endret høyden).
export const NODE_BREDDE = 168 // px
export const RAD_HOYDE = 28 // px per lag-rad
export const NODE_HOYDE = RAD_HOYDE * 2 // px

function erFerdig(status: MatchStatus): boolean {
    return status === 'FINISHED' || status === 'AWARDED'
}

function erLive(status: MatchStatus): boolean {
    return status === 'IN_PLAY' || status === 'PAUSED'
}

function stripeFarge(status: MatchStatus): string {
    if (erLive(status)) return 'bg-amber-400'
    if (erFerdig(status)) return 'bg-green-500'
    return 'bg-transparent'
}

function TeamRad({
    tla,
    score,
    locale,
    vinner,
    visScore,
}: {
    tla: string
    score: number | null
    locale: Locale
    vinner: boolean
    visScore: boolean
}) {
    const harLag = tla !== '' && tla !== 'To be announced'
    return (
        <div
            className={cn('flex items-center gap-1.5 px-2', vinner ? 'font-bold text-stone-900' : 'text-stone-600')}
            style={{ height: RAD_HOYDE }}
        >
            <span className="text-sm leading-none">{harLag ? hentFlag(tla) : '⚪️'}</span>
            <span className="min-w-0 flex-1 truncate text-xs leading-none">{harLag ? hentNavn(tla, locale) : '—'}</span>
            {visScore && <span className="bp-tabular w-3 text-right text-xs tabular-nums">{score ?? ''}</span>}
        </div>
    )
}

/**
 * Én kamp i bracketen. Hele noden er en lenke til kampsiden `/match/[match_num]`
 * der tipp-/poeng-detaljene ligger. Viser flagg + lagnavn + faktisk resultat, og
 * uthever laget som gikk videre (høyest score; uavgjort etter 90' → ingen utheving).
 * Status vises som en venstre-stripe (grønn = ferdig, gul = pågår) + puls-prikk live.
 */
export function BracketNode({
    slot,
    match,
    homeTla,
    awayTla,
    locale,
}: {
    slot: BracketSlot
    match: Match | undefined
    // Lagene som skal vises — kan være avledet fra feeder-vinnere (se effektiveLag).
    homeTla: string
    awayTla: string
    locale: Locale
}) {
    const home = homeTla
    const away = awayTla
    const homeScore = match?.home_score ?? null
    const awayScore = match?.away_score ?? null
    const status: MatchStatus = match?.status ?? 'TIMED'

    const ferdig = erFerdig(status)
    const live = erLive(status)
    const harScore = homeScore !== null && awayScore !== null
    const visScore = harScore && (ferdig || live)

    const homeVinner = !!(ferdig && harScore && homeScore > awayScore)
    const awayVinner = !!(ferdig && harScore && awayScore > homeScore)

    return (
        <NextLink
            href={`/match/${slot.matchNum}`}
            style={{ width: NODE_BREDDE, height: NODE_HOYDE }}
            className={cn(
                'relative flex overflow-hidden rounded-lg bg-white ring-1 ring-stone-200/80',
                'shadow-xs transition-colors hover:ring-amber-300',
            )}
        >
            {/* Status-stripe til venstre — endrer ikke node-høyden. */}
            <span aria-hidden className={cn('w-1 shrink-0', stripeFarge(status))} />
            <div className="min-w-0 flex-1 divide-y divide-stone-100">
                <TeamRad tla={home} score={homeScore} locale={locale} vinner={homeVinner} visScore={visScore} />
                <TeamRad tla={away} score={awayScore} locale={locale} vinner={awayVinner} visScore={visScore} />
            </div>
            {live && (
                <span
                    aria-label="Pågår"
                    className="absolute right-1 top-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
                />
            )}
        </NextLink>
    )
}
