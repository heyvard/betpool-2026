import type { NextPage } from 'next'
import React from 'react'
import dayjs from 'dayjs'

import { Button } from '@/components/ui/button'
import { Spinner } from '../components/loading/Spinner'
import { UseUser } from '../queries/useUser'
import { UseMatches } from '../queries/useMatches'
import { UseMutateAdminMatchRaw } from '../queries/mutateAdminMatchRaw'
import { hentNavn } from '../utils/lag'
import { rundeTilTekst } from '../utils/rundeTilTekst'
import { Match } from '../types/types'

function kampNavn(kamp: Match): string {
    const hjemme = kamp.home_team ? hentNavn(kamp.home_team) : '?'
    const borte = kamp.away_team ? hentNavn(kamp.away_team) : '?'
    return `${hjemme} – ${borte}`
}

function KampRad({ kamp }: { kamp: Match }) {
    const { mutate, isPending, data, error, reset } = UseMutateAdminMatchRaw()
    const [åpen, setÅpen] = React.useState(false)
    const [kopiert, setKopiert] = React.useState(false)

    const json = data ? JSON.stringify(data.body, null, 2) : null

    async function kopier() {
        if (!json) return
        try {
            await navigator.clipboard.writeText(json)
            setKopiert(true)
            setTimeout(() => setKopiert(false), 2000)
        } catch {
            // ignorer — utklippstavle kan være utilgjengelig
        }
    }

    function toggle() {
        if (åpen) {
            setÅpen(false)
            return
        }
        setÅpen(true)
        if (!data && !isPending) mutate(kamp.match_num)
    }

    return (
        <div className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">{kampNavn(kamp)}</p>
                    <p className="text-xs text-stone-500">
                        <span className="font-mono">#{kamp.match_num}</span>
                        {' · '}
                        {rundeTilTekst(kamp.round)}
                        {kamp.group ? ` · ${kamp.group}` : ''}
                        {' · '}
                        {dayjs(kamp.game_start).format('DD.MM HH:mm')}
                        {' · '}
                        <span className="font-mono text-[11px]">{kamp.status}</span>
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    {data && (
                        <Button variant="ghost" size="small" onClick={kopier}>
                            {kopiert ? 'Kopiert!' : 'Kopier'}
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="small"
                        loading={isPending}
                        onClick={() => {
                            if (data && åpen) {
                                // last på nytt
                                reset()
                                mutate(kamp.match_num)
                                return
                            }
                            toggle()
                        }}
                    >
                        {data && åpen ? 'Hent på nytt' : 'Hent API-data'}
                    </Button>
                </div>
            </div>
            {error && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
                    Kunne ikke hente — prøv igjen.
                </p>
            )}
            {åpen && data && (
                <div className="mt-2 space-y-1.5">
                    <p className="text-[11px] text-stone-500">
                        <span className="font-mono">{data.url}</span>
                        {' → '}
                        <span className={data.ok ? 'text-green-700' : 'text-red-700'}>HTTP {data.status ?? '—'}</span>
                    </p>
                    <pre className="max-h-[60vh] overflow-auto rounded-lg bg-stone-900 p-3 text-[11px] leading-relaxed text-stone-100">
                        {json}
                    </pre>
                </div>
            )}
        </div>
    )
}

// Superadmin-debugside: lister alle kamper og lar deg hente rå-responsen fra
// football-data.org sitt /v4/matches/{id}-endepunkt per kamp, vist som pen JSON.
const AdminMatchData: NextPage = () => {
    const { data: me } = UseUser()
    const { data: kamper, isLoading } = UseMatches()
    const [filter, setFilter] = React.useState('')

    if (!me) return <Spinner />
    if (!me.superadmin) {
        return <p className="text-sm text-stone-600">Kun for superadmin.</p>
    }

    const synlige = (kamper ?? []).filter((k) => {
        if (!filter.trim()) return true
        const q = filter.trim().toLowerCase()
        return (
            String(k.match_num).includes(q) ||
            kampNavn(k).toLowerCase().includes(q) ||
            (k.home_team ?? '').toLowerCase().includes(q) ||
            (k.away_team ?? '').toLowerCase().includes(q) ||
            (k.group ?? '').toLowerCase().includes(q)
        )
    })

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold text-stone-900">Kamp-API-data</h1>
            <div className="bp-card space-y-3">
                <p className="text-sm text-stone-600">
                    Henter én kamp rett fra football-data.org sitt{' '}
                    <span className="font-mono">/v4/matches/&#123;id&#125;</span>
                    -endepunkt og viser rå-responsen som pen JSON. <span className="font-mono">id</span> = match_num.
                </p>
                <input
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filtrer på lag, nummer eller gruppe …"
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-400"
                />
            </div>

            {isLoading && <Spinner />}

            {!isLoading && (
                <div className="bp-card">
                    {synlige.length === 0 ? (
                        <p className="text-sm text-stone-500">Ingen kamper å vise.</p>
                    ) : (
                        <div className="divide-y divide-stone-100">
                            {synlige.map((kamp) => (
                                <KampRad key={kamp.match_num} kamp={kamp} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default AdminMatchData
