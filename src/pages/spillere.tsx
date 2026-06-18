import type { NextPage } from 'next'
import React, { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'

import { Spinner } from '../components/loading/Spinner'
import { UsePlayers } from '../queries/usePlayers'
import { hentFlag, hentNorsk } from '../utils/lag'
import { Spiller } from '../types/types'

function posisjonTekst(posisjon: string | null): string {
    switch (posisjon) {
        case 'Goalkeeper':
            return 'Keeper'
        case 'Defence':
            return 'Forsvar'
        case 'Midfield':
            return 'Midtbane'
        case 'Offence':
            return 'Angrep'
        default:
            return posisjon ?? '–'
    }
}

function formaterFødselsdato(iso: string | null): string {
    if (!iso) return '–'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '–'
    return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function LandSeksjon({ tla, spillere }: { tla: string; spillere: Spiller[] }) {
    return (
        <div className="bp-card overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-2.5">
                <span className="text-lg leading-none">{hentFlag(tla)}</span>
                <span className="text-sm font-semibold text-stone-900">{hentNorsk(tla)}</span>
                <span className="bp-tabular text-xs text-stone-400">{spillere.length}</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="border-b border-stone-100">
                            <th className="w-12 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                                #
                            </th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                                Navn
                            </th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                                Posisjon
                            </th>
                            <th className="hidden px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500 sm:table-cell">
                                Født
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {spillere.map((s) => (
                            <tr key={s.id} className="hover:bg-stone-50/50">
                                <td className="bp-tabular px-3 py-2 text-right text-stone-400">
                                    {s.shirt_number ?? '–'}
                                </td>
                                <td className="px-3 py-2 font-medium text-stone-900">{s.name}</td>
                                <td className="px-3 py-2 text-stone-600">{posisjonTekst(s.position)}</td>
                                <td className="bp-tabular hidden px-3 py-2 text-stone-600 sm:table-cell">
                                    {formaterFødselsdato(s.date_of_birth)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

const Spillere: NextPage = () => {
    const { data } = UsePlayers()
    const [søk, setSøk] = useState('')

    const grupper = useMemo(() => {
        if (!data) return []
        const filtrert = søk
            ? data.filter(
                  (s) =>
                      s.name.toLowerCase().includes(søk.toLowerCase()) ||
                      hentNorsk(s.team_tla).toLowerCase().includes(søk.toLowerCase()),
              )
            : data
        const perLand = new Map<string, Spiller[]>()
        for (const s of filtrert) {
            const liste = perLand.get(s.team_tla) ?? []
            liste.push(s)
            perLand.set(s.team_tla, liste)
        }
        return [...perLand.entries()].sort((a, b) => hentNorsk(a[0]).localeCompare(hentNorsk(b[0]), 'nb'))
    }, [data, søk])

    if (!data) {
        return <Spinner />
    }

    return (
        <div className="space-y-3">
            <div>
                <h1 className="text-2xl font-bold text-stone-900">Spillere</h1>
                <p className="text-sm text-stone-500">
                    {data.length} spillere fra {new Set(data.map((s) => s.team_tla)).size} landslag, synket fra
                    football-data.org.
                </p>
            </div>

            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                    type="text"
                    value={søk}
                    onChange={(e) => setSøk(e.target.value)}
                    placeholder="Søk spiller eller landslag…"
                    className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-8 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {søk && (
                    <button
                        onClick={() => setSøk('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                        aria-label="Tøm søk"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {data.length === 0 ? (
                <div className="bp-card text-center text-sm text-stone-400">
                    Ingen spillere ennå. Kjør «Synk spillere» under Cron-jobber.
                </div>
            ) : grupper.length === 0 ? (
                <div className="bp-card text-center text-sm text-stone-400">Ingen treff.</div>
            ) : (
                <div className="space-y-3">
                    {grupper.map(([tla, spillere]) => (
                        <LandSeksjon key={tla} tla={tla} spillere={spillere} />
                    ))}
                </div>
            )}
        </div>
    )
}

export default Spillere
