import type { NextPage } from 'next'
import { Spinner } from '../components/loading/Spinner'
import React, { useState, useMemo } from 'react'
import { UseUsers } from '../queries/useUsers'
import { UseUser } from '../queries/useUser'
import { UserForAdmin } from '../types/types'
import { PushSkjema } from '../components/admin/PushSkjema'
import { PushAlleSkjema } from '../components/admin/PushAlleSkjema'
import { Search, X, ChevronLeft, Bell, BellOff } from 'lucide-react'

function initialer(navn: string): string {
    const deler = navn.trim().split(/\s+/).filter(Boolean)
    if (deler.length === 0) return '?'
    if (deler.length === 1) return deler[0].slice(0, 2).toUpperCase()
    return (deler[0][0] + deler[deler.length - 1][0]).toUpperCase()
}

function BrukerRad({ user, onClick }: { user: UserForAdmin; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-stone-50"
        >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-stone-700 to-stone-900 text-xs font-semibold text-white">
                {initialer(user.name)}
            </span>
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium leading-tight text-stone-900">{user.name}</div>
                <div className="truncate text-xs text-stone-500">{user.email}</div>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-xs text-stone-500">
                <Bell className="h-3.5 w-3.5" />
                <span className="bp-tabular">{user.device_count}</span>
            </span>
        </button>
    )
}

function Velger({ brukere, onVelg }: { brukere: UserForAdmin[]; onVelg: (user: UserForAdmin) => void }) {
    const [søk, setSøk] = useState('')

    const medEnheter = useMemo(
        () => brukere.filter((u) => u.device_count > 0).sort((a, b) => a.name.localeCompare(b.name, 'nb')),
        [brukere],
    )

    const filtrert = useMemo(() => {
        const q = søk.trim().toLowerCase()
        if (!q) return medEnheter
        return medEnheter.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    }, [medEnheter, søk])

    return (
        <div className="space-y-3">
            <PushAlleSkjema />

            <p className="text-sm text-stone-600">Eller velg hvem du vil sende en push-melding til.</p>

            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                    type="text"
                    value={søk}
                    onChange={(e) => setSøk(e.target.value)}
                    placeholder="Søk navn eller e-post…"
                    className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-8 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {søk && (
                    <button
                        onClick={() => setSøk('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {medEnheter.length === 0 ? (
                <div className="bp-card flex items-center gap-2 text-sm text-stone-500">
                    <BellOff className="h-4 w-4 shrink-0" />
                    Ingen brukere har push-enheter ennå.
                </div>
            ) : (
                <div className="bp-card overflow-hidden p-0">
                    <div className="divide-y divide-stone-100">
                        {filtrert.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-stone-400">Ingen brukere funnet.</p>
                        ) : (
                            filtrert.map((user) => <BrukerRad key={user.id} user={user} onClick={() => onVelg(user)} />)
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

function Sender({ user, onTilbake }: { user: UserForAdmin; onTilbake: () => void }) {
    return (
        <div className="space-y-3">
            <button
                onClick={onTilbake}
                className="flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
            >
                <ChevronLeft className="h-4 w-4" />
                Velg en annen bruker
            </button>

            <div className="bp-card space-y-3">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-stone-700 to-stone-900 text-sm font-semibold text-white">
                        {initialer(user.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-stone-900">{user.name}</div>
                        <div className="truncate text-xs text-stone-500">{user.email}</div>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-stone-500">
                        <Bell className="h-3.5 w-3.5" />
                        <span className="bp-tabular">{user.device_count}</span>
                    </span>
                </div>
                <PushSkjema mottaker={user.id} />
            </div>
        </div>
    )
}

const SendPushPage: NextPage = () => {
    const { data: brukere } = UseUsers()
    const { data: me } = UseUser()
    const [valgt, setValgt] = useState<UserForAdmin | null>(null)

    if (!brukere || !me) return <Spinner />

    if (!me.superadmin) {
        return (
            <div className="space-y-3">
                <h1 className="text-2xl font-bold text-stone-900">Send push</h1>
                <p className="text-sm text-stone-600">Du har ikke tilgang til denne siden.</p>
            </div>
        )
    }

    // Hold valgt bruker i synk med ferske data (f.eks. device_count).
    const valgtBruker = valgt ? (brukere.find((u) => u.id === valgt.id) ?? valgt) : null

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold text-stone-900">Send push</h1>
            {valgtBruker ? (
                <Sender user={valgtBruker} onTilbake={() => setValgt(null)} />
            ) : (
                <Velger brukere={brukere} onVelg={setValgt} />
            )}
        </div>
    )
}

export default SendPushPage
