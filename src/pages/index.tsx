import type { NextPage } from 'next'

import { UseUser } from '../queries/useUser'

import React, { useState } from 'react'
import { alleLagSortert, hentFlag, hentNorsk } from '../utils/lag'
import { UseMatches } from '../queries/useMatches'
import dayjs from 'dayjs'
import NextLink from 'next/link'
import { fixLand } from '../components/bet/BetView'
import { useAuthedFetch } from '../auth/authedFetch'
import { Check, ChevronRight, Clock, Goal, Lock, Trophy, TriangleAlert } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useDebouncedCallback } from 'use-debounce'
import nb from 'dayjs/locale/nb'
import { erEtterFørsteRunde, førsteRunde } from '../utils/isInFirstRound'
import { nå } from '../utils/testClock'
import { LoadingScreen } from '../components/loading/LoadingScreen'
import { VarslerHint } from '../components/VarslerHint'
import { Alert } from '@/components/ui/alert'
import { KopierNummerKnapp } from '../components/KopierNummerKnapp'
import { LinkPanel } from '@/components/ui/link-panel'
import { cn } from '@/lib/utils'
import { User } from '../types/user'

dayjs.locale(nb)

const Home: NextPage = () => {
    const { data: megselv } = UseUser()
    const { data: matches, isLoading } = UseMatches()

    if (!matches || isLoading || !megselv) {
        return <LoadingScreen />
    }

    const kamper = matches.filter((a) => {
        return dayjs(a.game_start).isAfter(nå().subtract(2, 'hours')) && dayjs(a.game_start).isBefore(nå())
    })
    const snartKamper = matches.filter((a) => {
        return dayjs(a.game_start).isAfter(nå()) && dayjs(a.game_start).isBefore(nå().add(2, 'hours'))
    })
    const laast = erEtterFørsteRunde()

    return (
        <div className="space-y-4">
            <VarslerHint />
            {kamper.map((k) => (
                <div key={k.match_num}>
                    <NextLink passHref legacyBehavior href={'/match/' + k.match_num}>
                        <LinkPanel>
                            Nå pågår {fixLand(k.home_team)} vs {fixLand(k.away_team)}
                        </LinkPanel>
                    </NextLink>
                </div>
            ))}
            {snartKamper.map((k) => (
                <div key={k.match_num}>
                    <NextLink passHref legacyBehavior href={'/my-bets/'}>
                        <LinkPanel>
                            {fixLand(k.home_team)} vs {fixLand(k.away_team)} starter kl{' '}
                            {dayjs(k.game_start).format('HH:mm')}
                        </LinkPanel>
                    </NextLink>
                </div>
            ))}

            {!megselv.paid && <InnbetalingsAlert />}

            <div className="pt-2">
                <div className="flex items-center justify-between gap-3">
                    <h1 className="text-xl font-bold text-stone-900">Dine VM-tips</h1>
                    <FristMerke laast={laast} />
                </div>
                <p className="mt-0.5 text-sm text-stone-500">
                    {laast
                        ? 'VM er i gang — vinner og toppscorer er låst.'
                        : `Kan endres frem til ${førsteRunde.locale(nb).format('dddd D. MMM [kl] HH:mm')}.`}
                </p>
            </div>

            <VinnerKort megselv={megselv} laast={laast} />
            <ToppscorerKort megselv={megselv} laast={laast} />

            <NextLink passHref legacyBehavior href="/my-bets">
                <LinkPanel>
                    <span className="flex flex-col">
                        <span className="text-base font-semibold text-stone-900">Tipp kampene</span>
                        <span className="text-xs text-stone-500">Sett resultater for hver enkelt kamp</span>
                    </span>
                </LinkPanel>
            </NextLink>
        </div>
    )
}

export default Home

function InnbetalingsAlert() {
    return (
        <Alert variant="warning">
            <div className="space-y-2">
                <p>
                    Vipps 300 kr til <span className="font-semibold">918 65 052</span> før første kamp starter.
                </p>
                <KopierNummerKnapp nummer="91865052" />
            </div>
        </Alert>
    )
}

/** Liten statusmarkør ved siden av overskriften — åpent for endring, eller låst. */
function FristMerke({ laast }: { laast: boolean }) {
    if (laast) {
        return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 ring-1 ring-stone-200">
                <Lock className="h-3 w-3" />
                Låst
            </span>
        )
    }
    return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            <Clock className="h-3 w-3" />
            Åpent
        </span>
    )
}

/**
 * Trykkbar rad-kort: ikon-badge + tittel/undertittel til venstre, valgt verdi
 * + chevron til høyre. Selve "klikket" leveres av barnet (et `<label>` rundt
 * en skjult `<select>` for Vinner, et inline input for Toppscorer).
 */
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

