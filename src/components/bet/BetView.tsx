import { Bet } from '../../types/types'
import dayjs from 'dayjs'
import React, { useEffect, useState } from 'react'
import { UseMutateBet } from '../../queries/mutateBet'
import { UseMutateJoker } from '../../queries/mutateJoker'
import { hentFlag, hentNavn } from '../../utils/lag'
import { erNorgeKamp, kanHaJoker } from '../../data/matches'
import NextLink from 'next/link'
import { rundeTilTekst } from '../../utils/rundeTilTekst'
import { gruppeTilVisning } from '../../utils/gruppeTilVisning'
import { nå } from '../../utils/testClock'
import { Calendar, Check, ChevronRight, Flag, Lock, Minus, Plus, Zap } from 'lucide-react'
import nb from 'dayjs/locale/nb'
import fr from 'dayjs/locale/fr'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { brukerKanPrompttes, VIS_EVENT as VARSLER_VIS_EVENT } from '../VarslerPrompt'
import { useLanguage } from '../../i18n/LanguageContext'
import { tx } from '../../i18n/interpolate'

const FØRSTE_TIPP_NØKKEL = 'betpool:første-tipp-vist'

// Realistisk tak på en fotballscore — brukt av både stepperen og tallfeltet.
const MAKS = 9
// Debounce før autolagring: hvert nytt trykk nullstiller timeren → én lagring per serie.
const AUTOLAGRE_MS = 800

export interface JokerContext {
    aktiv: boolean
    bruktPå: string | null
    låst: boolean
}

export function fixLand(s: string, locale: 'no' | 'fr' = 'no'): string {
    if (s === 'To be announced' || s === '') {
        return 'TBA'
    }
    return hentFlag(s) + ' ' + hentNavn(s, locale)
}

