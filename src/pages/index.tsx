import type { NextPage } from 'next'

import { UseUser } from '../queries/useUser'

import React, { useState } from 'react'
import { getLagSortert, hentFlag, hentNavn } from '../utils/lag'
import { UseMatches } from '../queries/useMatches'
import { UseMyBets } from '../queries/useMyBets'
import { MatchBetMedScore, UseAllBets } from '../queries/useAllBets'
import { UsePlayers } from '../queries/usePlayers'
import { SpillerVelger } from '../components/SpillerVelger'
import dayjs from 'dayjs'
import NextLink from 'next/link'
import { useAuthedFetch } from '../auth/authedFetch'
import {
    Check,
    CheckCheck,
    ChevronRight,
    Clock,
    Goal,
    ListChecks,
    Lock,
    Target,
    Trophy,
    TriangleAlert,
    X,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import nb from 'dayjs/locale/nb'
import fr from 'dayjs/locale/fr'
import { beregnFrister, erEtterFørsteRunde, erIEndrevindu } from '../utils/fristDatoer'
import { erKampFerdig } from '../data/matches'
import { nå } from '../utils/testClock'
import { LoadingScreen } from '../components/loading/LoadingScreen'
import { VarslerHint } from '../components/VarslerHint'
import { Alert } from '@/components/ui/alert'
import { KopierNummerKnapp } from '../components/KopierNummerKnapp'
import { LinkPanel } from '@/components/ui/link-panel'
import { cn } from '@/lib/utils'
import { User } from '../types/user'
import { useLanguage } from '../i18n/LanguageContext'
import type { Locale } from '../i18n/LanguageContext'
import type { Translations } from '../i18n/no'
import { tx } from '../i18n/interpolate'
import type { Bet } from '../types/types'

function fixLandMedLocale(s: string, locale: 'no' | 'fr') {
    if (s === 'To be announced') return 'TBA'
    return hentFlag(s) + ' ' + hentNavn(s, locale)
}

const Home: NextPage = () => {
    const { data: megselv } = UseUser()
    const { data: matches, isLoading } = UseMatches()
    const { t, locale } = useLanguage()
    const dayjsLocale = locale === 'fr' ? fr : nb

    if (!matches || isLoading || !megselv) {
        return <LoadingScreen />
    }

    const snartKamper = matches.filter((a) => {
        return dayjs(a.game_start).isAfter(nå()) && dayjs(a.game_start).isBefore(nå().add(2, 'hours'))
    })
    const frister = beregnFrister(matches)
    const laast = erEtterFørsteRunde(frister, nå())
    const endrevindu = erIEndrevindu(frister, nå())
    const lukkerIDag = !laast && frister.forsteRunde != null && frister.forsteRunde.isSame(nå(), 'day')

    return (
        <div className="space-y-4">
            <VarslerHint />
            {lukkerIDag && (
                <Alert variant="warning">
                    <span className="flex items-start gap-2 font-medium">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                        {t.hjem.vinnerToppsLukkerIDag}
                    </span>
                </Alert>
            )}
            {snartKamper.map((k) => (
                <NextLink
                    key={k.match_num}
                    href="/my-bets/"
                    className="block rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200"
                >
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800">
                        <Clock className="h-3.5 w-3.5" />
                        {tx(t.hjem.kampStarterKl, {
                            home: fixLandMedLocale(k.home_team, locale),
                            away: fixLandMedLocale(k.away_team, locale),
                            tid: dayjs(k.game_start).format('HH:mm'),
                        })}
                    </span>
                </NextLink>
            ))}

            {!megselv.paid && megselv.i_hovedliga && <InnbetalingsAlert />}

            <NextLink passHref legacyBehavior href="/my-bets">
                <LinkPanel>
                    <span className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                            <ListChecks className="h-5 w-5" />
                        </span>
                        <span className="flex flex-col">
                            <span className="text-base font-semibold text-stone-900">{t.hjem.tippLenkeTittel}</span>
                            <span className="text-xs text-stone-500">{t.hjem.tippLenkeUndertekst}</span>
                        </span>
                    </span>
                </LinkPanel>
            </NextLink>

            <NesteKampSeksjon />

            <div className="pt-2">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-stone-900">{t.hjem.dineVmTips}</h2>
                    <FristMerke laast={laast} />
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                    {!laast
                        ? tx(t.hjem.kanEndresFremTil, {
                              dato: frister.forsteRunde?.locale(dayjsLocale).format('dddd D. MMM [kl] HH:mm') ?? '',
                          })
                        : endrevindu
                          ? tx(t.hjem.endrevinduFrist, {
                                dato:
                                    frister.endrevinduSlutt?.locale(dayjsLocale).format('dddd D. MMM [kl] HH:mm') ?? '',
                            })
                          : t.hjem.vmIGangLaast}
                </p>
            </div>

            <VinnerKort megselv={megselv} laast={laast} endrevindu={endrevindu} />
            <ToppscorerKort megselv={megselv} laast={laast} endrevindu={endrevindu} />

            <NextLink
                href="/alle-tips"
                className="block text-center text-sm font-semibold text-amber-700 hover:text-amber-800"
            >
                {t.allesTips.seAlleTips}
            </NextLink>
        </div>
    )
}

function KampSeksjonPanel({
    kampene,
    mineBetsMedScore,
    seksjonTittel,
    kampdag,
    visStatusChip,
    bunntekst,
    locale,
    t,
}: {
    kampene: Bet[]
    mineBetsMedScore: Map<number, MatchBetMedScore>
    seksjonTittel: string
    kampdag: dayjs.Dayjs
    visStatusChip: boolean
    bunntekst: string
    locale: Locale
    t: Translations
}) {
    const dayjsLocale = locale === 'fr' ? fr : nb
    const manglerTips = kampene.filter(
        (b) => dayjs(b.game_start).isAfter(nå()) && (b.home_score == null || b.away_score == null),
    ).length
    const altTippet = manglerTips === 0

    return (
        <div className="space-y-2">
            <div className="px-1">
                <h2 className="text-sm font-bold text-stone-900">{seksjonTittel}</h2>
            </div>

            <div className="overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-stone-200/70">
                <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                        {kampdag.locale(dayjsLocale).format('dddd D. MMMM')}
                    </span>
                    {visStatusChip &&
                        (altTippet ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                                <Check className="h-2.5 w-2.5" /> {t.hjem.altTippet}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200">
                                {tx(t.hjem.manglerTips, { n: manglerTips })}
                            </span>
                        ))}
                </div>

                {kampene.map((b) => {
                    const tippet = b.home_score != null && b.away_score != null
                    const startet = dayjs(b.game_start).isBefore(nå())
                    const ferdig = erKampFerdig(b.status)
                    const pågår = startet && !ferdig
                    const scorer = mineBetsMedScore.get(b.match_num)

                    let stripeKlasse: string
                    if (pågår) {
                        stripeKlasse = 'bg-red-500'
                    } else if (ferdig) {
                        if (scorer?.riktigResultat) stripeKlasse = 'bg-emerald-500'
                        else if (scorer?.riktigUtfall) stripeKlasse = 'bg-amber-500'
                        else stripeKlasse = 'bg-stone-300'
                    } else {
                        stripeKlasse = 'bg-amber-200'
                    }

                    let verdiktIkon: React.ReactNode = null
                    let poengFarge = 'text-stone-500'
                    if (ferdig && scorer) {
                        if (scorer.riktigResultat) {
                            verdiktIkon = <CheckCheck className="h-3 w-3 text-emerald-700" />
                            poengFarge = 'text-emerald-700'
                        } else if (scorer.riktigUtfall) {
                            verdiktIkon = <Target className="h-3 w-3 text-amber-700" />
                            poengFarge = 'text-amber-700'
                        } else {
                            verdiktIkon = <X className="h-3 w-3 text-stone-500" />
                        }
                    }

                    return (
                        <NextLink
                            key={b.match_num}
                            href={startet ? '/match/' + b.match_num : '/my-bets#kamp-' + b.match_num}
                            className="flex items-stretch border-b border-stone-100 last:border-b-0 transition-colors hover:bg-stone-50"
                        >
                            <span aria-hidden className={cn('w-[3px] shrink-0 rounded-r', stripeKlasse)} />
                            <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5">
                                <span className="w-8 shrink-0 font-mono text-[11px] tabular-nums text-stone-400">
                                    {dayjs(b.game_start).format('HH:mm')}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-bold text-stone-900">
                                        {hentFlag(b.home_team)} {hentNavn(b.home_team, locale)} –{' '}
                                        {hentFlag(b.away_team)} {hentNavn(b.away_team, locale)}
                                    </p>
                                    {tippet && (
                                        <p className="mt-1 flex items-center gap-1.5 text-[11px]">
                                            <span className="text-stone-500">
                                                {t.hjem.tippet}{' '}
                                                <span className="font-semibold tabular-nums text-stone-600">
                                                    {b.home_score}–{b.away_score}
                                                </span>
                                            </span>
                                            {ferdig && scorer && (
                                                <>
                                                    {verdiktIkon}
                                                    <span className={cn('font-semibold tabular-nums', poengFarge)}>
                                                        {scorer.poeng > 0 ? `+${scorer.poeng}` : scorer.poeng}
                                                    </span>
                                                </>
                                            )}
                                            {pågår && scorer && (
                                                <span className="animate-pulse font-semibold tabular-nums text-red-700">
                                                    {scorer.poeng > 0 ? `+${scorer.poeng}` : scorer.poeng}
                                                </span>
                                            )}
                                        </p>
                                    )}
                                </div>
                                <div className="flex min-w-14 shrink-0 flex-col items-end">
                                    {!startet && (
                                        <>
                                            <span className="bp-tabular text-[15px] font-extrabold leading-none text-stone-400">
                                                {dayjs(b.game_start).format('HH:mm')}
                                            </span>
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
                                                {t.hjem.kickoff}
                                            </span>
                                        </>
                                    )}
                                    {pågår && (
                                        <>
                                            <span className="bp-tabular text-[22px] font-extrabold leading-none text-red-700">
                                                {scorer ? `${scorer.home_result}–${scorer.away_result}` : '–'}
                                            </span>
                                            <span className="mt-0.5 flex items-center gap-1 text-[9px] font-extrabold uppercase text-red-700">
                                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600" />
                                                {t.hjem.paagaar}
                                            </span>
                                        </>
                                    )}
                                    {ferdig && (
                                        <>
                                            <span
                                                className={cn(
                                                    'bp-tabular text-[22px] font-extrabold leading-none',
                                                    scorer?.riktigResultat ? 'text-emerald-700' : 'text-stone-900',
                                                )}
                                            >
                                                {scorer ? `${scorer.home_result}–${scorer.away_result}` : '–'}
                                            </span>
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
                                                {t.hjem.slutt}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </NextLink>
                    )
                })}
            </div>

            <NextLink
                href="/my-bets"
                className="block text-center text-sm font-semibold text-amber-700 hover:text-amber-800"
            >
                {bunntekst}
            </NextLink>
        </div>
    )
}

function NesteKampSeksjon() {
    const { data: bets } = UseMyBets()
    const { data: alleBets } = UseAllBets()
    const { data: megselv } = UseUser()
    const { t, locale } = useLanguage()

    if (!bets) return null

    const mineBetsMedScore = new Map<number, MatchBetMedScore>()
    if (alleBets && megselv) {
        for (const bet of alleBets.bets) {
            if (bet.user_id === megselv.id) {
                mineBetsMedScore.set(bet.match_num, bet)
            }
        }
    }

    // Kamper starter 18:00–06:00 Oslo-tid. Skift 10 timer bakover slik at
    // grensen mellom kampdag og neste kampdag blir kl. 10:00 (morgen) i stedet
    // for midnatt – ellers havner natt-kamper (01:00–06:00 Oslo) på feil dag.
    // Startede/ferdige kamper blir dermed stående til kl. 10:00 dagen etter.
    const kampDag = (d: dayjs.Dayjs) => d.subtract(10, 'hour').startOf('day')

    const kommende = bets
        .filter((b) => dayjs(b.game_start).isAfter(nå()))
        .sort((a, b) => dayjs(a.game_start).valueOf() - dayjs(b.game_start).valueOf())

    const denneDagen = kampDag(nå())
    const iVinduet = bets
        .filter((b) => kampDag(dayjs(b.game_start)).isSame(denneDagen, 'day'))
        .sort((a, b) => dayjs(a.game_start).valueOf() - dayjs(b.game_start).valueOf())

    if (iVinduet.length === 0 && kommende.length === 0) {
        return (
            <NextLink passHref legacyBehavior href="/my-bets">
                <LinkPanel>
                    <span className="flex flex-col">
                        <span className="text-base font-semibold text-stone-900">{t.hjem.ingenFlereKamper}</span>
                        <span className="text-xs text-stone-500">{t.hjem.vmSnartOver}</span>
                    </span>
                </LinkPanel>
            </NextLink>
        )
    }

    // Inneværende kampdag er bare «primær» så lenge den fortsatt har kamper som
    // ikke har startet. En ferdigspilt natt (06:00–10:00, før kampdag-grensen kl.
    // 10:00) skal ikke stå som «Neste kampdag» – da viser vi neste fremtidige
    // kampdag i stedet, og natten flyttes til «Natten som var»-seksjonen under.
    const denneDagenHarKommende = iVinduet.some((b) => dayjs(b.game_start).isAfter(nå()))
    // Når turneringen er ferdig (ingen fremtidige kamper) beholder vi inneværende
    // kampdag, både for å unngå `kommende[0]` på tom liste og for å vise siste dag.
    const brukDenneDagen = denneDagenHarKommende || kommende.length === 0
    const nesteKampDag = brukDenneDagen ? denneDagen : kampDag(dayjs(kommende[0].game_start))
    const kildeListe = brukDenneDagen ? iVinduet : kommende
    const kampene = kildeListe.filter((b) => kampDag(dayjs(b.game_start)).isSame(nesteKampDag, 'day'))

    const manglerTips = kampene.filter(
        (b) => dayjs(b.game_start).isAfter(nå()) && (b.home_score == null || b.away_score == null),
    ).length
    const altTippet = manglerTips === 0

    // «Natten som var»: den siste kampdagen med kamper som har startet, vist så
    // lenge den er forskjellig fra primær-seksjonen og fortsatt er «fersk». En
    // kampdag er aktiv fra kl. 10:00 til kl. 10:00 dagen etter (10-timers
    // forskyvningen over); vi viser den i tillegg helt frem til kl. 12:00
    // (kampdag + 36 t) som en kort morgen-hale.
    //
    // Vinduet var tidligere låst til klokkeslett 06:00–12:00. Siden VM-kampene
    // spilles 18:00–06:00 norsk tid, ble inneværende kampdag demotert idet siste
    // kamp sparket i gang (ofte 02:00–05:00), mens «Natten som var» først slo inn
    // kl. 06:00 – så nettopp spilte/pågående nattkamper forsvant helt i mellomtiden.
    let forrigeKampDag: dayjs.Dayjs | null = null
    let forrigeKampene: Bet[] = []

    const spilte = bets
        .filter((b) => dayjs(b.game_start).isBefore(nå()))
        .sort((a, b) => dayjs(b.game_start).valueOf() - dayjs(a.game_start).valueOf())

    if (spilte.length > 0) {
        const sisteDag = kampDag(dayjs(spilte[0].game_start))
        const visesTil = sisteDag.add(36, 'hour')
        if (!sisteDag.isSame(nesteKampDag, 'day') && nå().isBefore(visesTil)) {
            forrigeKampDag = sisteDag
            forrigeKampene = bets
                .filter((b) => kampDag(dayjs(b.game_start)).isSame(sisteDag, 'day'))
                .sort((a, b) => dayjs(a.game_start).valueOf() - dayjs(b.game_start).valueOf())
        }
    }

    return (
        <div className="space-y-4">
            {forrigeKampDag && forrigeKampene.length > 0 && (
                <KampSeksjonPanel
                    kampene={forrigeKampene}
                    mineBetsMedScore={mineBetsMedScore}
                    seksjonTittel={t.hjem.nattenSomVar}
                    kampdag={forrigeKampDag}
                    visStatusChip={false}
                    bunntekst={t.hjem.seAlleTips}
                    locale={locale}
                    t={t}
                />
            )}
            <KampSeksjonPanel
                kampene={kampene}
                mineBetsMedScore={mineBetsMedScore}
                seksjonTittel={t.hjem.nesteKampdag}
                kampdag={nesteKampDag}
                visStatusChip={true}
                bunntekst={altTippet ? t.hjem.seAlleTips : manglerTips === 1 ? t.hjem.tippeKampen : t.hjem.tippeKampene}
                locale={locale}
                t={t}
            />
        </div>
    )
}

export default Home

function InnbetalingsAlert() {
    const { t, locale } = useLanguage()
    return (
        <Alert variant="warning">
            <div className="space-y-2">
                <p>
                    {t.hjem.vippsInnskudd} <span className="font-semibold">918 65 052</span>
                    {locale === 'fr' ? ' avant le début du premier match.' : ' før første kamp starter.'}
                </p>
                <KopierNummerKnapp nummer="91865052" />
            </div>
        </Alert>
    )
}

function FristMerke({ laast }: { laast: boolean }) {
    const { t } = useLanguage()
    if (laast) {
        return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 ring-1 ring-stone-200">
                <Lock className="h-3 w-3" />
                {t.hjem.laast}
            </span>
        )
    }
    return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            <Clock className="h-3 w-3" />
            {t.hjem.aapent}
        </span>
    )
}

