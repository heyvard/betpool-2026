import type { NextPage } from 'next'

import { UseUser } from '../queries/useUser'

import React, { useState } from 'react'
import { getLagSortert, hentFlag, hentNavn } from '../utils/lag'
import { UseMatches } from '../queries/useMatches'
import { UseMyBets } from '../queries/useMyBets'
import dayjs from 'dayjs'
import NextLink from 'next/link'
import { useAuthedFetch } from '../auth/authedFetch'
import { Check, ChevronRight, Clock, Goal, Lock, Trophy, TriangleAlert } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useDebouncedCallback } from 'use-debounce'
import nb from 'dayjs/locale/nb'
import fr from 'dayjs/locale/fr'
import { beregnFrister, erEtterFørsteRunde, erIEndrevindu } from '../utils/fristDatoer'
import { nå } from '../utils/testClock'
import { LoadingScreen } from '../components/loading/LoadingScreen'
import { VarslerHint } from '../components/VarslerHint'
import { Alert } from '@/components/ui/alert'
import { KopierNummerKnapp } from '../components/KopierNummerKnapp'
import { LinkPanel } from '@/components/ui/link-panel'
import { cn } from '@/lib/utils'
import { User } from '../types/user'
import { useLanguage } from '../i18n/LanguageContext'
import { tx } from '../i18n/interpolate'

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

    const kamper = matches.filter((a) => {
        return dayjs(a.game_start).isAfter(nå().subtract(2, 'hours')) && dayjs(a.game_start).isBefore(nå())
    })
    const snartKamper = matches.filter((a) => {
        return dayjs(a.game_start).isAfter(nå()) && dayjs(a.game_start).isBefore(nå().add(2, 'hours'))
    })
    const frister = beregnFrister(matches)
    const laast = erEtterFørsteRunde(frister, nå())
    const endrevindu = erIEndrevindu(frister, nå())

    return (
        <div className="space-y-4">
            <VarslerHint />
            {kamper.map((k) => (
                <NextLink
                    key={k.match_num}
                    href={'/match/' + k.match_num}
                    className="block rounded-xl bg-red-50 px-4 py-3 ring-1 ring-red-200"
                >
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-red-800">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
                        {tx(t.hjem.naPagarKamp, {
                            home: fixLandMedLocale(k.home_team, locale),
                            away: fixLandMedLocale(k.away_team, locale),
                        })}
                    </span>
                </NextLink>
            ))}
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

            {!megselv.paid && <InnbetalingsAlert />}

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
        </div>
    )
}

