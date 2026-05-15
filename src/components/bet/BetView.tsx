import { Bet } from '../../types/types'
import dayjs from 'dayjs'
import React, { useState } from 'react'
import { UseMutateBet } from '../../queries/mutateBet'
import { hentFlag, hentNorsk } from '../../utils/lag'
import NextLink from 'next/link'
import { rundeTilTekst } from '../../utils/rundeTilTekst'
import { nå } from '../../utils/testClock'
import { Calendar, Check, ChevronRight, Lock, Save } from 'lucide-react'
import nb from 'dayjs/locale/nb'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const BetView = ({ bet, matchside }: { bet: Bet; matchside: boolean }) => {
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

    const disabled = kampstart.isBefore(nå())
    const lagreknappSynlig = (hjemmescore !== hjemmescoreProp || bortescore !== bortescoreProp) && !nyligLagret
    const selectAllFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select()
    }

    return (
        <div className="my-4 bg-white rounded-xl shadow-sm ring-1 ring-stone-200/70 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                    {rundeTilTekst(bet.round)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
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
                    onFocus={selectAllFocus}
                />
                <TeamScoreRow
                    team={bet.away_team}
                    value={bortescore}
                    onValueChange={setBortescore}
                    disabled={disabled}
                    pending={lagreknappSynlig}
                    onFocus={selectAllFocus}
                />
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3 min-h-[3.25rem]">
                <div className="flex items-center gap-2">
                    {lagreknappSynlig && (
                        <Button
                            size="small"
                            variant="accent"
                            onClick={() => mutate()}
                            loading={isPending}
                            icon={<Save className="w-3.5 h-3.5" />}
                        >
                            Lagre
                        </Button>
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

interface TeamScoreRowProps {
    team: string
    value: string
    onValueChange: (v: string) => void
    disabled: boolean
    pending: boolean
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => void
}

function TeamScoreRow({ team, value, onValueChange, disabled, pending, onFocus }: TeamScoreRowProps) {
    return (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-lg font-semibold text-stone-900 truncate">{fixLand(team)}</span>
            <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label={team}
                disabled={disabled}
                value={value}
                onFocus={onFocus}
                onChange={(e) => {
                    if (!e.currentTarget.value) {
                        onValueChange('')
                        return
                    }
                    const number = Number(e.currentTarget.value)
                    if (number >= 0 && number <= 99) {
                        onValueChange(String(number))
                    }
                }}
                className={cn(
                    'h-12 w-14 rounded-lg border bg-white text-center text-2xl font-semibold text-stone-900 tabular-nums outline-none transition-shadow',
                    'focus:ring-2 focus:ring-amber-400 focus:border-amber-500',
                    'disabled:bg-stone-100 disabled:text-stone-400 disabled:cursor-not-allowed',
                    pending ? 'border-amber-400 ring-1 ring-amber-200' : 'border-stone-300',
                )}
            />
        </div>
    )
}

export function fixLand(s: string): string {
    if (s === 'To be announced') {
        return 'TBA'
    }
    return hentFlag(s) + ' ' + hentNorsk(s)
}