function RadKort({
    ikon,
    tittel,
    undertittel,
    children,
}: {
    ikon: React.ReactNode
    tittel: string
    undertittel: string
    children: React.ReactNode
}) {
    return (
        <section className="rounded-2xl bg-white shadow-xs ring-1 ring-stone-200/70">
            <div className="flex min-h-16 items-center gap-3 px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    {ikon}
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-stone-900">{tittel}</h2>
                    <p className="text-xs text-stone-500">{undertittel}</p>
                </div>
                {children}
            </div>
        </section>
    )
}

function VinnerKort({ megselv, laast, endrevindu }: { megselv: User; laast: boolean; endrevindu: boolean }) {
    const authedFetch = useAuthedFetch()
    const queryClient = useQueryClient()
    const { t, locale } = useLanguage()
    const lagretWinner = megselv.winner ?? ''
    const [winner, setWinner] = useState(lagretWinner)
    const [forrigeLagret, setForrigeLagret] = useState(lagretWinner)
    const [lagrer, setLagrer] = useState(false)
    const [nyligLagret, setNyligLagret] = useState(false)
    const [feil, setFeil] = useState<string | null>(null)
    const lagSortert = getLagSortert(locale)

    if (lagretWinner !== forrigeLagret) {
        setForrigeLagret(lagretWinner)
        setWinner(lagretWinner)
    }

    const kanEndreMedHalvering = endrevindu && laast && !megselv.winner_endret && !!megselv.winner
    const visLaast = laast && !kanEndreMedHalvering

    const lagre = async (ny: string) => {
        if (kanEndreMedHalvering) {
            if (!window.confirm(t.hjem.bekreftEndringVinner)) return
        }
        setFeil(null)
        const forrige = winner
        setWinner(ny)
        setLagrer(true)
        try {
            const response = await authedFetch('/api/v1/me/', {
                method: 'PUT',
                body: JSON.stringify({ winner: ny }),
            })
            if (!response.ok) {
                setFeil(t.felles.feil)
                setWinner(forrige)
                return
            }
            queryClient.invalidateQueries({ queryKey: ['user-me'] }).then()
            queryClient.invalidateQueries({ queryKey: ['stats'] }).then()
            blink(setNyligLagret)
        } finally {
            setLagrer(false)
        }
    }

    return (
        <div className="space-y-1">
            <RadKort
                ikon={<Trophy className="h-5 w-5" />}
                tittel={t.hjem.verdensmester}
                undertittel={t.hjem.hvemLofterPokalen}
            >
                {visLaast ? (
                    <ValgtVerdi
                        venstre={<span className="text-xl leading-none">{hentFlag(winner)}</span>}
                        tekst={hentNavn(winner, locale)}
                        ikon={
                            megselv.winner_endret ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                    ½
                                </span>
                            ) : (
                                <Lock className="h-4 w-4 text-stone-400" />
                            )
                        }
                    />
                ) : (
                    <>
                        {kanEndreMedHalvering && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                                {t.hjem.endrevinduInfo}
                            </span>
                        )}
                        <label className="relative -mr-2 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-stone-50">
                            <span className="sr-only">{t.hjem.velgVerdensmester}</span>
                            {winner ? (
                                <>
                                    <span className="text-xl leading-none" aria-hidden>
                                        {hentFlag(winner)}
                                    </span>
                                    <span className="max-w-[8rem] truncate text-sm font-bold text-stone-900">
                                        {hentNavn(winner, locale)}
                                    </span>
                                </>
                            ) : (
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                                    {t.hjem.velgLag}
                                </span>
                            )}
                            <ChevronRight className="h-4 w-4 text-stone-400" />
                            <select
                                value={winner}
                                disabled={lagrer}
                                onChange={(e) => lagre(e.target.value)}
                                aria-label={t.hjem.velgVerdensmester}
                                className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                            >
                                <option value="" disabled>
                                    {t.hjem.velgLagPlaceholder}
                                </option>
                                {lagSortert.map((l) => (
                                    <option key={l.tla} value={l.tla}>
                                        {l.flagg + ' ' + l.visningsnavn}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </>
                )}
            </RadKort>
            <StatusLinjeKompakt lagrer={lagrer} nyligLagret={nyligLagret} feil={feil} />
        </div>
    )
}

function ToppscorerKort({ megselv, laast, endrevindu }: { megselv: User; laast: boolean; endrevindu: boolean }) {
    const authedFetch = useAuthedFetch()
    const queryClient = useQueryClient()
    const { t } = useLanguage()
    const { data: spillere } = UsePlayers()
    const [lagrer, setLagrer] = useState(false)
    const [nyligLagret, setNyligLagret] = useState(false)
    const [feil, setFeil] = useState<string | null>(null)

    const valgtId = megselv.topscorer_player_id ?? null
    const valgtSpiller = spillere?.find((s) => s.id === valgtId) ?? null

    const kanEndreMedHalvering = endrevindu && laast && !megselv.topscorer_endret && megselv.topscorer_player_id != null
    const visLaast = laast && !kanEndreMedHalvering

    const lagre = async (playerId: number | null) => {
        if (kanEndreMedHalvering) {
            if (!window.confirm(t.hjem.bekreftEndringTopps)) return
        }
        setFeil(null)
        setLagrer(true)
        try {
            const response = await authedFetch('/api/v1/me/', {
                method: 'PUT',
                body: JSON.stringify({ topscorerPlayerId: playerId }),
            })
            if (!response.ok) {
                setFeil(t.felles.feil)
                return
            }
            queryClient.invalidateQueries({ queryKey: ['user-me'] }).then()
            blink(setNyligLagret)
        } finally {
            setLagrer(false)
        }
    }

    // Spilleren er valgt, men spillerlista er ennå ikke lastet → vis en nøytral
    // plassholder i stedet for å feilaktig vise «ikke valgt».
    const valgtTekst = valgtSpiller ? valgtSpiller.name : valgtId != null ? '…' : t.hjem.ikkeValgt

    return (
        <div className="space-y-1">
            <RadKort
                ikon={<Goal className="h-5 w-5" />}
                tittel={t.hjem.toppscorer}
                undertittel={t.hjem.hvemScorerFlest}
            >
                {visLaast ? (
                    <ValgtVerdi
                        venstre={
                            valgtSpiller ? (
                                <span className="text-xl leading-none">{hentFlag(valgtSpiller.team_tla)}</span>
                            ) : null
                        }
                        tekst={valgtTekst}
                        ikon={
                            megselv.topscorer_endret ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                    ½
                                </span>
                            ) : (
                                <Lock className="h-4 w-4 text-stone-400" />
                            )
                        }
                    />
                ) : (
                    <div className="flex w-56 min-w-0 flex-col items-stretch gap-1">
                        {kanEndreMedHalvering && (
                            <span className="self-end rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                                {t.hjem.endrevinduInfo}
                            </span>
                        )}
                        <SpillerVelger
                            valgtId={valgtId}
                            spillere={spillere ?? []}
                            lagrer={lagrer}
                            disabled={!spillere}
                            placeholder={t.hjem.skrivNavn}
                            onVelg={(playerId) => lagre(playerId)}
                        />
                    </div>
                )}
            </RadKort>
            <StatusLinjeKompakt lagrer={lagrer} nyligLagret={nyligLagret} feil={feil} />
        </div>
    )
}

