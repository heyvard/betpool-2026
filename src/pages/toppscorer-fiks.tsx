import type { NextPage } from 'next'
import React, { useMemo, useState } from 'react'

import { Spinner } from '../components/loading/Spinner'
import { SpillerVelger } from '../components/SpillerVelger'
import { UseToppscorerFiks } from '../queries/useToppscorerFiks'
import { UseMutateToppscorerFiks } from '../queries/mutateToppscorerFiks'
import { UsePlayers } from '../queries/usePlayers'
import { ToppscorerFiksBruker, Spiller } from '../types/types'
import { cn } from '@/lib/utils'

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
