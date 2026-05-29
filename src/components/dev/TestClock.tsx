import React, { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { useQueryClient } from '@tanstack/react-query'

import { setKlokke, nullstillKlokke } from '../../utils/testClock'
import { UseMatches } from '../../queries/useMatches'

// Dev-only klokkekontroll. Rendres kun når NEXT_PUBLIC_TEST_AUTH=true.
// Overstyrer «nå» i hele testappen via «betpool_test_clock»-cookien.
// Etter endring invalideres ALLE React Query-queries, så hver hook henter
// på nytt — de nye requestene bærer den oppdaterte cookien, og komponentene
// re-rendres slik at klient-side `nå()` også leses på nytt.

function lesKlokkeCookie(): string | undefined {
    if (typeof document === 'undefined') return undefined
    const m = document.cookie.match(/(?:^|;\s*)betpool_test_clock=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : undefined
}

import { Match } from '../../types/types'

// «Nå» et par timer etter at den `n`-te kampen (kronologisk) har startet.
function etterKampNr(matches: Match[], n: number): string {
    const match = matches[n - 1]
    if (!match) return new Date().toISOString()
    return dayjs(match.game_start).add(3, 'hours').toISOString()
}

// Et døgn før første kamp — «før turneringen».
function førTurneringen(matches: Match[]): string {
    const første = matches[0]
    if (!første) return new Date().toISOString()
    return dayjs(første.game_start).subtract(1, 'day').toISOString()
}

export function TestClock() {
    const queryClient = useQueryClient()
    const { data: matches } = UseMatches()
    const [open, setOpen] = useState(false)
    const [current, setCurrent] = useState<string | undefined>(undefined)
    const kamper = matches ?? []

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrent(lesKlokkeCookie())
    }, [])

    function sett(iso: string) {
        setKlokke(iso)
        setCurrent(iso)
        queryClient.invalidateQueries()
    }

    function nullstill() {
        nullstillKlokke()
        setCurrent(undefined)
        queryClient.invalidateQueries()
    }

    const label = current ? dayjs(current).format('DD.MM HH:mm') : 'ekte tid'

    return (
        <div className="fixed bottom-32 right-2 z-100 text-sm">
            {open && (
                <div className="mb-2 w-64 rounded-xl border border-sky-300 bg-white shadow-xl">
                    <div className="border-b border-zinc-200 px-3 py-2 font-semibold text-sky-700">
                        Test-klokke
                        <div className="text-xs font-normal text-zinc-500">Nå: {label}</div>
                    </div>
                    <button
                        onClick={() => sett(førTurneringen(kamper))}
                        className="block w-full px-3 py-2 text-left hover:bg-sky-50"
                    >
                        Før turneringen
                    </button>
                    <button
                        onClick={() => sett(etterKampNr(kamper, 1))}
                        className="block w-full px-3 py-2 text-left hover:bg-sky-50"
                    >
                        Etter kamp 1
                    </button>
                    <button
                        onClick={() => sett(etterKampNr(kamper, 5))}
                        className="block w-full px-3 py-2 text-left hover:bg-sky-50"
                    >
                        Etter kamp 5
                    </button>
                    <div className="border-t border-zinc-200 px-3 py-2">
                        <label className="block text-xs text-zinc-500">Eget tidspunkt</label>
                        <input
                            type="datetime-local"
                            defaultValue={current ? dayjs(current).format('YYYY-MM-DDTHH:mm') : ''}
                            onChange={(e) => {
                                const valgt = dayjs(e.target.value)
                                if (e.target.value && valgt.isValid()) sett(valgt.toISOString())
                            }}
                            className="mt-1 w-full rounded-sm border border-zinc-300 px-2 py-1"
                        />
                    </div>
                    <button
                        onClick={nullstill}
                        className="block w-full border-t border-zinc-200 px-3 py-2 text-left text-red-600 hover:bg-red-50"
                    >
                        Ekte tid
                    </button>
                </div>
            )}
            <button
                onClick={() => setOpen((o) => !o)}
                className="rounded-full bg-sky-400 px-3 py-2 font-semibold text-sky-950 shadow-lg"
            >
                🕑 {label}
            </button>
        </div>
    )
}
