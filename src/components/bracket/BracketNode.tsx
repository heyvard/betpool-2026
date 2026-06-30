import React from 'react'
import NextLink from 'next/link'
import dayjs from 'dayjs'
import 'dayjs/locale/nb'
import { Match, MatchStatus } from '../../types/types'
import { hentFlag, hentNavn } from '../../utils/lag'
import { cn } from '@/lib/utils'
import { BracketSlot } from '../../data/bracket'

type Locale = 'no' | 'fr'

// Faste mål slik at kolonnene kan plassere nodene matematisk midt mellom
// feederne sine (se Bracket.tsx). Node-høyden er konstant uavhengig av status, så
// status vises som en venstre-stripe (ikke en ekstra rad som ville endret høyden).
export const NODE_BREDDE = 168 // px
export const RAD_HOYDE = 24 // px per lag-rad
export const NODE_HOYDE = 92 // px (konstant uansett status)

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
        <div className="flex items-center gap-1.5 px-2" style={{ height: RAD_HOYDE }}>
            <span className="text-sm leading-none">{harLag ? hentFlag(tla) : '⚪️'}</span>
            <span
                className={cn(
                    'min-w-0 flex-1 truncate text-xs leading-none',
                    vinner ? 'font-bold text-stone-900' : 'text-stone-600',
                )}
            >
                {harLag ? hentNavn(tla, locale) : '—'}
            </span>
            {visScore && (
                <span
                    className={cn(
                        'bp-tabular w-3 text-right text-xs tabular-nums',
                        vinner ? 'text-stone-900' : 'text-stone-400',
                    )}
                >
                    {score ?? ''}
                </span>
            )}
        </div>
    )
}

/**
 * Én kamp i bracketen. Hele noden er en lenke til kampsiden `/match/[match_num]`
 * der tipp-/poeng-detaljene ligger. Tre soner med konstant total høyde:
 *   A) topplinje — spilt-tidspunkt (kun ferdige/live kamper),
 *   B) lagradene — flagg + navn + skår (ordinær tid, det vi tipper på),
 *   C) resultatlinje — for kommende kamper kamptidspunkt (blått), for spilte
 *      kamper en kompakt linje som navngir hva som avgjorde (90 min / e.o. / str)
 *      + flagget til laget som gikk videre.
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
    const sluttspill = match?.sluttspill ?? null

    const ferdig = erFerdig(status)
    const live = erLive(status)
    const harScore = homeScore !== null && awayScore !== null
    const visScore = harScore && (ferdig || live)

    // Hvem gikk videre — prioritert: sluttspill-vinner, ellers høyest 90-min-skår.
    const vinnerSide: 'home' | 'away' | null = sluttspill
        ? sluttspill.vinner
        : ferdig && harScore && homeScore !== awayScore
          ? homeScore > awayScore
              ? 'home'
              : 'away'
          : null
    const homeVinner = vinnerSide === 'home'
    const awayVinner = vinnerSide === 'away'

    // Sone C — innhold for spilte kamper: label + verdi.
    let footerLabel = ''
    let footerVerdi = ''
    if (sluttspill?.avgjortPa === 'straffer' && sluttspill.straffer) {
        footerLabel = 'str'
        footerVerdi = `${sluttspill.straffer[0]}–${sluttspill.straffer[1]}`
    } else if (sluttspill?.avgjortPa === 'ekstraomganger') {
        footerLabel = 'e.o.'
        footerVerdi = `${sluttspill.etter120[0]}–${sluttspill.etter120[1]}`
    } else if (harScore) {
        footerLabel = '90 min'
        footerVerdi = `${homeScore}–${awayScore}`
    }

    const vinnerTla = vinnerSide === 'home' ? home : vinnerSide === 'away' ? away : null
    const vinnerHarLag = vinnerTla != null && vinnerTla !== '' && vinnerTla !== 'To be announced'

    return (
        <NextLink
            href={`/match/${slot.matchNum}`}
            style={{ width: NODE_BREDDE, height: NODE_HOYDE }}
            className={cn(
                'relative flex overflow-hidden rounded-[11px] bg-white ring-1 ring-stone-200',
                'transition-colors hover:ring-amber-300',
            )}
        >
            {/* Status-stripe til venstre — endrer ikke node-høyden. */}
            <span aria-hidden className={cn('w-1 shrink-0', stripeFarge(status))} />
            <div className="flex min-w-0 flex-1 flex-col">
                {/* Sone A — topplinje: spilt-tidspunkt (kun ferdige/live). */}
                {harScore && (ferdig || live) && match && (
                    <div className="flex h-[18px] items-center justify-end border-b border-stone-100 px-2">
                        <span className="whitespace-nowrap text-[9.5px] tabular-nums text-stone-400">
                            {dayjs(match.game_start).locale('nb').format('D.MM · HH:mm')}
                        </span>
                    </div>
                )}

                {/* Sone B — lagrader, sentrert. */}
                <div className="flex flex-1 flex-col justify-center">
                    <TeamRad tla={home} score={homeScore} locale={locale} vinner={homeVinner} visScore={visScore} />
                    <div className="border-t border-stone-100" />
                    <TeamRad tla={away} score={awayScore} locale={locale} vinner={awayVinner} visScore={visScore} />
                </div>

                {/* Sone C — resultatlinje (footer). */}
                {!ferdig && !live ? (
                    <div className="flex h-[23px] items-center justify-center border-t border-stone-100 bg-white px-2">
                        <span className="whitespace-nowrap text-[11px] font-semibold text-blue-700">
                            {match ? dayjs(match.game_start).locale('nb').format('ddd D. MMM · HH:mm') : ''}
                        </span>
                    </div>
                ) : (
                    <div className="flex h-[23px] items-center gap-1.5 border-t border-stone-100 bg-stone-50 px-2">
                        {live ? (
                            <>
                                <span className="text-[8.5px] font-extrabold uppercase tracking-[0.06em] text-amber-600">
                                    nå
                                </span>
                                <span className="text-[11px] font-bold tabular-nums text-stone-700">
                                    {homeScore}–{awayScore}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="text-[8.5px] font-extrabold uppercase tracking-[0.06em] text-stone-400">
                                    {footerLabel}
                                </span>
                                <span className="text-[11px] font-bold tabular-nums text-stone-700">{footerVerdi}</span>
                                {vinnerHarLag && (
                                    <span className="ml-auto text-sm leading-none">{hentFlag(vinnerTla!)}</span>
                                )}
                            </>
                        )}
                    </div>
                )}
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
