import dayjs from 'dayjs'
import NextLink from 'next/link'
import { MatchBetMedScore } from '../../queries/useAllBets'
import { hentFlag, hentNavn } from '../../utils/lag'
import { rundeTilTekst } from '../../utils/rundeTilTekst'
import React from 'react'
import nb from 'dayjs/locale/nb'
import fr from 'dayjs/locale/fr'
import { CheckCheck, ChevronRight, Target, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { erNorgeKamp } from '../../data/matches'
import { useLanguage } from '../../i18n/LanguageContext'

type Verdikt = 'resultat' | 'utfall' | 'bom'

function getVerdikt(bet: MatchBetMedScore): Verdikt {
    if (bet.riktigResultat) return 'resultat'
    if (bet.riktigUtfall) return 'utfall'
    return 'bom'
}

const VERDIKT_STYLE: Record<Verdikt, { tippBg: string; tippText: string; tippRing: string; poengText: string }> = {
    resultat: {
        tippBg: 'bg-[#dcfce7]',
        tippText: 'text-[#15803d]',
        tippRing: '',
        poengText: 'text-[#15803d]',
    },
    utfall: {
        tippBg: 'bg-[#fef3c7]',
        tippText: 'text-[#92400e]',
        tippRing: '',
        poengText: 'text-[#92400e]',
    },
    bom: {
        tippBg: 'bg-[#f5f5f4]',
        tippText: 'text-[#78716c]',
        tippRing: 'ring-1 ring-[#e7e5e4]',
        poengText: 'text-[#78716c]',
    },
}

function FasitBlokk({ bet }: { bet: MatchBetMedScore }) {
    const base =
        'bp-tabular font-mono text-[13px] font-bold rounded-[6px] py-[3px] px-1.5 flex items-center justify-center min-w-[38px]'
    if (bet.foreløpig) {
        return (
            <div className="flex justify-center">
                <span className={cn(base, 'bg-[#dc2626] text-white')}>
                    {bet.home_result}–{bet.away_result}
                </span>
            </div>
        )
    }
    return (
        <div className="flex justify-center">
            <span className={cn(base, 'bg-[#1c1917] text-white')}>
                {bet.home_result}–{bet.away_result}
            </span>
        </div>
    )
}

function TippBlokk({ bet, verdikt }: { bet: MatchBetMedScore; verdikt: Verdikt }) {
    const base =
        'bp-tabular font-mono text-[13px] font-bold rounded-[6px] py-[3px] px-1.5 flex items-center justify-center min-w-[38px]'
    const hasScore = bet.home_score !== null && bet.away_score !== null

    if (!hasScore) {
        return (
            <div className="flex justify-center">
                <span className={cn(base, 'bg-[#f5f5f4] text-[#a8a29e]')}>–</span>
            </div>
        )
    }
    if (bet.foreløpig) {
        return (
            <div className="flex justify-center">
                <span className={cn(base, 'bg-[#f5f5f4] text-[#dc2626]')}>
                    {bet.home_score}–{bet.away_score}
                </span>
            </div>
        )
    }
    const s = VERDIKT_STYLE[verdikt]
    return (
        <div className="flex justify-center">
            <span className={cn(base, s.tippBg, s.tippText, s.tippRing)}>
                {bet.home_score}–{bet.away_score}
            </span>
        </div>
    )
}

export function ResultatRad({ bet, locale }: { bet: MatchBetMedScore; locale: 'no' | 'fr' }) {
    const { t } = useLanguage()
    const dayjsLocale = locale === 'fr' ? fr : nb
    const verdikt = getVerdikt(bet)
    const s = VERDIKT_STYLE[verdikt]
    const norgeKamp = erNorgeKamp(bet.home_team, bet.away_team)
    const harDobling = bet.joker || norgeKamp
    const homeNavn = hentNavn(bet.home_team, locale)
    const awayNavn = hentNavn(bet.away_team, locale)
    const homeFlag = hentFlag(bet.home_team)
    const awayFlag = hentFlag(bet.away_team)
    const klokkeslett = dayjs(bet.game_start).locale(dayjsLocale).format('HH:mm')
    const dobbelTitle = bet.joker ? t.spilteKamper.jokerDobbel : t.spilteKamper.norgeDobbel
    const poengTekst = bet.poeng > 0 ? `+${bet.poeng}` : `${bet.poeng}`

    return (
        <NextLink
            href={'/match/' + bet.match_num}
            aria-label={`${t.spilteKamper.seAllesBets} – ${homeNavn} – ${awayNavn}`}
            className="grid grid-cols-[1fr_46px_46px_30px_12px] gap-2 items-center px-[13px] py-[7px] min-h-[40px] border-t border-[#f0efed] hover:bg-[#fafaf9] active:bg-[#f5f5f4] cursor-pointer transition-colors"
        >
            <div className="min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[12.5px] font-bold text-[#1c1917] leading-tight min-w-0 truncate">
                        {homeFlag} {homeNavn}
                        <span className="text-[#d6d3d1]"> – </span>
                        {awayNavn} {awayFlag}
                    </span>
                    {harDobling && (
                        <span
                            title={dobbelTitle}
                            className="shrink-0 text-[9px] font-bold text-[#92400e] bg-[#fef3c7] rounded-full px-1 py-px leading-none"
                        >
                            ×2
                        </span>
                    )}
                </div>
                <div className="text-[10px] text-[#a8a29e] leading-tight mt-px">{klokkeslett}</div>
            </div>

            <FasitBlokk bet={bet} />
            <TippBlokk bet={bet} verdikt={verdikt} />

            <div
                className={cn(
                    'bp-tabular text-[13px] font-bold text-right',
                    bet.foreløpig ? 'text-[#a8a29e]' : s.poengText,
                )}
            >
                {bet.foreløpig ? '–' : poengTekst}
            </div>

            <ChevronRight className="w-[13px] h-[13px] text-[#cbc9c4]" />
        </NextLink>
    )
}

export function RundeSeksjon({
    runde,
    bets,
    locale,
}: {
    runde: number
    bets: MatchBetMedScore[]
    locale: 'no' | 'fr'
}) {
    const { t } = useLanguage()
    const dayjsLocale = locale === 'fr' ? fr : nb
    const rundeNavn = rundeTilTekst(runde, locale).toUpperCase()
    const rundeSum = bets.filter((b) => !b.foreløpig).reduce((sum, b) => sum + b.poeng, 0)
    const datoTekst = dayjs(bets[0].game_start).locale(dayjsLocale).format('dd. D. MMMM')

    return (
        <div>
            <div className="flex items-baseline justify-between px-4 pt-[15px] pb-[6px]">
                <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[#a8a29e] whitespace-nowrap">
                    {rundeNavn}
                </span>
                <span className="text-[11px] font-bold text-[#a8a29e] whitespace-nowrap ml-2">
                    {datoTekst} · <span className="text-[#b45309]">+{rundeSum}</span>
                </span>
            </div>

            <div className="border-t border-b border-[#e7e5e4] bg-white">
                <div className="grid grid-cols-[1fr_46px_46px_30px_12px] gap-2 items-center px-[13px] pt-[7px] pb-[5px]">
                    <div />
                    <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[#a8a29e] text-center">
                        {t.spilteKamper.kolFasit}
                    </div>
                    <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[#a8a29e] text-center">
                        {t.spilteKamper.kolDitt}
                    </div>
                    <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[#a8a29e] text-right">
                        {t.spilteKamper.kolPoeng}
                    </div>
                    <div />
                </div>

                {bets.map((bet) => (
                    <ResultatRad key={`${bet.match_num}-${bet.user_id}`} bet={bet} locale={locale} />
                ))}
            </div>
        </div>
    )
}

export function Legende() {
    const { t } = useLanguage()
    return (
        <div className="flex items-center justify-center gap-4 mt-6 mb-2 text-[11px] text-[#a8a29e]">
            <span className="flex items-center gap-1">
                <CheckCheck className="w-3 h-3 text-[#16a34a]" />
                <span className="text-[#15803d]">{t.spilteKamper.riktigResultat}</span>
            </span>
            <span className="flex items-center gap-1">
                <Target className="w-3 h-3 text-[#f59e0b]" />
                <span className="text-[#92400e]">{t.spilteKamper.riktigUtfall}</span>
            </span>
            <span className="flex items-center gap-1">
                <X className="w-3 h-3 text-[#d6d3d1]" />
                <span className="text-[#78716c]">{t.spilteKamper.bom}</span>
            </span>
        </div>
    )
}
