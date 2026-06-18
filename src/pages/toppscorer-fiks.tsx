import type { NextPage } from 'next'
import React, { useMemo, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'

import { Spinner } from '../components/loading/Spinner'
import { UseToppscorerFiks } from '../queries/useToppscorerFiks'
import { UseMutateToppscorerFiks } from '../queries/mutateToppscorerFiks'
import { UsePlayers } from '../queries/usePlayers'
import { ToppscorerFiksBruker, Spiller } from '../types/types'
import { hentFlag, hentNorsk } from '../utils/lag'
import { cn } from '@/lib/utils'

// Rangerer spillere etter hvor godt de matcher søketeksten: eksakt treff først,
// så «starter med», så «inneholder». Brukes både for søk og for å sortere
// forslagene når vi forhåndsfyller med brukerens fritekst.
function rangerSpillere(spillere: Spiller[], søk: string): Spiller[] {
    const q = søk.trim().toLowerCase()
    if (!q) return spillere
    const treff = spillere
        .map((s) => {
            const navn = s.name.toLowerCase()
            const land = hentNorsk(s.team_tla).toLowerCase()
            let poeng = -1
            if (navn === q) poeng = 0
            else if (navn.startsWith(q)) poeng = 1
            else if (navn.includes(q)) poeng = 2
            else if (land.includes(q)) poeng = 3
            return { s, poeng }
        })
        .filter((x) => x.poeng >= 0)
    treff.sort((a, b) => a.poeng - b.poeng || a.s.name.localeCompare(b.s.name, 'nb'))
    return treff.map((x) => x.s)
}

function SpillerVelger({
    valgtId,
    fritekst,
    spillere,
    lagrer,
    onVelg,
}: {
    valgtId: number | null
    fritekst: string | null
    spillere: Spiller[]
    lagrer: boolean
    onVelg: (_playerId: number | null) => void
}) {
    const [åpen, setÅpen] = useState(false)
    const [søk, setSøk] = useState('')

    const valgt = useMemo(() => spillere.find((s) => s.id === valgtId) ?? null, [spillere, valgtId])

    const treff = useMemo(() => {
        const aktivtSøk = søk.trim() ? søk : (fritekst ?? '')
        return rangerSpillere(spillere, aktivtSøk).slice(0, 50)
    }, [spillere, søk, fritekst])

    function åpne() {
        setSøk('')
        setÅpen(true)
    }

    function velg(playerId: number | null) {
        onVelg(playerId)
        setÅpen(false)
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => (åpen ? setÅpen(false) : åpne())}
                disabled={lagrer}
                className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    valgt ? 'border-stone-200 bg-white text-stone-900' : 'border-amber-300 bg-amber-50 text-amber-800',
                    lagrer && 'opacity-60',
                )}
            >
                {valgt ? (
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="text-base leading-none">{hentFlag(valgt.team_tla)}</span>
                        <span className="truncate font-medium">{valgt.name}</span>
                        <span className="shrink-0 text-xs text-stone-400">{hentNorsk(valgt.team_tla)}</span>
                    </span>
                ) : (
                    <span>Velg spiller …</span>
                )}
                <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
            </button>

            {åpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setÅpen(false)} />
                    <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xl">
                        <div className="relative border-b border-stone-100 p-2">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                            <input
                                type="text"
                                autoFocus
                                value={søk}
                                onChange={(e) => setSøk(e.target.value)}
                                placeholder={fritekst ? `Søk … (fritekst: ${fritekst})` : 'Søk spiller …'}
                                className="w-full rounded-md border border-stone-200 bg-white py-1.5 pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                            {valgt && (
                                <button
                                    type="button"
                                    onClick={() => velg(null)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                >
                                    <X className="h-4 w-4" />
                                    Fjern kobling
                                </button>
                            )}
                            {treff.length === 0 ? (
                                <p className="px-3 py-4 text-center text-sm text-stone-400">Ingen treff.</p>
                            ) : (
                                treff.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => velg(s.id)}
                                        className={cn(
                                            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50',
                                            s.id === valgtId && 'bg-amber-50',
                                        )}
                                    >
                                        <span className="text-base leading-none">{hentFlag(s.team_tla)}</span>
                                        <span className="min-w-0 flex-1 truncate font-medium text-stone-900">
                                            {s.name}
                                        </span>
                                        <span className="shrink-0 text-xs text-stone-400">{hentNorsk(s.team_tla)}</span>
                                        {s.id === valgtId && <Check className="h-4 w-4 shrink-0 text-amber-600" />}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

function BrukerRad({ bruker, spillere }: { bruker: ToppscorerFiksBruker; spillere: Spiller[] }) {
    const { mutate, isPending } = UseMutateToppscorerFiks()
    const fikset = bruker.topscorer_player_id != null

    return (
        <div className="bp-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-900">{bruker.name}</span>
                    {fikset ? (
                        <span className="bp-chip-green">Fikset</span>
                    ) : (
                        <span className="bp-chip-gold">Mangler</span>
                    )}
                </div>
                <p className="mt-0.5 text-sm text-stone-500">
                    Fritekst:{' '}
                    {bruker.topscorer ? (
                        <span className="font-medium text-stone-700">{bruker.topscorer}</span>
                    ) : (
                        <span className="italic text-stone-400">ikke tippet</span>
                    )}
                </p>
            </div>
            <div className="w-full sm:w-80">
                <SpillerVelger
                    valgtId={bruker.topscorer_player_id}
                    fritekst={bruker.topscorer}
                    spillere={spillere}
                    lagrer={isPending}
                    onVelg={(playerId) => mutate({ userId: bruker.id, playerId })}
                />
            </div>
        </div>
    )
}

const ToppscorerFiks: NextPage = () => {
    const { data: brukere } = UseToppscorerFiks()
    const { data: spillere } = UsePlayers()
    const [kunUfiksede, setKunUfiksede] = useState(false)

    const synlige = useMemo(() => {
        if (!brukere) return []
        return kunUfiksede ? brukere.filter((b) => b.topscorer_player_id == null) : brukere
    }, [brukere, kunUfiksede])

    if (!brukere || !spillere) {
        return <Spinner />
    }

    const antallFikset = brukere.filter((b) => b.topscorer_player_id != null).length

    return (
        <div className="space-y-3">
            <div>
                <h1 className="text-2xl font-bold text-stone-900">Fiks toppscorer</h1>
                <p className="text-sm text-stone-500">
                    Koble hver brukers fritekst-toppscorer til riktig spiller fra spillertabellen.{' '}
                    <span className="bp-tabular font-medium text-stone-700">
                        {antallFikset} av {brukere.length}
                    </span>{' '}
                    fikset.
                </p>
            </div>

            {spillere.length === 0 && (
                <div className="bp-card text-center text-sm text-stone-400">
                    Ingen spillere i spillertabellen ennå. Kjør «Synk spillere» under Cron-jobber først.
                </div>
            )}

            <div className="flex gap-1.5">
                <button
                    onClick={() => setKunUfiksede(false)}
                    className={cn(
                        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                        !kunUfiksede ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
                    )}
                >
                    Alle
                </button>
                <button
                    onClick={() => setKunUfiksede(true)}
                    className={cn(
                        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                        kunUfiksede ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
                    )}
                >
                    Kun ufiksede
                </button>
            </div>

            {synlige.length === 0 ? (
                <div className="bp-card text-center text-sm text-stone-400">
                    {kunUfiksede ? 'Alle brukere er fikset 🎉' : 'Ingen brukere.'}
                </div>
            ) : (
                <div className="space-y-2">
                    {synlige.map((bruker) => (
                        <BrukerRad key={bruker.id} bruker={bruker} spillere={spillere} />
                    ))}
                </div>
            )}
        </div>
    )
}

export default ToppscorerFiks
