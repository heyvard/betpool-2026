import type { NextPage } from 'next'
import React from 'react'
import { Spinner } from '../components/loading/Spinner'
import { UseUser } from '../queries/useUser'
import { UseUtenforHovedliga, UtenforHovedligaBruker } from '../queries/useUtenforHovedliga'
import { cn } from '@/lib/utils'

function initialer(navn: string): string {
    const deler = navn.trim().split(/\s+/).filter(Boolean)
    if (deler.length === 0) return '?'
    if (deler.length === 1) return deler[0].slice(0, 2).toUpperCase()
    return (deler[0][0] + deler[deler.length - 1][0]).toUpperCase()
}

function BrukerKort({ bruker }: { bruker: UtenforHovedligaBruker }) {
    return (
        <div className="bp-card p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-stone-700 to-stone-900 text-xs font-semibold text-white">
                        {initialer(bruker.name)}
                    </span>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-stone-900 truncate">{bruker.name}</span>
                            {!bruker.active && (
                                <span className="shrink-0 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-stone-500">
                                    Inaktiv
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-stone-500 truncate">{bruker.email}</p>
                    </div>
                </div>
                <span className="shrink-0 text-xs text-stone-500 bp-tabular">{bruker.bet_count} tips</span>
            </div>

            {bruker.ligaer.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {bruker.ligaer.map((l) => (
                        <span
                            key={l.id}
                            className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                l.status === 'medlem' ? 'bp-chip-blue' : 'bg-stone-100 text-stone-500',
                            )}
                        >
                            {l.name}
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

const UtenforHovedliga: NextPage = () => {
    const { data: me } = UseUser()
    const { data: brukere, isLoading } = UseUtenforHovedliga()

    if (!me?.superadmin) {
        return <p className="text-stone-500 text-sm mt-8 text-center">Ingen tilgang.</p>
    }

    if (isLoading || !brukere) {
        return <Spinner />
    }

    return (
        <div className="space-y-3">
            <div className="flex items-baseline justify-between">
                <h1 className="text-2xl font-bold text-stone-900">Utenfor hovedligaen</h1>
                <span className="text-sm text-stone-500 bp-tabular">{brukere.length} brukere</span>
            </div>
            <p className="text-sm text-stone-500">
                Brukere som har valgt bort hovedligaen. Tipsene deres teller ikke i hovedligaens poengberegning.
            </p>

            {brukere.length === 0 ? (
                <div className="bp-card text-sm text-stone-500">Alle brukere er med i hovedligaen.</div>
            ) : (
                brukere.map((bruker) => <BrukerKort key={bruker.id} bruker={bruker} />)
            )}
        </div>
    )
}

export default UtenforHovedliga