export const BetView = ({ bet, matchside, joker }: { bet: Bet; matchside: boolean; joker: JokerContext }) => {
    const { t, locale } = useLanguage()
    const dayjsLocale = locale === 'fr' ? fr : nb

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
    // Angre-snackbar: forrige lagrede verdi å rulle tilbake til + verdien vi nettopp lagret.
    const [angre, setAngre] = useState<{
        forrige: { home: string; away: string }
        ny: { home: string; away: string }
    } | null>(null)
    // Siste verdi som ligger i DB (best effort) — kilden for «er dette endret?».
    const [sistLagret, setSistLagret] = useState({ home: hjemmescoreProp, away: bortescoreProp })
    const kampstart = dayjs(bet.game_start)

    useEffect(() => {
        if (!nyligLagret) return
        const t = setTimeout(() => setNyliglagret(false), 2000)
        return () => clearTimeout(t)
    }, [nyligLagret])

    useEffect(() => {
        if (!angre) return
        const t = setTimeout(() => setAngre(null), 5000)
        return () => clearTimeout(t)
    }, [angre])

    const lagreCb = () => {
        const forrige = sistLagret
        const ny = { home: hjemmescore, away: bortescore }
        setSistLagret(ny)
        setNyliglagret(true)
        if (forrige.home !== ny.home || forrige.away !== ny.away) {
            setAngre({ forrige, ny })
        }
        if (typeof window !== 'undefined' && !localStorage.getItem(FØRSTE_TIPP_NØKKEL)) {
            localStorage.setItem(FØRSTE_TIPP_NØKKEL, '1')
            if (brukerKanPrompttes()) {
                setTimeout(() => window.dispatchEvent(new Event(VARSLER_VIS_EVENT)), 1200)
            }
        }
    }

    const stringTilNumber = (prop: string): number | null => {
        if (prop == '') {
            return null
        }
        return Number(prop!)
    }

    // mutate er stabil fra react-query og bruker alltid de nyeste score-verdiene
    // fra denne renderens closure, så debounce-effekten kan kalle den direkte.
    const { mutate, isPending } = UseMutateBet(
        bet.match_num,
        stringTilNumber(hjemmescore),
        stringTilNumber(bortescore),
        lagreCb,
    )

    const jokerMutation = UseMutateJoker()
    const harLagretTips = bet.home_score != null && bet.away_score != null

    const lageneIkkeKjent = !bet.home_team || !bet.away_team
    const disabled = kampstart.isBefore(nå()) || lageneIkkeKjent
    const usynketEndring = !disabled && (hjemmescore !== sistLagret.home || bortescore !== sistLagret.away)

    // Autolagring: når et komplett tips (eller en bevisst tømming) skiller seg fra
    // det som ligger i DB, lagre ~800 ms etter siste endring. Hvert tastetrykk
    // nullstiller timeren. Bare ett felt fylt → vent til begge er satt.
    useEffect(() => {
        if (disabled) return
        const endret = hjemmescore !== sistLagret.home || bortescore !== sistLagret.away
        if (!endret) return
        const beggeFylt = hjemmescore !== '' && bortescore !== ''
        const beggeTomme = hjemmescore === '' && bortescore === ''
        if (!beggeFylt && !beggeTomme) return
        const id = setTimeout(() => mutate(), AUTOLAGRE_MS)
        return () => clearTimeout(id)
    }, [hjemmescore, bortescore, disabled, sistLagret, mutate])

    const handleAngre = () => {
        if (!angre) return
        setHjemmescore(angre.forrige.home)
        setBortescore(angre.forrige.away)
        setAngre(null)
        // Debounce-effekten oppdager at verdien igjen skiller seg fra DB og lagrer den tilbake.
    }

    const handleFjernTips = () => {
        setHjemmescore('')
        setBortescore('')
        // Tomme felt = bevisst tømming → debounce-effekten lagrer null/null og viser angre.
    }

    return (
        <div
            id={`kamp-${bet.match_num}`}
            data-testid={`bet-${bet.match_num}`}
            className={cn(
                'my-4 scroll-mt-16 bg-white rounded-xl shadow-xs overflow-hidden',
                joker.aktiv ? 'ring-2 ring-amber-300' : 'ring-1 ring-stone-200/70',
            )}
        >
            <div className="flex items-start justify-between gap-2 px-4 pt-3 pb-2">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                        {rundeTilTekst(bet.round, locale)}
                    </span>
                    {bet.group && (
                        <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600 ring-1 ring-stone-200">
                            {gruppeTilVisning(bet.group, locale)}
                        </span>
                    )}
                    {erNorgeKamp(bet.home_team, bet.away_team) && (
                        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800 ring-1 ring-red-200">
                            <Flag className="w-3 h-3" />
                            {t.mineTips.norgeDobbel}
                        </span>
                    )}
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-stone-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {kampstart.locale(dayjsLocale).format('ddd D. MMM HH:mm')}
                </span>
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

            <div className="border-y border-stone-100 divide-y divide-stone-100">
                <TeamScoreRow
                    team={bet.home_team}
                    value={hjemmescore}
                    onValueChange={setHjemmescore}
                    disabled={disabled}
                    pending={usynketEndring || isPending}
                />
                <TeamScoreRow
                    team={bet.away_team}
                    value={bortescore}
                    onValueChange={setBortescore}
                    disabled={disabled}
                    pending={usynketEndring || isPending}
                />
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3 min-h-13">
                <div className="flex items-center gap-2 flex-wrap">
                    {angre ? (
                        <span className="inline-flex items-center gap-2 text-xs" aria-live="polite">
                            {nyligLagret && (
                                <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                    <Check className="w-3.5 h-3.5" /> {t.felles.lagret}
                                </span>
                            )}
                            <span className="text-stone-500">
                                {angre.ny.home === '' && angre.ny.away === ''
                                    ? t.mineTips.tipsFjernet
                                    : tx(t.mineTips.endretTil, { h: angre.ny.home, b: angre.ny.away })}
                            </span>
                            <button
                                type="button"
                                onClick={handleAngre}
                                className="font-medium text-amber-700 underline-offset-2 transition-colors hover:text-amber-800 hover:underline"
                            >
                                {t.mineTips.angre}
                            </button>
                        </span>
                    ) : (
                        nyligLagret && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                <Check className="w-3.5 h-3.5" /> {t.felles.lagret}
                            </span>
                        )
                    )}
                    {lageneIkkeKjent && !nyligLagret && !angre && (
                        <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                            <Lock className="w-3 h-3" /> {t.mineTips.lageneIkkeKjent}
                        </span>
                    )}
                    {!lageneIkkeKjent && disabled && !nyligLagret && !angre && (
                        <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                            <Lock className="w-3 h-3" /> {t.mineTips.kampHarStartet}
                        </span>
                    )}
                </div>

                {disabled && !lageneIkkeKjent && !matchside ? (
                    <NextLink
                        href={'/match/' + bet.match_num}
                        className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors"
                    >
                        {t.mineTips.seAllesBets}
                        <ChevronRight className="w-3.5 h-3.5" />
                    </NextLink>
                ) : (
                    !disabled &&
                    harLagretTips && (
                        <button
                            type="button"
                            onClick={handleFjernTips}
                            className="shrink-0 text-xs font-medium text-stone-400 underline-offset-2 transition-colors hover:text-stone-600 hover:underline"
                        >
                            {t.mineTips.fjernTips}
                        </button>
                    )
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
    const { t } = useLanguage()

    if (disabled) {
        return null
    }

    let innhold: React.ReactNode
    if (joker.aktiv) {
        innhold = (
            <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                    <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
                    {t.mineTips.jokerAktiv}
                </span>
                <Button size="small" variant="ghost" onClick={() => onToggle(false)} loading={isPending}>
                    {t.mineTips.fjernJoker}
                </Button>
            </div>
        )
    } else if (joker.låst) {
        innhold = (
            <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tx(t.mineTips.jokerBruktPa, { kamp: joker.bruktPå ?? '' })}</span>
            </span>
        )
    } else {
        innhold = (
            <div className="flex items-center justify-between gap-3">
                <span
                    className={cn(
                        'inline-flex items-center gap-1.5 text-xs min-w-0',
                        harLagretTips ? 'text-stone-500' : 'text-amber-700',
                    )}
                >
                    <Zap className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                        {!harLagretTips
                            ? t.mineTips.jokerTippFørst
                            : joker.bruktPå
                              ? tx(t.mineTips.jokerStarPa, { kamp: joker.bruktPå })
                              : t.mineTips.doblePoengene}
                    </span>
                </span>
                <Button
                    size="small"
                    variant="outline"
                    onClick={() => onToggle(true)}
                    loading={isPending}
                    disabled={!harLagretTips}
                    icon={<Zap className="w-3.5 h-3.5" />}
                    className="shrink-0"
                >
                    {joker.bruktPå ? t.mineTips.flyttHit : t.mineTips.brukJoker}
                </Button>
            </div>
        )
    }

    return (
        <div
            className={cn(
                'px-4 py-3 transition-colors',
                joker.aktiv
                    ? 'border-b-2 border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100/40'
                    : 'border-b border-stone-100',
            )}
        >
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
    const { t, locale } = useLanguage()
    const numeric = value === '' ? null : Number(value)
    // − fra tom gir ingen mening; + fra tom lander på 0 (vanligste fotballscore).
    const canDec = !disabled && numeric !== null && numeric > 0
    const canInc = !disabled && (numeric === null || numeric < MAKS)

    const handleDec = () => {
        if (numeric !== null && numeric > 0) onValueChange(String(numeric - 1))
    }
    const handleInc = () => onValueChange(numeric === null ? '0' : String(Math.min(numeric + 1, MAKS)))

    return (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-lg font-semibold text-stone-900 truncate">{fixLand(team, locale)}</span>
            <div
                className={cn(
                    'inline-flex items-center rounded-lg border bg-white transition-shadow',
                    pending ? 'border-amber-400 ring-1 ring-amber-200' : 'border-stone-300',
                    disabled && 'opacity-70',
                )}
            >
                <button
                    type="button"
                    aria-label={tx(t.mineTips.reduserLag, { lag: team })}
                    disabled={!canDec}
                    onClick={handleDec}
                    className="flex h-11 w-11 items-center justify-center rounded-l-lg text-stone-700 hover:bg-stone-50 active:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                >
                    <Minus className="w-4 h-4" />
                </button>
                <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAKS}
                    value={value}
                    disabled={disabled}
                    onChange={(e) => {
                        const v = e.target.value
                        if (v === '' || (/^\d{1,2}$/.test(v) && Number(v) <= MAKS)) onValueChange(v)
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={tx(t.mineTips.scoreFor, { lag: team })}
                    className="bp-tabular h-11 w-12 select-none bg-transparent text-center text-2xl font-semibold text-stone-900 focus:outline-none"
                />
                <button
                    type="button"
                    aria-label={tx(t.mineTips.okLag, { lag: team })}
                    disabled={!canInc}
                    onClick={handleInc}
                    className="flex h-11 w-11 items-center justify-center rounded-r-lg text-stone-700 hover:bg-stone-50 active:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}
