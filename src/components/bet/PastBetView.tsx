import dayjs from 'dayjs'
import NextLink from 'next/link'
import { MatchBetMedScore } from '../../queries/useAllBets'
import { fixLand } from './BetView'
import { rundeTilTekst } from '../../utils/rundeTilTekst'
import React from 'react'
import nb from 'dayjs/locale/nb'
import { Calendar, CheckCheck, ChevronRight, Target, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatusStyle {
    stripe: string
    badge: string
    badgeText: string
    badgeIcon: React.ReactNode
    bg: string
    poengTone: string
}

function statusStyle(bet: MatchBetMedScore): StatusStyle {
    if (bet.riktigResultat) {
        return {
            stripe: 'bg-emerald-500',
            badge: 'bg-emerald-100 text-emerald-800',
            badgeText: 'Riktig resultat',
            badgeIcon: <CheckCheck className="w-3 h-3" />,
            bg: 'bg-emerald-50/40',
            poengTone: 'bg-amber-100 text-amber-900 ring-amber-200',
        }
    }
    if (bet.riktigUtfall) {
        return {
            stripe: 'bg-amber-500',
            badge: 'bg-amber-100 text-amber-800',
            badgeText: 'Riktig utfall',
            badgeIcon: <Target className="w-3 h-3" />,
            bg: 'bg-amber-50/30',
            poengTone: 'bg-amber-100 text-amber-900 ring-amber-200',
        }
    }
    return {
        stripe: 'bg-stone-300',
        badge: 'bg-stone-100 text-stone-600',
        badgeText: 'Bom',
        badgeIcon: <X className="w-3 h-3" />,
        bg: 'bg-white',
        poengTone: 'bg-stone-100 text-stone-600 ring-stone-200',
    }
}

export const PastBetView = ({ bet, matchside, navn }: { bet: MatchBetMedScore; matchside: boolean; navn: string }) => {
    const kampstart = dayjs(bet.game_start)
    const s = statusStyle(bet)
    const harPoeng = bet.poeng > 0

    return (
        <div
            className={cn(
                'relative my-4 rounded-xl shadow-sm ring-1 ring-stone-200/70 overflow-hidden',
                s.bg,
            )}
        >
            <span aria-hidden className={cn('absolute left-0 top-0 bottom-0 w-1', s.stripe)} />

            <div className="flex items-center justify-between gap-2 pl-5 pr-4 pt-3 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span
                        className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            s.badge,
                        )}
                    >
                        {s.badgeIcon}
                        {s.badgeText}
                    </span>
                    {matchside ? (
                        <span className="text-xs font-medium text-stone-700 truncate">{navn}</span>
                    ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 truncate">
                            {rundeTilTekst(bet.round)}
                        </span>
                    )}
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                    {kampstart.locale(nb).format('ddd D. MMM HH:mm')}
                </span>
            </div>

            <div className="pl-5 pr-4 border-y border-stone-100 divide-y divide-stone-100 bg-white/40">
                <ResultRow team={bet.home_team} score={bet.home_score} />
                <ResultRow team={bet.away_team} score={bet.away_score} />
            </div>

            <div className="flex items-center justify-between gap-3 pl-5 pr-4 py-3">
                <span
                    className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 tabular-nums',
                        s.poengTone,
                    )}
                >
                    {harPoeng ? `+${bet.poeng}` : bet.poeng} poeng
                </span>
                {!matchside && (
                    <NextLink
                        href={'/match/' + bet.match_num}
                        className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors"
                    >
                        Se alles bets
                        <ChevronRight className="w-3.5 h-3.5" />
                    </NextLink>
                )}
            </div>
        </div>
    )
}

function ResultRow({ team, score }: { team: string; score: number | null }) {
    return (
        <div className="flex items-center justify-between gap-3 py-3">
            <span className="text-lg font-semibold text-stone-900 truncate">{fixLand(team)}</span>
            <span className="text-2xl font-semibold text-stone-900 tabular-nums w-14 text-center">
                {score ?? '–'}
            </span>
        </div>
    )
}
