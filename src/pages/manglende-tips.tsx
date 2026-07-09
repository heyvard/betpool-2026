import type { NextPage } from 'next'
import React, { useMemo, useState } from 'react'

import { Spinner } from '../components/loading/Spinner'
import { SpillerVelger } from '../components/SpillerVelger'
import { UseManglendeTips } from '../queries/useManglendeTips'
import { UseMutateManglendeTips } from '../queries/mutateManglendeTips'
import { UsePlayers } from '../queries/usePlayers'
import { ManglendeTipsBruker, Spiller } from '../types/types'
import { alleLagSortert, hentFlag, hentNorsk } from '../utils/lag'
import { cn } from '@/lib/utils'

function VinnerFelt({ bruker }: { bruker: ManglendeTipsBruker }) {
    const { mutate, isPending, error } = UseMutateManglendeTips()

    if (bruker.winner) {
        return (
            <div className="flex items-center gap-2 text-sm">
                <span className="text-lg leading-none">{hentFlag(bruker.winner)}</span>
                <span className="font-medium text-stone-700">{hentNorsk(bruker.winner)}</span>
                {bruker.winner_endret && <span className="chip-halved">½</span>}
            </div>
        )
    }

    return (
        <div className="w-full sm:w-64">
            <label className="relative flex w-full items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-800">
                <span>{isPending ? 'Lagrer …' : 'Velg vinner …'}</span>
                <select
                    value=""
                    disabled={isPending}
                    onChange={(e) => e.target.value && mutate({ userId: bruker.id, winner: e.target.value })}
                    aria-label="Sett vinner-tips"
                    className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                >
                    <option value="" disabled>
                        Velg land …
                    </option>
                    {alleLagSortert.map((l) => (
                        <option key={l.tla} value={l.tla}>
                            {l.flagg} {l.norsk}
                        </option>
                    ))}
                </select>
            </label>
            {error != null && <p className="mt-1 text-xs text-red-600">{(error as Error).message}</p>}
        </div>
    )
}

function ToppscorerFelt({ bruker, spillere }: { bruker: ManglendeTipsBruker; spillere: Spiller[] }) {
    const { mutate, isPending, error } = UseMutateManglendeTips()

    if (bruker.topscorer_player_id != null) {
        return (
            <div className="flex items-center gap-2 text-sm">
                <span className="text-lg leading-none">⚽️</span>
                <span className="font-medium text-stone-700">{bruker.player_name}</span>
                {bruker.player_team_tla && (
                    <span className="text-xs text-stone-400">{hentNorsk(bruker.player_team_tla)}</span>
                )}
                {bruker.topscorer_endret && <span className="chip-halved">½</span>}
            </div>
        )
    }

    return (
        <div className="w-full sm:w-80">
            <SpillerVelger
                valgtId={null}
                spillere={spillere}
                lagrer={isPending}
                placeholder="Velg toppscorer …"
                onVelg={(playerId) => playerId != null && mutate({ userId: bruker.id, topscorerPlayerId: playerId })}
            />
            {error != null && <p className="mt-1 text-xs text-red-600">{(error as Error).message}</p>}
        </div>
    )
}

function BrukerRad({ bruker, spillere }: { bruker: ManglendeTipsBruker; spillere: Spiller[] }) {
    return (
        <div className="bp-card space-y-3">
            <span className="font-medium text-stone-900">{bruker.name}</span>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                    <p className="bp-overline">Vinner</p>
                    <VinnerFelt bruker={bruker} />
                </div>
                <div className="space-y-1">
                    <p className="bp-overline">Toppscorer</p>
                    <ToppscorerFelt bruker={bruker} spillere={spillere} />
                </div>
            </div>
        </div>
    )
}

const ManglendeTips: NextPage = () => {
    const { data: brukere } = UseManglendeTips()
    const { data: spillere } = UsePlayers()
    const [kunManglende, setKunManglende] = useState(true)

    const synlige = useMemo(() => {
        if (!brukere) return []
        return kunManglende ? brukere.filter((b) => !b.winner || b.topscorer_player_id == null) : brukere
    }, [brukere, kunManglende])

    if (!brukere || !spillere) {
        return <Spinner />
    }

    const antallManglende = brukere.filter((b) => !b.winner || b.topscorer_player_id == null).length

    return (
        <div className="space-y-3">
            <div>
                <h1 className="text-2xl font-bold text-stone-900">Manglende tips</h1>
                <p className="text-sm text-stone-500">
                    Sett vinner- eller toppscorer-tips for brukere som ikke rakk fristen selv. Et tips satt her gir{' '}
                    <span className="font-medium text-stone-700">halvt poeng</span> for den kategorien, akkurat som når
                    en bruker selv bytter tips i endrevinduet.{' '}
                    <span className="bp-tabular font-medium text-stone-700">{antallManglende}</span> mangler noe.
                </p>
            </div>

            {spillere.length === 0 && (
                <div className="bp-card text-center text-sm text-stone-400">
                    Ingen spillere i spillertabellen ennå. Kjør «Synk spillere» under Cron-jobber først.
                </div>
            )}

            <div className="flex gap-1.5">
                <button
                    onClick={() => setKunManglende(false)}
                    className={cn(
                        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                        !kunManglende ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
                    )}
                >
                    Alle
                </button>
                <button
                    onClick={() => setKunManglende(true)}
                    className={cn(
                        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                        kunManglende ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
                    )}
                >
                    Kun manglende
                </button>
            </div>

            {synlige.length === 0 ? (
                <div className="bp-card text-center text-sm text-stone-400">
                    {kunManglende ? 'Alle brukere har tippet 🎉' : 'Ingen brukere.'}
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

export default ManglendeTips