function ValgtVerdi({ venstre, tekst, ikon }: { venstre?: React.ReactNode; tekst: string; ikon: React.ReactNode }) {
    return (
        <div className="flex min-w-0 items-center gap-2">
            {venstre}
            <span className="max-w-[8rem] truncate text-sm font-bold text-stone-900">{tekst}</span>
            {ikon}
        </div>
    )
}

function StatusLinjeKompakt({
    lagrer,
    nyligLagret,
    feil,
}: {
    lagrer: boolean
    nyligLagret: boolean
    feil?: string | null
}) {
    const { t } = useLanguage()
    if (feil) {
        return (
            <p className="flex items-center gap-1.5 px-4 text-xs text-red-600" role="alert">
                <TriangleAlert className="h-3 w-3" /> {feil}
            </p>
        )
    }
    if (lagrer) {
        return (
            <p className="flex items-center gap-1.5 px-4 text-xs text-stone-500">
                <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-500" />
                {t.felles.lagrer}
            </p>
        )
    }
    if (nyligLagret) {
        return (
            <p className="flex items-center gap-1.5 px-4 text-xs font-medium text-emerald-700">
                <Check className="h-3 w-3" /> {t.felles.lagret}
            </p>
        )
    }
    return null
}

function blink(setter: (v: boolean) => void) {
    setter(true)
    setTimeout(() => setter(false), 2500)
}