function NesteKampSeksjon() {
    const { data: bets } = UseMyBets()
    const { t, locale } = useLanguage()
    const dayjsLocale = locale === 'fr' ? fr : nb

    if (!bets) return null

    const kommende = bets
        .filter((b) => dayjs(b.game_start).isAfter(nå()))
        .sort((a, b) => dayjs(a.game_start).valueOf() - dayjs(b.game_start).valueOf())

    if (kommende.length === 0) {
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

    // Kamper starter 18:00–06:00 Oslo-tid. Skift 12 timer bakover slik at
    // grensen mellom kampdag og neste kampdag blir kl. 12:00 (middag) i stedet
    // for midnatt – ellers havner natt-kamper (01:00–06:00 Oslo) på feil dag.
    const kampDag = (t: dayjs.Dayjs) => t.subtract(12, 'hour').startOf('day')
    const nesteKampDag = kampDag(dayjs(kommende[0].game_start))
    const kampene = kommende.filter((b) => kampDag(dayjs(b.game_start)).isSame(nesteKampDag, 'day'))

    const manglerTips = kampene.filter((b) => b.home_score == null || b.away_score == null).length
    const altTippet = manglerTips === 0

    const erIDag = nesteKampDag.isSame(kampDag(nå()), 'day')
    const erIMorgen = nesteKampDag.isSame(kampDag(nå()).add(1, 'day'), 'day')
    const datoEtikett = erIDag
        ? locale === 'fr'
            ? "Aujourd'hui"
            : 'I dag'
        : erIMorgen
          ? locale === 'fr'
              ? 'Demain'
              : 'I morgen'
          : nesteKampDag.locale(dayjsLocale).format('dddd D. MMM')

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-stone-900">{t.hjem.nesteKampdag}</h2>
                <span className="text-xs capitalize text-stone-500">{datoEtikett}</span>
            </div>

            <div className="overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-stone-200/70">
                <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                        {nesteKampDag.locale(dayjsLocale).format('dddd D. MMMM')}
                    </span>
                    {altTippet ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                            <Check className="h-2.5 w-2.5" /> {t.hjem.altTippet}
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200">
                            {tx(t.hjem.manglerTips, { n: manglerTips })}
                        </span>
                    )}
                </div>

                {kampene.map((b) => {
                    const tippet = b.home_score != null && b.away_score != null
                    return (
                        <NextLink
                            key={b.match_num}
                            href="/my-bets"
                            className="flex items-center gap-3 border-b border-stone-100 px-4 py-2.5 last:border-b-0 hover:bg-stone-50 transition-colors"
                        >
                            <span className="w-9 shrink-0 text-[11px] font-bold tabular-nums text-stone-400">
                                {dayjs(b.game_start).format('HH:mm')}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-stone-900">
                                {hentFlag(b.home_team)} {hentNavn(b.home_team, locale)} – {hentFlag(b.away_team)}{' '}
                                {hentNavn(b.away_team, locale)}
                            </span>
                            {tippet ? (
                                <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-700">
                                    {b.home_score}–{b.away_score}
                                </span>
                            ) : (
                                <span className="h-4 w-4 shrink-0 rounded border-[1.5px] border-dashed border-stone-300" />
                            )}
                        </NextLink>
                    )
                })}
            </div>

            <NextLink
                href="/my-bets"
                className="block text-center text-sm font-semibold text-amber-700 hover:text-amber-800"
            >
                {altTippet ? t.hjem.seAlleTips : manglerTips === 1 ? t.hjem.tippeKampen : t.hjem.tippeKampene}
            </NextLink>
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
    const lagretTopscorer = megselv.topscorer ?? ''
    const [topscorer, setTopscorer] = useState(lagretTopscorer)
    const [forrigeLagret, setForrigeLagret] = useState(lagretTopscorer)
    const [lagrer, setLagrer] = useState(false)
    const [nyligLagret, setNyligLagret] = useState(false)
    const [feil, setFeil] = useState<string | null>(null)

    if (lagretTopscorer !== forrigeLagret) {
        setForrigeLagret(lagretTopscorer)
        setTopscorer(lagretTopscorer)
    }

    const kanEndreMedHalvering = endrevindu && laast && !megselv.topscorer_endret && !!megselv.topscorer
    const visLaast = laast && !kanEndreMedHalvering

    const lagreDebounced = useDebouncedCallback(async (ny: string) => {
        setFeil(null)
        setLagrer(true)
        try {
            const response = await authedFetch('/api/v1/me/', {
                method: 'PUT',
                body: JSON.stringify({ topscorer: ny.trim() }),
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
    }, 1200)

    const lagreEndring = async () => {
        if (!window.confirm(t.hjem.bekreftEndringTopps)) return
        setFeil(null)
        setLagrer(true)
        try {
            const response = await authedFetch('/api/v1/me/', {
                method: 'PUT',
                body: JSON.stringify({ topscorer: topscorer.trim() }),
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

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTopscorer(e.target.value)
        if (!kanEndreMedHalvering) {
            lagreDebounced(e.target.value)
        }
    }

    const lagret = topscorer.trim()

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
                            lagret ? (
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                                    {initialer(lagret)}
                                </span>
                            ) : null
                        }
                        tekst={lagret || t.hjem.ikkeValgt}
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
                    <div className="flex min-w-0 flex-col items-end gap-1">
                        {kanEndreMedHalvering && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                                {t.hjem.endrevinduInfo}
                            </span>
                        )}
                        <div className="flex min-w-0 items-center gap-2">
                            {lagret && (
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                                    {initialer(lagret)}
                                </span>
                            )}
                            <label htmlFor="topscorer-input" className="sr-only">
                                {t.hjem.hvilkenSpiller}
                            </label>
                            <input
                                id="topscorer-input"
                                type="text"
                                value={topscorer}
                                disabled={lagrer}
                                placeholder={t.hjem.skrivNavn}
                                onChange={onChange}
                                className={cn(
                                    'w-32 min-w-0 rounded-md bg-transparent px-1 py-1 text-right text-sm font-bold text-stone-900',
                                    'placeholder:font-normal placeholder:text-stone-400',
                                    'focus:bg-stone-50 focus:outline-hidden focus:ring-2 focus:ring-amber-400',
                                    'disabled:cursor-not-allowed',
                                )}
                            />
                            {kanEndreMedHalvering && (
                                <button
                                    onClick={lagreEndring}
                                    disabled={lagrer || !lagret || lagret === (megselv.topscorer ?? '').trim()}
                                    className={cn(
                                        'shrink-0 rounded-md bg-amber-500 px-2 py-1 text-xs font-bold text-white',
                                        'hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40',
                                    )}
                                >
                                    {t.hjem.lagreEndring}
                                </button>
                            )}
                        </div>
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

function initialer(navn: string): string {
    return navn
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((ord) => ord[0]!.toUpperCase())
        .join('')
}
