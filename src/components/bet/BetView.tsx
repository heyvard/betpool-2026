import { Bet } from '../../types/types'
import dayjs from 'dayjs'
import React, { useEffect, useState } from 'react'
import { UseMutateBet } from '../../queries/mutateBet'
import { UseMutateJoker } from '../../queries/mutateJoker'
import { hentFlag, hentNorsk } from '../../utils/lag'
import { erNorgeKamp, kanHaJoker } from '../../data/matches'
import NextLink from 'next/link'
import { rundeTilTekst } from '../../utils/rundeTilTekst'
import { nå } from '../../utils/testClock'
import { Calendar, Check, ChevronRight, Flag, Lock, Minus, Plus, Save, Zap } from 'lucide-react'
import nb from 'dayjs/locale/nb'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface JokerContext {
    // Denne kampen har jokeren for runden.
    aktiv: boolean
    // Navn på en annen kamp i samme runde som har jokeren, ellers null.
    bruktPå: string | null
    // Jokeren for runden ligger på en kamp som alt har startet — den kan ikke flyttes.
    låst: boolean
}

export const BetView = ({ bet, matchside, joker }: { bet: Bet; matchside: boolean; joker: JokerContext }) => {
    const numberPropTilString = (prop: number | null) => {
        if (prop == null) {
            return ''
        }
        return `${prop}`
    }

    let hjemmescoreProp = numberPropTilString(bet.home_score)
    const [hjemmescore, setHjemmescore] = useState<string>(hjemmescoreProp)
    let bortescoreProp = numberPropTilString(bet.away_score)
    const [bortescore, setBortescore] = useState<string>(bortescoreProp)
    const [nyligLagret, setNyliglagret] = useState(false)
    const kampstart = dayjs(bet.game_start)

    const lagreCb = () => {
        setNyliglagret(true)
        setTimeout(() => {
            setNyliglagret(false)
        }, 2000)
    }

    const stringTilNumber = (prop: string): number | null => {
        if (prop == '') {
            return null
        }
        return Number(prop!)
    }

    const { mutate, isPending } = UseMutateBet(
        bet.match_num,
        stringTilNumber(hjemmescore),
        stringTilNumber(bortescore),
        lagreCb,
    )

    const jokerMutation = UseMutateJoker()
    // Jokeren kan bare settes på et tips som er lagret i databasen.
    const harLagretTips = bet.home_score != null && bet.away_score != null

    const disabled = kampstart.isBefore(nå())
    const lagreknappSynlig = (hjemmescore !== hjemmescoreProp || bortescore !== bortescoreProp) && !nyligLagret
    const beggeFylt = hjemmescore !== '' && bortescore !== ''

    const [visSterktHint, setVisSterktHint] = useState(false)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisSterktHint(false)
        if (!lagreknappSynlig) return
        const timer = setTimeout(() => setVisSterktHint(true), 5000)
        return () => clearTimeout(timer)
    }, [lagreknappSynlig, hjemmescore, bortescore])

    useEffect(() => {
        if (!lagreknappSynlig) return
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [lagreknappSynlig])

    return (
        <div
            data-testid={`bet-${bet.match_num}`}
            className={cn(
                'my-4 bg-white rounded-xl shadow-sm overflow-hidden',
                joker.aktiv ? 'ring-2 ring-amber-300' : 'ring-1 ring-stone-200/70',
            )}
        >
            <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                        {rundeTilTekst(bet.round)}
                    </span>
                    {erNorgeKamp(bet.home_team, bet.away_team) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800 ring-1 ring-red-200">
                            <Flag className="w-3 h-3" />
                            Norge ×2
                        </span>
                    )}
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                    {kampstart.locale(nb).format('ddd D. MMM HH:mm')}
                </span>
            </div>

            <div className="border-y border-stone-100 divide-y divide-stone-100">
                <TeamScoreRow
                    team={bet.home_team}
                    value={hjemmescore}
                    onValueChange={setHjemmescore}
                    disabled={disabled}
                    pending={lagreknappSynlig}
                />
                <TeamScoreRow
                    team={bet.away_team}
                    value={bortescore}
                    onValueChange={setBortescore}
                    disabled={disabled}
                    pending={lagreknappSynlig}
                />
            </div>

            {kanHaJoker(bet.round) && !erNorgeKamp(bet.home_team, bet.away_team) && (
                <JokerSeksjon
                    joker={joker}
                    harLagretTips={harLagretTips}
                    disabled={disabled}
                    isPending={jokerMutation.isPending}
                    feil={jokerMutation.error?.message ?? null}
                    onToggle={(verdi) => jokerMutation.mutate({ matchNum: bet.match_num, joker: verdi })}
                />
            )}

            <div className="flex items-center justify-between gap-3 px-4 py-3 min-h-[3.25rem]">
                <div className="flex items-center gap-2 flex-wrap">
                    {lagreknappSynlig && (
                        <>
                            <Button
                                size="small"
                                variant="accent"
                                onClick={() => mutate()}
                                loading={isPending}
                                disabled={!beggeFylt}
                                icon={<Save className="w-3.5 h-3.5" />}
                            >
                                Lagre
                            </Button>
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1.5 text-xs transition-colors',
                                    !beggeFylt || visSterktHint ? 'text-amber-700 font-medium' : 'text-stone-600',
                                )}
                                aria-live="polite"
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        'h-1.5 w-1.5 rounded-full bg-amber-500',
                                        (!beggeFylt || visSterktHint) && 'animate-pulse',
                                    )}
                                />
                                {!beggeFylt
                                    ? 'Fyll inn score for begge lag'
                                    : visSterktHint
                                      ? 'Husk å lagre endringen'
                                      : 'Ikke lagret'}
                            </span>
                        </>
                    )}
                    {nyligLagret && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <Check className="w-3.5 h-3.5" /> Lagret
                        </span>
                    )}
                    {disabled && !lagreknappSynlig && !nyligLagret && (
                        <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                            <Lock className="w-3 h-3" /> Kampen har startet
                        </span>
                    )}
                </div>

                {disabled && !matchside && (
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

interface JokerSeksjonProps {
    joker: JokerContext
    harLagretTips: boolean
    disabled: boolean
    isPending: boolean
    feil: string | null
    onToggle: (verdi: boolean) => void
}

function JokerSeksjon({ joker, harLagretTips, disabled, isPending, feil, onToggle }: JokerSeksjonProps) {
    // Joker-seksjonen dukker først opp når tipset er lagret — før det er den ikke
    // brukbar, og en forklarende tekst ville bare vært støy.
    if (disabled || !harLagretTips) {
        return null
    }

    let innhold: React.ReactNode
    if (joker.aktiv) {
        innhold = (
            <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                    <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
                    Joker aktiv — kampen teller dobbelt
                </span>
                <Button size="small" variant="ghost" onClick={() => onToggle(false)} loading={isPending}>
                    Fjern
                </Button>
            </div>
        )
    } else if (joker.låst) {
        innhold = (
            <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Joker brukt på {joker.bruktPå} denne runden</span>
            </span>
        )
    } else {
        innhold = (
            <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 min-w-0">
                    <Zap className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                        {joker.bruktPå ? `Joker står på ${joker.bruktPå}` : 'Doble poengene på én kamp i runden'}
                    </span>
                </span>
                <Button
                    size="small"
                    variant="outline"
                    onClick={() => onToggle(true)}
                    loading={isPending}
                    icon={<Zap className="w-3.5 h-3.5" />}
                    className="shrink-0"
                >
                    {joker.bruktPå ? 'Flytt hit' : 'Bruk joker'}
                </Button>
            </div>
        )
    }

    return (
        <div className={cn('border-b border-stone-100 px-4 py-3', joker.aktiv && 'bg-amber-50/50')}>
            {innhold}
            {feil && <p className="mt-1.5 text-xs text-red-600">{feil}</p>}
        </div>
    )
}

interface TeamScoreRowProps {
    team: string
    value: string
    onValueChange: (v: string) => void
    disabled: boolean
    pending: boolean
}

function TeamScoreRow({ team, value, onValueChange, disabled, pending }: TeamScoreRowProps) {
    const numeric = value === '' ? null : Number(value)
    const canDec = !disabled && numeric !== null && numeric > 0
    const canInc = !disabled && (numeric === null || numeric < 99)

    const handleDec = () => {
        if (numeric !== null && numeric > 0) {
            onValueChange(String(numeric - 1))
        }
    }
    const handleInc = () => {
        if (numeric === null) {
            onValueChange('1')
        } else if (numeric < 99) {
            onValueChange(String(numeric + 1))
        }
    }

    return (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-lg font-semibold text-stone-900 truncate">{fixLand(team)}</span>
            <div
                className={cn(
                    'inline-flex items-center rounded-lg border bg-white transition-shadow',
                    pending ? 'border-amber-400 ring-1 ring-amber-200' : 'border-stone-300',
                    disabled && 'opacity-70',
                )}
            >
                <button
                    type="button"
                    aria-label={`Reduser ${team}`}
                    disabled={!canDec}
                    onClick={handleDec}
                    className="h-11 w-11 flex items-center justify-center rounded-l-lg text-stone-700 hover:bg-stone-50 active:bg-stone-100 disabled:text-stone-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                >
                    <Minus className="w-4 h-4" />
                </button>
                <span className="h-11 min-w-[2.25rem] flex items-center justify-center text-2xl font-semibold text-stone-900 tabular-nums px-1 select-none">
                    {numeric ?? '–'}
                </span>
                <button
                    type="button"
                    aria-label={`Øk ${team}`}
                    disabled={!canInc}
                    onClick={handleInc}
                    className="h-11 w-11 flex items-center justify-center rounded-r-lg text-stone-700 hover:bg-stone-50 active:bg-stone-100 disabled:text-stone-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}

export function fixLand(s: string): string {
    if (s === 'To be announced') {
        return 'TBA'
    }
    return hentFlag(s) + ' ' + hentNorsk(s)
}
