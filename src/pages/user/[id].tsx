import type { NextPage } from 'next'

import { Spinner } from '../../components/loading/Spinner'
import dayjs from 'dayjs'
import { useRouter } from 'next/router'
import { UseAllBets, MatchBetMedScore } from '../../queries/useAllBets'
import React from 'react'
import { fixLand } from '../../components/bet/BetView'
import NextLink from 'next/link'
import { BpCard } from '../../components/Card'
import { Alert } from '@/components/ui/alert'
import { Link } from '@/components/ui/typography'
import { useLanguage } from '../../i18n/LanguageContext'
import { rundeTilTekst } from '../../utils/rundeTilTekst'
import { erNorgeKamp } from '../../data/matches'
import { CheckCheck, ChevronRight, Target, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import nb from 'dayjs/locale/nb'
import frLocale from 'dayjs/locale/fr'

type Treff = 'resultat' | 'utfall' | 'bom'

function getTreff(bet: MatchBetMedScore): Treff {
    if (bet.riktigResultat) return 'resultat'
    if (bet.riktigUtfall) return 'utfall'
    return 'bom'
}

const TREFF_STILAR: Record<Treff, { tippBg: string; tippInk: string; tippRamme: string; poengInk: string }> = {
    resultat: {
        tippBg: 'bg-emerald-100',
        tippInk: 'text-emerald-700',
        tippRamme: '',
        poengInk: 'text-emerald-700',
    },
    utfall: {
        tippBg: 'bg-amber-100',
        tippInk: 'text-amber-800',
        tippRamme: '',
        poengInk: 'text-amber-800',
    },
    bom: {
        tippBg: 'bg-stone-100',
        tippInk: 'text-stone-500',
        tippRamme: 'ring-1 ring-stone-200',
        poengInk: 'text-stone-500',
    },
}

function Avatar({ src, name }: { src?: string | null; name?: string }) {
    if (src) {
        return <img src={src} alt={name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
    }
    return (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
            {name ? name.charAt(0).toUpperCase() : '?'}
        </div>
    )
}

function ScoreBlokk({ children, className }: { children: React.ReactNode; className: string }) {
    return (
        <span
            className={cn(
                'bp-tabular flex w-full items-center justify-center rounded-md py-0.5 text-[13px] font-bold',
                className,
            )}
        >
            {children}
        </span>
    )
}

function KolonneHode() {
    const { t } = useLanguage()
    return (
        <div className="grid items-center gap-2 px-3 py-1.5" style={{ gridTemplateColumns: '1fr 46px 46px 30px 12px' }}>
            <div />
            <div className="bp-overline text-center">{t.spilteKamper.kolFasit}</div>
            <div className="bp-overline text-center">{t.spilteKamper.kolDitt}</div>
            <div className="bp-overline text-right">{t.spilteKamper.kolPoeng}</div>
            <div />
        </div>
    )
}

function ResultatRad({ bet }: { bet: MatchBetMedScore }) {
    const { t, locale } = useLanguage()
    const dayjsLocale = locale === 'fr' ? frLocale : nb
    const kampstart = dayjs(bet.game_start)
    const erLive = bet.foreløpig === true
    const harTipp = bet.home_score !== null && bet.away_score !== null
    const harFasit = bet.home_result !== ''
    const harJoker = bet.joker
    const harNorge = erNorgeKamp(bet.home_team, bet.away_team)

    const treff = !erLive && harTipp ? getTreff(bet) : null
    const stil = treff ? TREFF_STILAR[treff] : null

    return (
        <NextLink
            href={'/match/' + bet.match_num}
            aria-label={`${t.spilteKamper.seAllesBets}: ${fixLand(bet.home_team, locale)} – ${fixLand(bet.away_team, locale)}`}
            className="block cursor-pointer transition-colors hover:bg-stone-50 active:bg-stone-100"
        >
            <div
                className="grid min-h-[40px] items-center gap-2 border-t border-stone-100 px-3 py-2"
                style={{ gridTemplateColumns: '1fr 46px 46px 30px 12px' }}
            >
                {/* Col 1: Kampinfo */}
                <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1">
                        <span className="truncate text-[12.5px] font-bold leading-tight text-stone-900">
                            {fixLand(bet.home_team, locale)}
                            <span className="mx-0.5 text-stone-300">–</span>
                            {fixLand(bet.away_team, locale)}
                        </span>
                        {harJoker && (
                            <span
                                className="shrink-0 rounded-full bg-amber-100 px-1 py-0.5 text-[9px] font-bold leading-none text-amber-800"
                                title={t.spilteKamper.jokerDobbel}
                            >
                                ×2
                            </span>
                        )}
                        {harNorge && !harJoker && (
                            <span
                                className="shrink-0 rounded-full bg-red-100 px-1 py-0.5 text-[9px] font-bold leading-none text-red-800"
                                title={t.spilteKamper.norgeDobbel}
                            >
                                ×2
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] leading-tight text-stone-400">
                        {kampstart.locale(dayjsLocale).format('HH:mm')}
                    </div>
                </div>

                {/* Col 2: Fasit */}
                <div>
                    {erLive ? (
                        <ScoreBlokk className="gap-1 bg-red-600 text-white">
                            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-white" />
                            {bet.home_result}–{bet.away_result}
                        </ScoreBlokk>
                    ) : harFasit ? (
                        <ScoreBlokk className="bg-stone-900 text-white">
                            {bet.home_result}–{bet.away_result}
                        </ScoreBlokk>
                    ) : (
                        <ScoreBlokk className="bg-stone-100 text-stone-400">–</ScoreBlokk>
                    )}
                </div>

                {/* Col 3: Ditt tipp */}
                <div>
                    {erLive && harTipp ? (
                        <ScoreBlokk className="bg-stone-100 text-stone-600">
                            {bet.home_score}–{bet.away_score}
                        </ScoreBlokk>
                    ) : stil && harTipp ? (
                        <ScoreBlokk className={cn(stil.tippBg, stil.tippInk, stil.tippRamme)}>
                            {bet.home_score}–{bet.away_score}
                        </ScoreBlokk>
                    ) : (
                        <ScoreBlokk className="bg-stone-100 text-stone-400">–</ScoreBlokk>
                    )}
                </div>

                {/* Col 4: Poeng */}
                <div className="flex justify-end">
                    {erLive ? (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                    ) : stil ? (
                        <span className={cn('bp-tabular text-right text-[13px] font-bold', stil.poengInk)}>
                            +{bet.poeng}
                        </span>
                    ) : (
                        <span className="bp-tabular text-right text-[13px] font-bold text-stone-400">–</span>
                    )}
                </div>

                {/* Col 5: Chevron */}
                <div className="flex justify-center">
                    <ChevronRight size={13} className="shrink-0 text-stone-300" />
                </div>
            </div>
        </NextLink>
    )
}

function RundeSeksjon({ runde, bets }: { runde: number; bets: MatchBetMedScore[] }) {
    const { locale } = useLanguage()
    const dayjsLocale = locale === 'fr' ? frLocale : nb
    const sorterteBets = [...bets].sort((a, b) => dayjs(a.game_start).unix() - dayjs(b.game_start).unix())
    const forsteBet = sorterteBets[0]
    const rundeSum = bets.filter((b) => !b.foreløpig).reduce((sum, b) => sum + b.poeng, 0)
    const rundeDato = dayjs(forsteBet.game_start).locale(dayjsLocale).format('dd. D. MMMM')

    return (
        <div className="mt-3.5">
            <div className="flex items-center justify-between px-4 pb-1.5">
                <span className="bp-overline whitespace-nowrap">{rundeTilTekst(runde, locale)}</span>
                <span className="shrink-0 whitespace-nowrap text-[11px] font-bold text-stone-400">
                    {rundeDato} · <span className="text-amber-700">+{rundeSum}</span>
                </span>
            </div>
            <div className="border-y border-stone-200 bg-white">
                <KolonneHode />
                {sorterteBets.map((bet) => (
                    <ResultatRad key={bet.match_num} bet={bet} />
                ))}
            </div>
        </div>
    )
}

const Home: NextPage = () => {
    const { data, isLoading } = UseAllBets()
    const { t, locale } = useLanguage()

    const router = useRouter()
    const { id } = router.query

    if (!data || isLoading) {
        return <Spinner />
    }

    const user = data.users.find((a) => a.id == id)!
    const brukerBets = data.bets.filter((a) => a.user_id == id)
    const totalPoeng = brukerBets.filter((b) => !b.foreløpig).reduce((sum, b) => sum + b.poeng, 0)
    const runder = Array.from(new Set(brukerBets.map((b) => b.round))).sort((a, b) => b - a)

    // Subtitle: extract the non-name part of the resultater template
    const subtittel = t.spilteKamper.resultater.replace('{{navn}}', '').trim()

    return (
        <>
            {/* Profil-header */}
            <div className="border-b border-stone-200 bg-white px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                    <Avatar src={user.picture} name={user.name} />
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-[17px] font-extrabold leading-tight tracking-tight text-stone-900">
                            {user.name}
                        </div>
                        <div className="text-[11.5px] text-stone-500">{subtittel}</div>
                    </div>
                    <div className="shrink-0 text-right">
                        <div className="bp-tabular text-[22px] font-extrabold leading-none text-amber-700">
                            {totalPoeng}
                        </div>
                        <div className="bp-overline mt-0.5">{t.spilteKamper.poengTotalt}</div>
                    </div>
                </div>
            </div>

            {/* Vinner/toppscorer-rad (uendret) */}
            {user.winner && (
                <BpCard>
                    <NextLink href="/winnerbets">
                        <Link>
                            {t.spilteKamper.vinner} {fixLand(user.winner || '', locale)} ({user.winnerPoints}{' '}
                            {t.felles.poeng})
                        </Link>
                    </NextLink>
                    <br />
                    <NextLink href="/toppscorer">
                        <Link>
                            {t.spilteKamper.toppscorer} {user.topscorer} ({user.topscorerPoints} {t.felles.poeng})
                        </Link>
                    </NextLink>
                </BpCard>
            )}

            {brukerBets.length === 0 && <Alert variant="info">{t.spilteKamper.ingenResultater}</Alert>}

            {/* Runder, nyeste først */}
            {runder.map((runde) => (
                <RundeSeksjon key={runde} runde={runde} bets={brukerBets.filter((b) => b.round === runde)} />
            ))}

            {/* Legende */}
            {brukerBets.length > 0 && (
                <div className="mb-4 mt-6 flex items-center justify-center gap-4 text-[11px] text-stone-400">
                    <span className="flex items-center gap-1">
                        <CheckCheck size={10} className="text-emerald-600" />
                        <span className="text-emerald-700">{t.spilteKamper.riktigResultat}</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <Target size={10} className="text-amber-600" />
                        <span className="text-amber-800">{t.spilteKamper.riktigUtfall}</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <X size={10} className="text-stone-400" />
                        <span>{t.spilteKamper.bom}</span>
                    </span>
                </div>
            )}
        </>
    )
}

export default Home