function VinnerKort({ megselv, laast }: { megselv: User; laast: boolean }) {
    const authedFetch = useAuthedFetch()
    const queryClient = useQueryClient()
    const lagretWinner = megselv.winner ?? ''
    const [winner, setWinner] = useState(lagretWinner)
    const [forrigeLagret, setForrigeLagret] = useState(lagretWinner)
    const [lagrer, setLagrer] = useState(false)
    const [nyligLagret, setNyligLagret] = useState(false)
    const [feil, setFeil] = useState<string | null>(null)

    if (lagretWinner !== forrigeLagret) {
        setForrigeLagret(lagretWinner)
        setWinner(lagretWinner)
    }

    const lagre = async (ny: string) => {
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
                setFeil('Kunne ikke lagre — prøv igjen.')
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
            <RadKort ikon={<Trophy className="h-5 w-5" />} tittel="Verdensmester" undertittel="Hvem løfter pokalen?">
                {laast ? (
                    <ValgtVerdi
                        venstre={<span className="text-xl leading-none">{hentFlag(winner)}</span>}
                        tekst={hentNorsk(winner)}
                        ikon={<Lock className="h-4 w-4 text-stone-400" />}
                    />
                ) : (
                    <label className="relative -mr-2 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-stone-50">
                        <span className="sr-only">Velg verdensmester</span>
                        {winner ? (
                            <>
                                <span className="text-xl leading-none" aria-hidden>
                                    {hentFlag(winner)}
                                </span>
                                <span className="max-w-[8rem] truncate text-sm font-bold text-stone-900">
                                    {hentNorsk(winner)}
                                </span>
                            </>
                        ) : (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                                Velg lag
                            </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-stone-400" />
                        <select
                            value={winner}
                            disabled={lagrer}
                            onChange={(e) => lagre(e.target.value)}
                            aria-label="Velg verdensmester"
                            className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                        >
                            <option value="" disabled>
                                Velg lag …
                            </option>
                            {alleLagSortert.map((l) => (
                                <option key={l.engelsk} value={l.engelsk}>
                                    {l.flagg + ' ' + l.norsk}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </RadKort>
            <StatusLinjeKompakt lagrer={lagrer} nyligLagret={nyligLagret} feil={feil} />
        </div>
    )
}

function ToppscorerKort({ megselv, laast }: { megselv: User; laast: boolean }) {
    const authedFetch = useAuthedFetch()
    const queryClient = useQueryClient()
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

    const lagreDebounced = useDebouncedCallback(async (ny: string) => {
        setFeil(null)
        setLagrer(true)
        try {
            const response = await authedFetch('/api/v1/me/', {
                method: 'PUT',
                body: JSON.stringify({ topscorer: ny.trim() }),
            })
            if (!response.ok) {
                setFeil('Kunne ikke lagre — prøv igjen.')
                return
            }
            queryClient.invalidateQueries({ queryKey: ['user-me'] }).then()
            blink(setNyligLagret)
        } finally {
            setLagrer(false)
        }
    }, 600)

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTopscorer(e.target.value)
        lagreDebounced(e.target.value)
    }

    const lagret = topscorer.trim()

    return (
        <div className="space-y-1">
            <RadKort ikon={<Goal className="h-5 w-5" />} tittel="Toppscorer" undertittel="Hvem scorer flest mål?">
                {laast ? (
                    <ValgtVerdi
                        venstre={
                            lagret ? (
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                                    {initialer(lagret)}
                                </span>
                            ) : null
                        }
                        tekst={lagret || 'Ikke valgt'}
                        ikon={<Lock className="h-4 w-4 text-stone-400" />}
                    />
                ) : (
                    <div className="flex min-w-0 items-center gap-2">
                        {lagret && (
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                                {initialer(lagret)}
                            </span>
                        )}
                        <label htmlFor="topscorer-input" className="sr-only">
                            Hvilken spiller scorer flest mål?
                        </label>
                        <input
                            id="topscorer-input"
                            type="text"
                            value={topscorer}
                            disabled={lagrer}
                            placeholder="Skriv navn"
                            onChange={onChange}
                            className={cn(
                                'w-32 min-w-0 rounded-md bg-transparent px-1 py-1 text-right text-sm font-bold text-stone-900',
                                'placeholder:font-normal placeholder:text-stone-400',
                                'focus:bg-stone-50 focus:outline-hidden focus:ring-2 focus:ring-amber-400',
                                'disabled:cursor-not-allowed',
                            )}
                        />
                    </div>
                )}
            </RadKort>
            <StatusLinjeKompakt lagrer={lagrer} nyligLagret={nyligLagret} feil={feil} />
        </div>
    )
}

/** Valgt verdi til høyre i en rad — brukes når VM er i gang og tipset er låst. */
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
                Lagrer …
            </p>
        )
    }
    if (nyligLagret) {
        return (
            <p className="flex items-center gap-1.5 px-4 text-xs font-medium text-emerald-700">
                <Check className="h-3 w-3" /> Lagret
            </p>
        )
    }
    return null
}

/** Vis-så-borte-flagg: settes på i 2,5 sek etter en vellykket lagring. */
function blink(setter: (v: boolean) => void) {
    setter(true)
    setTimeout(() => setter(false), 2500)
}

/** Inntil to forbokstaver fra et navn, til avatar-badgen for toppscorer. */
function initialer(navn: string): string {
    return navn
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((ord) => ord[0]!.toUpperCase())
        .join('')
}
