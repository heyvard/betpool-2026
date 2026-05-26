import type { NextPage } from 'next'

import { UseUser } from '../queries/useUser'

import React, { useState } from 'react'
import { alleLagSortert, hentFlag, hentNorsk } from '../utils/lag'
import { UseMatches } from '../queries/useMatches'
import dayjs from 'dayjs'
import NextLink from 'next/link'
import { fixLand } from '../components/bet/BetView'
import { useAuthedFetch } from '../auth/authedFetch'
import { Check, ChevronDown, Clock, Goal, Lock, Trophy, TriangleAlert } from 'lucide-react'
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

/** Felles kort-skall: ikon-badge + tittel/undertittel øverst, valgfritt innhold under. */
function TipsKort({
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
        <section className="overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-stone-200/70">
            <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    {ikon}
                </span>
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-stone-900">{tittel}</h2>
                    <p className="text-xs text-stone-500">{undertittel}</p>
                </div>
            </div>
            {children}
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

    // Synk lokal optimistisk verdi med ny serververdi når denne endrer seg
    // (egen lagring eller eksternt). Avledet state i render, ikke effect.
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
                setFeil('Kunne ikke lagre — sjekk forbindelsen og prøv igjen.')
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

    const harValg = winner !== ''

    return (
        <TipsKort ikon={<Trophy className="h-5 w-5" />} tittel="Verdensmester" undertittel="Hvem løfter pokalen?">
            <div className="flex flex-col items-center px-4 py-6 text-center">
                {harValg ? (
                    <>
                        <span className="text-6xl leading-none" aria-hidden>
                            {hentFlag(winner)}
                        </span>
                        <span className="mt-2 text-xl font-bold text-stone-900">{hentNorsk(winner)}</span>
                    </>
                ) : (
                    <TomtValg tekst="Ingen vinner valgt ennå" />
                )}
            </div>

            {laast ? (
                <LaastFot />
            ) : (
                <div className="border-t border-stone-100 bg-stone-50/70 px-4 py-3">
                    <label htmlFor="winner-select" className="sr-only">
                        Velg verdensmester
                    </label>
                    <div className="relative">
                        <select
                            id="winner-select"
                            value={winner}
                            disabled={lagrer}
                            onChange={(e) => lagre(e.target.value)}
                            className={cn(
                                'h-11 w-full appearance-none rounded-xl border border-stone-300 bg-white pl-3 pr-10 text-sm font-medium text-stone-900',
                                'transition-shadow focus:border-amber-500 focus:outline-hidden focus:ring-2 focus:ring-amber-400',
                                'disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500',
                            )}
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
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-stone-400">
                            <ChevronDown className="h-4 w-4" />
                        </span>
                    </div>
                    <StatusLinje lagrer={lagrer} nyligLagret={nyligLagret} hint="Endres til VM starter" feil={feil} />
                </div>
            )}
        </TipsKort>
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

    // Avledet state: ny serververdi overskriver lokal redigering. OK her — det
    // er enten brukerens egen lagring eller en sync fra annen fane.
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
                setFeil('Kunne ikke lagre — sjekk forbindelsen og prøv igjen.')
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

    const lagret = lagretTopscorer.trim()

    return (
        <TipsKort ikon={<Goal className="h-5 w-5" />} tittel="Toppscorer" undertittel="Hvem scorer flest mål?">
            <div className="flex flex-col items-center px-4 py-6 text-center">
                {lagret ? (
                    <>
                        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-xl font-bold text-amber-700">
                            {initialer(lagret)}
                        </span>
                        <span className="mt-2 text-xl font-bold text-stone-900">{lagret}</span>
                    </>
                ) : (
                    <TomtValg tekst="Du har ikke tippet toppscorer" />
                )}
            </div>

            {laast ? (
                <LaastFot />
            ) : (
                <div className="border-t border-stone-100 bg-stone-50/70 px-4 py-3">
                    <label htmlFor="topscorer-input" className="sr-only">
                        Hvilken spiller scorer flest mål?
                    </label>
                    <input
                        id="topscorer-input"
                        type="text"
                        value={topscorer}
                        disabled={lagrer}
                        placeholder="Spillerens navn"
                        onChange={onChange}
                        className={cn(
                            'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900',
                            'transition-shadow placeholder:text-stone-400',
                            'focus:border-amber-500 focus:outline-hidden focus:ring-2 focus:ring-amber-400',
                            'disabled:cursor-not-allowed disabled:bg-stone-100',
                        )}
                    />
                    <StatusLinje lagrer={lagrer} nyligLagret={nyligLagret} hint="Lagres automatisk." feil={feil} />
                </div>
            )}
        </TipsKort>
    )
}

/** Plassholder når brukeren ikke har valgt noe ennå. */
function TomtValg({ tekst }: { tekst: string }) {
    return (
        <>
            <span
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-stone-300 text-2xl text-stone-300"
                aria-hidden
            >
                ?
            </span>
            <span className="mt-2 text-base font-medium text-stone-400">{tekst}</span>
        </>
    )
}

/** Fot på et kort når fristen er ute. */
function LaastFot() {
    return (
        <div className="flex items-center gap-2 border-t border-stone-100 bg-stone-50/70 px-4 py-3 text-xs text-stone-500">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            VM er i gang — dette tipset kan ikke endres.
        </div>
    )
}

/** Lagre-status under et inntastingsfelt. */
function StatusLinje({
    lagrer,
    nyligLagret,
    hint,
    feil,
}: {
    lagrer: boolean
    nyligLagret: boolean
    hint?: string
    feil?: string | null
}) {
    if (feil) {
        return (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600" role="alert">
                <TriangleAlert className="h-3.5 w-3.5" /> {feil}
            </p>
        )
    }
    if (lagrer) {
        return (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-500">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-stone-300 border-t-stone-500" />
                Lagrer …
            </p>
        )
    }
    if (nyligLagret) {
        return (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" /> Lagret
            </p>
        )
    }
    if (hint) {
        return <p className="mt-2 text-xs text-stone-400">{hint}</p>
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
