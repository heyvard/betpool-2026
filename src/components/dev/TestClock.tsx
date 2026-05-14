import React, { useEffect, useState } from 'react'
import dayjs from 'dayjs'

import { setKlokke, nullstillKlokke } from '../../utils/testClock'
import { getMatches } from '../../data/matches'

// Dev-only klokkekontroll. Rendres kun når NEXT_PUBLIC_TEST_AUTH=true.
// Overstyrer «nå» i hele testappen via «betpool_test_clock»-cookien og
// laster siden på nytt, slik at React Query henter på nytt.

function lesKlokkeCookie(): string | undefined {
    if (typeof document === 'undefined') return undefined
    const m = document.cookie.match(/(?:^|;\s*)betpool_test_clock=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : undefined
}

// «Nå» et par timer etter at kamp nr. `num` har startet.
function etterKamp(num: number): string {
    const match = getMatches().find((m) => m.match_num === num)
    if (!match) return new Date().toISOString()
    return dayjs(match.game_start).add(3, 'hours').toISOString()
}

// Et døgn før første kamp — «før turneringen».
function førTurneringen(): string {
    const første = getMatches()[0]
    return dayjs(første.game_start).subtract(1, 'day').toISOString()
}

export function TestClock() {
    const [open, setOpen] = useState(false)
    const [current, setCurrent] = useState<string | undefined>(undefined)

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrent(lesKlokkeCookie())
    }, [])

    function sett(iso: string) {
        setKlokke(iso)
        window.location.reload()
    }

    function nullstill() {
        nullstillKlokke()
        window.location.reload()
    }

    const label = current ? dayjs(current).format('DD.MM HH:mm') : 'ekte tid'

    return (
        <div className="fixed bottom-32 right-2 z-[100] text-sm">
            {open && (
                <div className="mb-2 w-64 rounded-xl border border-sky-300 bg-white shadow-xl">
                    <div className="border-b border-zinc-200 px-3 py-2 font-semibold text-sky-700">
                        Test-klokke
                        <div className="text-xs font-normal text-zinc-500">Nå: {label}</div>
                    </div>
                    <button
                        onClick={() => sett(førTurneringen())}
                        className="block w-full px-3 py-2 text-left hover:bg-sky-50"
                    >
                        Før turneringen
                    </button>
                    <button
                        onClick={() => sett(etterKamp(1))}
                        className="block w-full px-3 py-2 text-left hover:bg-sky-50"
                    >
                        Etter kamp 1
                    </button>
                    <button
                        onClick={() => sett(etterKamp(5))}
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
                                if (e.target.value) sett(dayjs(e.target.value).toISOString())
                            }}
                            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
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
