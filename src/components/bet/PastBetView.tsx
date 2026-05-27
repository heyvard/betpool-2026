import dayjs from 'dayjs'
import NextLink from 'next/link'
import { MatchBetMedScore } from '../../queries/useAllBets'
import { fixLand } from './BetView'
import { rundeTilTekst } from '../../utils/rundeTilTekst'
import React from 'react'
import nb from 'dayjs/locale/nb'
import fr from 'dayjs/locale/fr'
import { Calendar, CheckCheck, ChevronRight, Flag, Target, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { erNorgeKamp } from '../../data/matches'
import { useLanguage } from '../../i18n/LanguageContext'

interface StatusStyle {
    stripe: string
    badge: string
    badgeIcon: React.ReactNode
    bg: string
    poengTone: string
}

const STATUS: Record<'riktigResultat' | 'riktigUtfall' | 'bom', StatusStyle> = {
    riktigResultat: {
        stripe: 'bg-emerald-500',
        badge: 'bg-emerald-100 text-emerald-800',
        badgeIcon: <CheckCheck className="w-3 h-3" />,
        bg: 'bg-emerald-50/40',
        poengTone: 'bg-amber-100 text-amber-900 ring-amber-200',
    },
    riktigUtfall: {
        stripe: 'bg-amber-500',
        badge: 'bg-amber-100 text-amber-800',
        badgeIcon: <Target className="w-3 h-3" />,
        bg: 'bg-amber-50/30',
        poengTone: 'bg-amber-100 text-amber-900 ring-amber-200',
    },
    bom: {
        stripe: 'bg-stone-300',
        badge: 'bg-stone-100 text-stone-600',
        badgeIcon: <X className="w-3 h-3" />,
        bg: 'bg-white',
        poengTone: 'bg-stone-100 text-stone-600 ring-stone-200',
    },
}

function statusStyle(bet: MatchBetMedScore): StatusStyle {
    if (bet.riktigResultat) return STATUS.riktigResultat
    if (bet.riktigUtfall) return STATUS.riktigUtfall
    return STATUS.bom
}

export const PastBetView = ({ bet, matchside, navn }: { bet: MatchBetMedScore; matchside: boolean; navn: string }) => {
    const { t, locale } = useLanguage()
    const dayjsLocale = locale === 'fr' ? fr : nb
    const kampstart = dayjs(bet.game_start)
    const s = statusStyle(bet)
    const harPoeng = bet.poeng > 0

    const badgeText = bet.riktigResultat
        ? t.spilteKamper.riktigResultat
        : bet.riktigUtfall
          ? t.spilteKamper.riktigUtfall
          : t.spilteKamper.bom

    return (
        <div className={cn('relative my-4 rounded-xl shadow-xs ring-1 ring-stone-200/70 overflow-hidden', s.bg)}>
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
                        {badgeText}
                    </span>
                    {matchside ? (
                        <span className="text-xs font-medium text-stone-700 truncate">{navn}</span>
                    ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 truncate">
                            {rundeTilTekst(bet.round, locale)}
                        </span>
                    )}
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                    {kampstart.locale(dayjsLocale).format('ddd D. MMM HH:mm')}
                </span>
            </div>

            <div className="pl-5 pr-4 border-y border-stone-100 divide-y divide-stone-100 bg-white/40">
                <ResultRow team={bet.home_team} score={bet.home_score} locale={locale} />
                <ResultRow team={bet.away_team} score={bet.away_score} locale={locale} />
            </div>

            <div className="flex items-center justify-between gap-3 pl-5 pr-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <span
                        className={cn(
                            'bp-tabular inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                            s.poengTone,
                        )}
                    >
                        {harPoeng ? `+${bet.poeng}` : bet.poeng} {t.felles.poeng}
                    </span>
                    {bet.joker && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                            <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                            {t.spilteKamper.jokerDobbel}
                        </span>
                    )}
                    {erNorgeKamp(bet.home_team, bet.away_team) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800 ring-1 ring-red-200">
                            <Flag className="w-3 h-3" />
                            {t.spilteKamper.norgeDobbel}
                        </span>
                    )}
                </div>
                {!matchside && (
                    <NextLink
                        href={'/match/' + bet.match_num}
                        className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors"
                    >
                        {t.spilteKamper.seAllesBets}
                        <ChevronRight className="w-3.5 h-3.5" />
                    </NextLink>
                )}
            </div>
        </div>
    )
}

function ResultRow({ team, score, locale }: { team: string; score: number | null; locale: 'no' | 'fr' }) {
    return (
        <div className="flex items-center justify-between gap-3 py-3">
            <span className="text-lg font-semibold text-stone-900 truncate">{fixLand(team, locale)}</span>
            <span className="bp-tabular w-14 text-center text-2xl font-semibold text-stone-900">{score ?? '–'}</span>
        </div>
    )
}
